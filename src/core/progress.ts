// src/core/progress.ts
// 전투 후 성장: 경험치 분배, 레벨업, 기술 습득, 진화 (docs/spec.md §4.4~4.6)
// 전투 엔진 밖에서 전투 종료 후에 처리한다. 모두 순수 함수.
import { learnableUpTo, MAX_EQUIPPED_MOVES } from './card';
import type { BattleState, Card, Evolution, Evolutions, Learnsets, Species } from './types';

export const MAX_LEVEL = 100;

/** expTable.json: 성장 곡선 → [레벨] = 그 레벨이 되는 누적 경험치 (0번은 비움) */
export type ExpTable = Record<string, number[]>;

export interface ProgressDex {
  species: Record<string, Species>;
  learnsets: Learnsets;
  expTable: ExpTable;
  evolutions: Evolutions;
}

// ════════════════════════════════════════════
// 경험치
// ════════════════════════════════════════════

export function expForLevel(table: ExpTable, growthRate: string, level: number): number {
  return table[growthRate][Math.max(1, Math.min(MAX_LEVEL, level))];
}

export function levelForExp(table: ExpTable, growthRate: string, exp: number): number {
  const curve = table[growthRate];
  let lv = 1;
  while (lv < MAX_LEVEL && curve[lv + 1] <= exp) lv++;
  return lv;
}

/**
 * 쓰러뜨린 포켓몬 1마리가 주는 경험치 (참여자 1명분).
 * 4세대 공식 exp = floor(a × b × L / 7 / s) — spec §4.5
 * a: 트레이너전 1.5, 야생 1 / b: 기초 경험치 / L: 쓰러뜨린 포켓몬 레벨 / s: 참여자 수
 */
export function expYield(baseExp: number, level: number, participants: number, trainer: boolean): number {
  if (participants <= 0) return 0;
  const a = trainer ? 1.5 : 1;
  return Math.floor((a * baseExp * level) / 7 / participants);
}

/** 전투 결과의 knockouts로 아군 카드별 획득 경험치 합계 (Card.uid → exp) */
export function distributeExp(state: BattleState, trainer: boolean, species: Record<string, Species>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ko of state.knockouts) {
    const foe = state.enemy.party[ko.enemyIdx];
    const amount = expYield(species[foe.card.speciesId].baseExp, foe.card.level, ko.participants.length, trainer);
    for (const idx of ko.participants) {
      const uid = state.player.party[idx].card.uid;
      out[uid] = (out[uid] ?? 0) + amount;
    }
  }
  return out;
}

// ════════════════════════════════════════════
// 기술 습득
// ════════════════════════════════════════════

/** 배운 기술에 추가하고, 장착 칸이 비어 있으면 자동 장착 (spec §4.4) */
export function learnMoves(card: Card, moveIds: string[]): { card: Card; learned: string[] } {
  const learned = [...new Set(moveIds)].filter((id) => !card.learnedMoves.includes(id));
  const moves = [...card.moves];
  for (const id of learned) if (moves.length < MAX_EQUIPPED_MOVES) moves.push(id);
  return { card: { ...card, learnedMoves: [...card.learnedMoves, ...learned], moves }, learned };
}

// ════════════════════════════════════════════
// 레벨업
// ════════════════════════════════════════════

export interface LevelUpResult {
  card: Card;
  fromLevel: number;
  toLevel: number;
  /** 이번에 새로 배운 기술 */
  newMoves: string[];
  /** 지금 레벨로 가능한 레벨형 진화 (플레이어가 고르거나 취소한다) */
  evolutions: Evolution[];
}

function applyExp(card: Card, exp: number, dex: ProgressDex): LevelUpResult {
  const growth = dex.species[card.speciesId].growthRate;
  const toLevel = levelForExp(dex.expTable, growth, exp);
  // 레벨업 사이(fromLevel, toLevel]에 배우는 기술. 레벨 0(진화 시)은 제외
  const gained = (dex.learnsets[card.speciesId] ?? [])
    .filter((x) => x.level > card.level && x.level <= toLevel)
    .map((x) => x.moveId);
  const { card: next, learned } = learnMoves({ ...card, exp, level: toLevel }, gained);
  return { card: next, fromLevel: card.level, toLevel, newMoves: learned, evolutions: levelEvolutions(next, dex) };
}

