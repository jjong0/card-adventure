// src/core/difficulty.ts
// 난이도 보정 (docs/spec.md §5.3). 시작할 때 고르고 바꿀 수 없다.
// 어려움·익스트림 AI("불리하면 교체", "한 수 앞 예측")는 ai.ts(spec §10)에서 추가한다. 지금은 보통과 같은 AI.
import type { AiLevel, Card, ChapterData, Difficulty, Stats, Trainer, TrainerMon } from './types';
import type { Rng } from './gacha';

export interface DifficultyRule {
  label: string;
  /** 상대 레벨 보정 (원작 기준) */
  levelOffset: number;
  /** 상대 개체값: 범위면 스탯마다 무작위, 'original'이면 원작 트레이너 값 (야생은 0~31 무작위) */
  ivs: [number, number] | 'original';
  /** 트레이너 AI 수준 (types.ts AiLevel) */
  ai: AiLevel;
  /** 관장 파티: 원작 / 원작 + 재대결 1마리 / 재대결 파티 */
  leaderParty: 'story' | 'story+1' | 'rematch';
  /** 레벨 캡: 없음 / 이번 관장 에이스(난이도 레벨 보정 포함) / 관장 에이스 −2 */
  levelCap: 'none' | 'leader-ace' | 'leader-ace-2';
  goldRate: number;
  /** 휴식 회복 비율 (최대 HP 대비) */
  restHeal: number;
  /** 관장전에서 아이템 사용 */
  leaderItems: boolean;
  /** 패배하면 잃는 골드 비율 */
  lossGold: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyRule> = {
  easy: { label: '쉬움', levelOffset: -2, ivs: [0, 15], ai: 'random', leaderParty: 'story', levelCap: 'none', goldRate: 1.5, restHeal: 1, leaderItems: true, lossGold: 0 },
  normal: { label: '보통', levelOffset: 0, ivs: 'original', ai: 'basic', leaderParty: 'story', levelCap: 'none', goldRate: 1, restHeal: 1, leaderItems: true, lossGold: 0 },
  // 어려움·익스트림은 상대가 전략적으로 싸우는 것으로 구분한다 (ai.ts, 2026-11-25 사용자 결정).
  // 어려움 = 예전 익스트림 값(재대결 6마리 관장, 개체값 31, 레벨 캡 없음) + 교체·변화기를 쓰는 AI.
  //   예전 어려움(+3 레벨, 관장 에이스 캡)은 캡 때문에 레벨로 따라잡을 수 없어 익스트림보다 어려웠다.
  // 익스트림 = 어려움 + 한 수 앞을 읽는 AI + 상대 레벨 +1. 목표는 레드까지 클리어 약 30%.
  //   밸런스 봇 60판: 어려움 35%, 익스트림 25% (레벨 +0이면 33%로 어려움과 비슷해 +1).
  hard: { label: '어려움', levelOffset: 0, ivs: [31, 31], ai: 'smart', leaderParty: 'rematch', levelCap: 'none', goldRate: 0.6, restHeal: 0.3, leaderItems: false, lossGold: 1 },
  extreme: { label: '익스트림', levelOffset: 1, ivs: [31, 31], ai: 'expert', leaderParty: 'rematch', levelCap: 'none', goldRate: 0.6, restHeal: 0.3, leaderItems: false, lossGold: 1 },
};

export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'extreme'];
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 100;

const clampLevel = (lv: number) => Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, lv));
const maxLevel = (party: { level: number }[]) => Math.max(...party.map((p) => p.level));

function rollIvs(range: [number, number], rng: Rng): Stats {
  const [lo, hi] = range;
  const iv = () => lo + Math.floor(rng() * (hi - lo + 1));
  return { hp: iv(), atk: iv(), def: iv(), spAtk: iv(), spDef: iv(), spd: iv() };
}

/**
 * 상대 카드에 레벨·개체값 보정. 원작 값을 쓰는 보통은 그대로.
 * 야생은 원래 개체값이 무작위라 'original'이면 건드리지 않는다.
 */
export function adjustOpponent(cards: Card[], difficulty: Difficulty, rng: Rng): Card[] {
  const rule = DIFFICULTY[difficulty];
  return cards.map((c) => ({
    ...c,
    level: clampLevel(c.level + rule.levelOffset),
    ivBase: rule.ivs === 'original' ? c.ivBase : rollIvs(rule.ivs, rng),
  }));
}

/**
 * 재대결 파티를 스토리 레벨대로 낮춘다 (spec §5.3).
 * 새 레벨 = round(재대결 레벨 × 스토리 에이스 Lv ÷ 재대결 에이스 Lv)
 */
export function scaleRematch(rematch: TrainerMon[], storyAce: number): TrainerMon[] {
  const rematchAce = maxLevel(rematch);
  return rematch.map((p) => ({ ...p, level: clampLevel(Math.round((p.level * storyAce) / rematchAce)) }));
}

/**
 * 관장 파티 (레벨 보정 전). 재대결 파티가 없는 관장(레드)은 스토리 파티 그대로.
 * - story: 원작 스토리 파티 (쉬움·보통)
 * - story+1: 스토리 파티 + 재대결 파티에서 가장 강한 1마리(스케일) (지금은 쓰는 난이도 없음)
 * - rematch: 재대결 파티 전체(스케일) (어려움·익스트림)
 */
export function leaderTrainer(story: Trainer, rematch: Trainer | undefined, mode: DifficultyRule['leaderParty']): Trainer {
  if (mode === 'story' || !rematch) return story;
  const scaled = scaleRematch(rematch.party, maxLevel(story.party));
  if (mode === 'rematch') return { ...story, party: scaled };
  // 에이스는 원래 레벨로 고른다 (스케일하면 반올림으로 동점이 생긴다)
  const aceIdx = rematch.party.reduce((best, p, i, all) => (p.level > all[best].level ? i : best), 0);
  return { ...story, party: [...story.party, scaled[aceIdx]] };
}

/**
 * 레벨 캡 (spec §4.5, §5.3). 캡에 닿으면 경험치가 더 쌓이지 않는다. 없으면 100.
 * - 어려움: 이번 챕터 관장 에이스 Lv + 난이도 레벨 보정(+3). 실제로 만나는 관장 에이스까지만 키울 수 있다.
 *   (원작 에이스 Lv로 캡을 두면 같은 +3을 받은 일반 트레이너보다 낮게 묶여, 3~4장부터 레벨로 따라잡을 수 없었다.
 *   밸런스 봇 어려움 10판 중 4장을 넘은 판이 0)
 * - 익스트림: 관장 에이스 Lv − 2 (지금은 쓰지 않음)
 */
export function levelCap(chapter: ChapterData, difficulty: Difficulty): number {
  return capFor(chapter, DIFFICULTY[difficulty]);
}

/** 레벨 캡 규칙 계산 (지금은 모든 난이도가 캡 없음. 규칙 자체는 남겨 두고 직접 테스트한다) */
export function capFor(chapter: ChapterData, rule: Pick<DifficultyRule, 'levelCap' | 'levelOffset'>): number {
  if (rule.levelCap === 'none') return MAX_LEVEL;
  const ace = chapter.leader.aceLevel + rule.levelOffset;
  return clampLevel(rule.levelCap === 'leader-ace' ? ace : ace - 2);
}

export function adjustGold(gold: number, difficulty: Difficulty): number {
  return Math.round(gold * DIFFICULTY[difficulty].goldRate);
}

/** 패배 후 남는 골드 */
export function goldAfterLoss(gold: number, difficulty: Difficulty): number {
  return Math.floor(gold * (1 - DIFFICULTY[difficulty].lossGold));
}
