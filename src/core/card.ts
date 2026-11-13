// src/core/card.ts
// 카드 성장 규칙: ★등급, 개체값 포인트(2V 상한), 중복 합치기, 기술 장착
// 규칙 원문: docs/spec.md §4
import type { BattleStat, Card, Learnsets, Rarity, Stats } from './types';

type StatKey = keyof Stats;
export const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'spd'];

/** ★n → ★n+1 에 필요한 중복 수 (★1→2: 1장, ★2→3: 2장, ★3→4: 3장, ★4→5: 4장) */
export const STAR_DUP_COST = [1, 2, 3, 4] as const;
/** ★n+1 도달 시 받는 개체값 포인트 */
export const STAR_POINTS = [8, 10, 12, 16] as const;
/** 31(최대)에 도달할 수 있는 스탯 수 상한 */
export const MAX_PERFECT_STATS = 2;
export const IV_MAX = 31;
export const MAX_EQUIPPED_MOVES = 4;

/** ★5 이후 중복을 골드로 바꿀 때 금액 — 임시값 (spec §8 C항목에서 조정) */
export const MAXED_DUP_GOLD: Record<Rarity, number> = { N: 100, R: 200, SR: 500, UR: 1500 };

/** 전투에 쓰는 실제 개체값 = 기본 + 포인트 (최대 31) */
export function effectiveIvs(card: Card): Stats {
  const out = {} as Stats;
  for (const k of STAT_KEYS) out[k] = Math.min(IV_MAX, card.ivBase[k] + card.ivAlloc[k]);
  return out;
}

function perfectCount(ivs: Stats) {
  return STAT_KEYS.filter((k) => ivs[k] >= IV_MAX).length;
}

export type AllocateError = 'no-points' | 'stat-maxed' | 'perfect-limit' | 'nothing-to-remove';

/**
 * 개체값 포인트 1점 찍기(+1) / 회수(-1).
 * 31에 새로 도달하는 경우, 이미 31인 스탯이 2개 이상이면 거부 (2V 상한).
 */
export function allocateIv(card: Card, stat: StatKey, delta: 1 | -1): Card | AllocateError {
  const ivs = effectiveIvs(card);
  if (delta === -1) {
    if (card.ivAlloc[stat] <= 0) return 'nothing-to-remove';
    return { ...card, ivPoints: card.ivPoints + 1, ivAlloc: { ...card.ivAlloc, [stat]: card.ivAlloc[stat] - 1 } };
  }
  if (card.ivPoints <= 0) return 'no-points';
  if (ivs[stat] >= IV_MAX) return 'stat-maxed';
  if (ivs[stat] + 1 >= IV_MAX && perfectCount(ivs) >= MAX_PERFECT_STATS) return 'perfect-limit';
  return { ...card, ivPoints: card.ivPoints - 1, ivAlloc: { ...card.ivAlloc, [stat]: card.ivAlloc[stat] + 1 } };
}

/** 원작 규칙: 해당 레벨까지 배우는 기술 전체 / 그중 최근 4개 */
export function learnableUpTo(learnset: Learnsets[string] = [], level: number): string[] {
  return [...new Set(learnset.filter((x) => x.level <= level).map((x) => x.moveId))];
}
export function defaultEquip(learned: string[]): string[] {
  return learned.slice(-MAX_EQUIPPED_MOVES);
}

/** 장착 기술 교체 (기억머신 상시 사용): 배운 기술 중에서 1~4개 */
export function equipMoves(card: Card, moves: string[]): Card | 'invalid' {
  const uniq = [...new Set(moves)];
  if (uniq.length < 1 || uniq.length > MAX_EQUIPPED_MOVES) return 'invalid';
  if (!uniq.every((m) => card.learnedMoves.includes(m))) return 'invalid';
  return { ...card, moves: uniq };
}

export type MergeResult =
  | { kind: 'progress'; card: Card }                     // 중복 진행도만 증가
  | { kind: 'star-up'; card: Card; from: number; to: number; points: number }
  | { kind: 'gold'; card: Card; gold: number };          // ★5 이후

/**
 * 같은 계열 중복 합치기.
 * - 레벨은 높은 쪽, 기술은 합집합(learnedMoves), 장착 기술·개체값은 기존 카드 유지
 * - ★5면 골드로 환산
 */
export function mergeDuplicate(base: Card, dup: Card, dupRarity: Rarity): MergeResult {
  if (base.lineId !== dup.lineId) throw new Error(`line mismatch: ${base.lineId} vs ${dup.lineId}`);
  const learnedMoves = [...new Set([...base.learnedMoves, ...dup.learnedMoves])];
  const level = Math.max(base.level, dup.level);
  const exp = level === base.level ? base.exp : dup.exp;
  const common = { ...base, learnedMoves, level, exp };

  if (base.star >= 5) return { kind: 'gold', card: common, gold: MAXED_DUP_GOLD[dupRarity] };

  const idx = base.star - 1;
  const progress = base.dupProgress + 1;
  if (progress < STAR_DUP_COST[idx]) return { kind: 'progress', card: { ...common, dupProgress: progress } };

  const to = (base.star + 1) as Card['star'];
  const points = STAR_POINTS[idx];
  return {
    kind: 'star-up',
    card: { ...common, star: to, dupProgress: 0, ivPoints: base.ivPoints + points },
    from: base.star,
    to,
    points,
  };
}

/** UI용: 다음 ★까지 남은 중복 수 */
export function dupNeeded(card: Card): number | null {
  return card.star >= 5 ? null : STAR_DUP_COST[card.star - 1] - card.dupProgress;
}

export type { BattleStat };