/** 현재 레벨의 최소 경험치보다 적으면 맞춰준다 (팩 카드는 exp 0으로 생성됨) */
function baseExp(card: Card, dex: ProgressDex) {
  return Math.max(card.exp, expForLevel(dex.expTable, dex.species[card.speciesId].growthRate, card.level));
}

/**
 * 경험치 획득. levelCap(어려움 이상)에 도달하면 더 쌓이지 않는다 (spec §4.5).
 * 캡보다 레벨이 높은 카드는 경험치를 받지 않는다.
 */
export function gainExp(card: Card, amount: number, dex: ProgressDex, levelCap = MAX_LEVEL): LevelUpResult {
  const growth = dex.species[card.speciesId].growthRate;
  const cap = Math.min(levelCap, MAX_LEVEL);
  const start = baseExp(card, dex);
  const ceiling = expForLevel(dex.expTable, growth, cap);
  const exp = card.level >= cap ? start : Math.min(start + Math.max(0, amount), ceiling);
  return applyExp(card, exp, dex);
}

/**
 * 레벨을 n 올린다 (휴식·강화 노드, spec §3.2). 레벨 캡(어려움 이상)까지만 오른다:
 * 캡은 관장보다 지나치게 키우지 못하게 하는 규칙이라, 강화로 넘을 수 있으면 의미가 없다.
 */
export function addLevels(card: Card, n: number, dex: ProgressDex, levelCap = MAX_LEVEL): LevelUpResult {
  const growth = dex.species[card.speciesId].growthRate;
  const target = Math.max(card.level, Math.min(MAX_LEVEL, levelCap, card.level + n));
  return applyExp(card, Math.max(baseExp(card, dex), expForLevel(dex.expTable, growth, target)), dex);
}

// ════════════════════════════════════════════
// 진화
// ════════════════════════════════════════════

/** 지금 레벨로 가능한 진화 (원작 레벨 + 교환·친밀도·기타의 대체 레벨). 갈래가 여럿이면 모두 */
export function levelEvolutions(card: Card, dex: ProgressDex): Evolution[] {
  return (dex.evolutions[card.speciesId] ?? []).filter((e) => e.method !== 'item' && card.level >= e.level);
}

/** 이 카드에 쓸 수 있는 진화 도구 slug 목록 (상점·가방 화면 표시용) */
export function evolutionItems(card: Card, dex: ProgressDex): string[] {
  return (dex.evolutions[card.speciesId] ?? []).flatMap((e) => (e.method === 'item' ? [e.item] : []));
}

export interface EvolveResult {
  card: Card;
  from: string;
  to: string;
  newMoves: string[];
}

/**
 * 진화 실행. speciesId만 바뀌고 lineId는 그대로 (spec §4.6).
 * 기억머신을 상시 쓸 수 있으므로(spec §1), 새 종이 현재 레벨까지 배우는 기술을 모두 배운다.
 * 성장 곡선이 바뀌면 레벨은 유지하고 경험치를 그 레벨의 최소값으로 맞춘다.
 */
function doEvolve(card: Card, to: string, dex: ProgressDex): EvolveResult {
  const fromGrowth = dex.species[card.speciesId].growthRate;
  const toGrowth = dex.species[to].growthRate;
  const exp = fromGrowth === toGrowth ? card.exp : expForLevel(dex.expTable, toGrowth, card.level);
  const { card: next, learned } = learnMoves(
    { ...card, speciesId: to, exp },
    learnableUpTo(dex.learnsets[to], card.level),
  );
  return { card: next, from: card.speciesId, to, newMoves: learned };
}

/** 레벨형 진화. 조건이 안 맞으면 'invalid' */
export function evolve(card: Card, to: string, dex: ProgressDex): EvolveResult | 'invalid' {
  if (!levelEvolutions(card, dex).some((e) => e.to === to)) return 'invalid';
  return doEvolve(card, to, dex);
}

/** 진화 도구 사용. 이 카드에 맞지 않는 도구면 'invalid' (가방 차감은 호출하는 쪽에서) */
export function evolveWithItem(card: Card, item: string, dex: ProgressDex): EvolveResult | 'invalid' {
  const evo = (dex.evolutions[card.speciesId] ?? []).find((e) => e.method === 'item' && e.item === item);
  if (!evo) return 'invalid';
  return doEvolve(card, evo.to, dex);
}
