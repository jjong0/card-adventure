// src/core/items.ts
// 가방 아이템과 상점 (docs/spec.md §6): 회복약, 진화의돌, 기술머신, 그리고 HP 회복 규칙
// 지닌 도구는 heldItems.ts.
import { calcStats, typeEffectiveness } from './battle';
import { HEAL_ITEMS, PP_ITEMS } from './bagItems';
import { effectiveIvs } from './card';
import type { BattleKind } from './encounter';
import { learnMoves } from './progress';
import type { Card, ChapterData, Dex, Evolutions, TmData } from './types';

// 약 목록은 전투 엔진과 함께 쓰려고 bagItems.ts에 둔다
export { bagItemName, HEAL_ITEMS, PP_ITEMS, type HealItem, type PpItem } from './bagItems';

/** 현재 HP 기록 (Card.uid → HP). 없는 카드는 가득 찬 것으로 본다 */
export type HpMap = Record<string, number>;

export function maxHp(card: Card, dex: Pick<Dex, 'species'>): number {
  return calcStats(dex.species[card.speciesId].baseStats, effectiveIvs(card), card.level).hp;
}

export function hpOf(card: Card, hp: HpMap, dex: Pick<Dex, 'species'>): number {
  const max = maxHp(card, dex);
  return Math.min(max, hp[card.uid] ?? max);
}

/** 전투 사이에 이어지는 PP (Card.uid → 기술 id → 남은 PP). 기록이 없는 기술은 가득 찬 것으로 본다 */
export type PpMap = Record<string, Record<string, number>>;

export function ppOf(card: Card, moveId: string, pp: PpMap, dex: Pick<Dex, 'moves'>): number {
  const max = dex.moves[moveId]?.pp ?? 0;
  return Math.min(max, pp[card.uid]?.[moveId] ?? max);
}

export type PpError = 'unknown-item' | 'need-move' | 'full';

/** PP 회복약 사용. 기술 1개용이면 moveId가 필요하다 (가방 차감은 호출하는 쪽에서) */
export function usePpItem(itemId: string, card: Card, pp: PpMap, dex: Pick<Dex, 'moves'>, moveId?: string): PpMap | PpError {
  const item = PP_ITEMS.find((i) => i.id === itemId);
  if (!item) return 'unknown-item';
  if (item.single && (!moveId || !card.moves.includes(moveId))) return 'need-move';
  const targets = item.single ? [moveId!] : card.moves;
  const next = { ...(pp[card.uid] ?? {}) };
  let changed = false;
  for (const id of targets) {
    const max = dex.moves[id]?.pp ?? 0;
    const now = ppOf(card, id, pp, dex);
    if (now >= max) continue;
    next[id] = item.restore === null ? max : Math.min(max, now + item.restore);
    changed = true;
  }
  if (!changed) return 'full';
  return { ...pp, [card.uid]: next };
}

/** 휴식·챕터 시작: 파티 PP를 모두 채운다 */
export function restorePp(party: Card[], pp: PpMap): PpMap {
  const next = { ...pp };
  for (const c of party) delete next[c.uid];
  return next;
}

/**
 * 전투 승리 보상 약 (spec §3.2). 노드가 강할수록 개수가 많고 좋은 약이 잘 나온다.
 * 회복약만 주면 가방에 회복약이 쌓여서 PP 회복약을 섞는다. (spec §12 미정 → 기본값)
 * 가중치 순서: 상처약 / 좋은상처약 / 고급상처약 / 기력의조각 / PP에이드 / PP회복 / PP에이더 / PP맥스
 */
const REWARD_ITEM_IDS = [...HEAL_ITEMS.map((i) => i.id), ...PP_ITEMS.map((i) => i.id)];
const ITEM_REWARD: Record<BattleKind, { count: number; weights: number[] }> = {
  wild: { count: 1, weights: [45, 15, 0, 5, 25, 5, 5, 0] },
  trainer: { count: 1, weights: [30, 25, 5, 8, 20, 6, 6, 0] },
  elite: { count: 2, weights: [10, 30, 12, 15, 13, 8, 8, 4] },
  leader: { count: 2, weights: [0, 25, 25, 18, 0, 12, 12, 8] },
};

export function rewardItems(kind: BattleKind, rng: () => number): string[] {
  const { count, weights } = ITEM_REWARD[kind];
  const total = weights.reduce((a, b) => a + b, 0);
  return Array.from({ length: count }, () => {
    let r = rng() * total;
    const i = weights.findIndex((w) => (r -= w) < 0);
    return REWARD_ITEM_IDS[i === -1 ? weights.length - 1 : i];
  });
}

