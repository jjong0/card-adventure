// src/core/difficulty.ts
// 난이도 보정 (docs/spec.md §5.3). 시작할 때 고르고 바꿀 수 없다.
// 어려움·익스트림 AI("불리하면 교체", "한 수 앞 예측")는 ai.ts(spec §10)에서 추가한다. 지금은 보통과 같은 AI.
import type { Card, ChapterData, Difficulty, Stats, Trainer, TrainerMon } from './types';
import type { Rng } from './gacha';

export interface DifficultyRule {
  label: string;
  /** 상대 레벨 보정 (원작 기준) */
  levelOffset: number;
  /** 상대 개체값: 범위면 스탯마다 무작위, 'original'이면 원작 트레이너 값 (야생은 0~31 무작위) */
  ivs: [number, number] | 'original';
  /** 트레이너도 기술을 무작위로 고름 */
  randomAi: boolean;
  /** 관장 파티: 원작 / 원작 + 재대결 1마리 / 재대결 파티 */
  leaderParty: 'story' | 'story+1' | 'rematch';
  /** 레벨 캡: 없음 / 다음 관장 에이스 / 관장 에이스 −2 */
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
  easy: { label: '쉬움', levelOffset: -2, ivs: [0, 15], randomAi: true, leaderParty: 'story', levelCap: 'none', goldRate: 1.5, restHeal: 1, leaderItems: true, lossGold: 0 },
  normal: { label: '보통', levelOffset: 0, ivs: 'original', randomAi: false, leaderParty: 'story', levelCap: 'none', goldRate: 1, restHeal: 1, leaderItems: true, lossGold: 0 },
  hard: { label: '어려움', levelOffset: 3, ivs: [20, 31], randomAi: false, leaderParty: 'story+1', levelCap: 'leader-ace', goldRate: 0.8, restHeal: 0.5, leaderItems: true, lossGold: 0.5 },
  extreme: { label: '익스트림', levelOffset: 5, ivs: [31, 31], randomAi: false, leaderParty: 'rematch', levelCap: 'leader-ace-2', goldRate: 0.6, restHeal: 0.3, leaderItems: false, lossGold: 1 },
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
 * 난이도별 관장 파티 (레벨 보정 전). 재대결 파티가 없는 관장(레드)은 스토리 파티 그대로.
 * - 어려움: 스토리 파티 + 재대결 파티에서 가장 강한 1마리(스케일)
 * - 익스트림: 재대결 파티 전체(스케일)
 */
export function leaderTrainer(story: Trainer, rematch: Trainer | undefined, difficulty: Difficulty): Trainer {
  const mode = DIFFICULTY[difficulty].leaderParty;
  if (mode === 'story' || !rematch) return story;
  const scaled = scaleRematch(rematch.party, maxLevel(story.party));
  if (mode === 'rematch') return { ...story, party: scaled };
  // 에이스는 원래 레벨로 고른다 (스케일하면 반올림으로 동점이 생긴다)
  const aceIdx = rematch.party.reduce((best, p, i, all) => (p.level > all[best].level ? i : best), 0);
  return { ...story, party: [...story.party, scaled[aceIdx]] };
}

/**
 * 레벨 캡 (spec §4.5, §5.3). 캡에 닿으면 경험치가 더 쌓이지 않는다. 없으면 100.
 * - 어려움: 이번 챕터 관장 에이스 Lv (그 관장을 넘어서까지 키울 수 없다)
 * - 익스트림: 관장 에이스 Lv − 2
 */
export function levelCap(chapter: ChapterData, difficulty: Difficulty): number {
  const cap = DIFFICULTY[difficulty].levelCap;
  if (cap === 'none') return MAX_LEVEL;
  return cap === 'leader-ace' ? chapter.leader.aceLevel : chapter.leader.aceLevel - 2;
}

export function adjustGold(gold: number, difficulty: Difficulty): number {
  return Math.round(gold * DIFFICULTY[difficulty].goldRate);
}

/** 패배 후 남는 골드 */
export function goldAfterLoss(gold: number, difficulty: Difficulty): number {
  return Math.floor(gold * (1 - DIFFICULTY[difficulty].lossGold));
}
