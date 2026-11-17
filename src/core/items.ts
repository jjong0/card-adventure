// src/core/items.ts
// 가방 아이템과 상점 (docs/spec.md §6): 회복약, 진화의돌, 기술머신, 그리고 HP 회복 규칙
// 지닌 도구는 전투 효과가 구현되면(spec §5.2-3) 추가한다.
import { calcStats, typeEffectiveness } from './battle';
import { effectiveIvs } from './card';
import { learnMoves } from './progress';
import type { Card, ChapterData, Dex, Evolutions, TmData } from './types';

/** 현재 HP 기록 (Card.uid → HP). 없는 카드는 가득 찬 것으로 본다 */
export type HpMap = Record<string, number>;

export function maxHp(card: Card, dex: Pick<Dex, 'species'>): number {
  return calcStats(dex.species[card.speciesId].baseStats, effectiveIvs(card), card.level).hp;
}

export function hpOf(card: Card, hp: HpMap, dex: Pick<Dex, 'species'>): number {
  const max = maxHp(card, dex);
  return Math.min(max, hp[card.uid] ?? max);
}

// ── 회복약 (가격은 원작, spec §6) ──────────────────
export interface HealItem {
  id: string;
  name: string;
  price: number;
  /** 회복량. revive는 쓰러진 포켓몬을 최대 HP의 절반으로 되살린다 */
  heal: number | 'revive';
}

export const HEAL_ITEMS: HealItem[] = [
  { id: 'potion', name: '상처약', price: 300, heal: 20 },
  { id: 'super-potion', name: '좋은상처약', price: 700, heal: 50 },
  { id: 'hyper-potion', name: '고급상처약', price: 1200, heal: 200 },
  { id: 'revive', name: '기력의조각', price: 1500, heal: 'revive' },
];

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
  return tm.machines
    .filter((m) => m.id.startsWith('tm'))
    .map((m) => ({ ...m, move: dex.moves[m.moveId] }))
    .filter((m) => m.move.category !== 'status' && m.move.power !== null && typeEffectiveness(m.move.type, [chapter.type], dex) > 1)
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