export type HealError = 'unknown-item' | 'fainted' | 'full' | 'not-fainted';

/** 회복약 사용. 성공하면 새 HP 기록 (가방 차감은 호출하는 쪽에서) */
export function useHealItem(itemId: string, card: Card, hp: HpMap, dex: Pick<Dex, 'species'>): HpMap | HealError {
  const item = HEAL_ITEMS.find((i) => i.id === itemId);
  if (!item) return 'unknown-item';
  const max = maxHp(card, dex);
  const now = hpOf(card, hp, dex);
  if (item.heal === 'revive') {
    if (now > 0) return 'not-fainted';
    return { ...hp, [card.uid]: Math.max(1, Math.floor(max / 2)) };
  }
  if (now <= 0) return 'fainted';
  if (now >= max) return 'full';
  return { ...hp, [card.uid]: Math.min(max, now + item.heal) };
}

/** 휴식: 파티 전원을 최대 HP의 ratio만큼 회복 (쓰러진 포켓몬 포함). 보통 난이도는 전부(1) */
export function restParty(party: Card[], hp: HpMap, dex: Pick<Dex, 'species'>, ratio = 1): HpMap {
  const next = { ...hp };
  for (const c of party) {
    const max = maxHp(c, dex);
    next[c.uid] = Math.min(max, hpOf(c, hp, dex) + Math.ceil(max * ratio));
  }
  return next;
}

// ── 기술머신 ────────────────────────────────────
export type TeachError = 'not-a-tm' | 'cannot-learn' | 'already-known';

/** 기술머신으로 기술 배우기. 재사용은 무제한 (spec §12) */
export function teachTm(card: Card, moveId: string, tm: TmData): Card | TeachError {
  if (!tm.machines.some((m) => m.moveId === moveId)) return 'not-a-tm';
  if (card.learnedMoves.includes(moveId)) return 'already-known';
  if (!tm.compat[card.speciesId]?.includes(moveId)) return 'cannot-learn';
  return learnMoves(card, [moveId]).card;
}

// ── 상점 ────────────────────────────────────────
export const STONE_PRICE = 2100; // spec §12 기본값
export const TM_PRICE = 3000;
export const SHOP_STONES = ['fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone', 'sun-stone'];
const TMS_PER_SHOP = 3;

export interface ShopItem {
  id: string;        // 회복약·돌은 아이템 slug, 기술머신은 tm 번호(tm39)
  name: string;
  price: number;
  category: 'heal' | 'stone' | 'tm';
  /** 기술머신이 가르치는 기술 */
  moveId?: string;
}

/**
 * 챕터 상점의 기술머신: 관장 타입에 효과가 굉장한 공격기 중 위력이 낮은 것부터 3개 (spec §6 "관장 타입 대비 위주").
 * 초반 챕터에 눈보라 같은 고위력 기술이 풀리지 않게 위력 오름차순으로 고른다.
 */
export function shopTms(chapter: ChapterData, tm: TmData, dex: Dex) {
  const attacks = tm.machines
    .filter((m) => m.id.startsWith('tm'))
    .map((m) => ({ ...m, move: dex.moves[m.moveId] }))
    .filter((m) => m.move.category !== 'status' && m.move.power !== null);
  // 여러 타입 관장(그린·레드)은 노릴 약점이 없어서 위력이 가장 높은 기술머신
  if (!chapter.type) return attacks.sort((a, b) => b.move.power! - a.move.power! || a.id.localeCompare(b.id)).slice(0, TMS_PER_SHOP);
  const type = chapter.type;
  return attacks
    .filter((m) => typeEffectiveness(m.move.type, [type], dex) > 1)
    .sort((a, b) => a.move.power! - b.move.power! || a.id.localeCompare(b.id))
    .slice(0, TMS_PER_SHOP);
}

export function shopStock(chapter: ChapterData, tm: TmData, dex: Dex, evolutions: Evolutions): ShopItem[] {
  const stoneName = (slug: string) => {
    for (const list of Object.values(evolutions)) for (const e of list) if (e.method === 'item' && e.item === slug) return e.itemName;
    return slug;
  };
  return [
    ...HEAL_ITEMS.map((i): ShopItem => ({ id: i.id, name: i.name, price: i.price, category: 'heal' })),
    ...SHOP_STONES.map((s): ShopItem => ({ id: s, name: stoneName(s), price: STONE_PRICE, category: 'stone' })),
    ...shopTms(chapter, tm, dex).map((m): ShopItem => ({ id: m.id, name: `${m.name} ${m.move.name}`, price: TM_PRICE, category: 'tm', moveId: m.moveId })),
  ];
}
