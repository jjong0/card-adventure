// src/core/heldItems.ts
// 지닌 도구 효과 표 (docs/spec.md §6). 배틀 엔진(battle.ts)이 여기 값을 보고 효과를 낸다.
// 수치는 원작 기준(대부분 4세대, 4세대에 없는 도구는 처음 나온 세대). 출처: 각 도구의 게임 내 설명과 Bulbapedia 항목.
// 목록·이름은 src/data/heldItems.json(스크립트 생성)이고, 여기에 없는 도구(원작 트레이너가 지닌 하양허브 등)는 효과가 없다.
import type { Ailment, BattleMon, BattleState, Card, ElementType, HeldItemTier, Move, MoveCategory } from './types';

/** 지닌 도구 데이터 (heldItems.json 한 줄) */
export interface HeldItemData {
  slug: string;
  name: string;
  description: string;
  tier: HeldItemTier;
}

/** 타입 강화 도구: 그 타입 기술 위력 ×1.2 (4세대) */
export const TYPE_BOOST: Record<string, ElementType> = {
  charcoal: 'fire', 'mystic-water': 'water', 'miracle-seed': 'grass', magnet: 'electric',
  'never-melt-ice': 'ice', 'black-belt': 'fighting', 'poison-barb': 'poison', 'soft-sand': 'ground',
  'hard-stone': 'rock', 'sharp-beak': 'flying', 'twisted-spoon': 'psychic', 'silver-powder': 'bug',
  'spell-tag': 'ghost', 'dragon-fang': 'dragon', 'black-glasses': 'dark', 'metal-coat': 'steel',
  'silk-scarf': 'normal', 'fairy-feather': 'fairy',
};

/** 반감 열매: 효과가 굉장한 그 타입 기술의 데미지 ×0.5, 한 번 쓰면 사라진다. 리체열매(노말)는 상성과 관계없이 */
export const RESIST_BERRY: Record<string, ElementType> = {
  'occa-berry': 'fire', 'passho-berry': 'water', 'wacan-berry': 'electric', 'rindo-berry': 'grass',
  'yache-berry': 'ice', 'chople-berry': 'fighting', 'kebia-berry': 'poison', 'shuca-berry': 'ground',
  'coba-berry': 'flying', 'payapa-berry': 'psychic', 'tanga-berry': 'bug', 'charti-berry': 'rock',
  'kasib-berry': 'ghost', 'haban-berry': 'dragon', 'colbur-berry': 'dark', 'babiri-berry': 'steel',
  'chilan-berry': 'normal', 'roseli-berry': 'fairy',
};

/** 상태이상 회복 열매: 고치는 상태 ('confusion' = 혼란) */
export const CURE_BERRY: Record<string, (Ailment | 'confusion')[]> = {
  'cheri-berry': ['paralysis'],
  'chesto-berry': ['sleep'],
  'pecha-berry': ['poison', 'toxic'],
  'rawst-berry': ['burn'],
  'aspear-berry': ['freeze'],
  'persim-berry': ['confusion'],
  'lum-berry': ['paralysis', 'sleep', 'poison', 'toxic', 'burn', 'freeze', 'confusion'],
};

/** HP 회복 열매: HP가 절반 이하가 되면 먹는다. 오랭 10 고정, 자뭉 최대 HP 1/4 (4세대) */
export function hpBerryAmount(item: string | null, maxHp: number): number {
  if (item === 'oran-berry') return 10;
  if (item === 'sitrus-berry') return Math.floor(maxHp / 4);
  return 0;
}

export const CHOICE_ITEMS = new Set(['choice-band', 'choice-specs', 'choice-scarf']);

/** 한 번 효과를 내면 사라지는 도구 */
export function isConsumable(item: string): boolean {
  return item === 'focus-sash' || item.endsWith('-berry');
}

/** 기술 위력 보정 (타입 강화 ×1.2, 힘의머리띠·박식안경 ×1.1) */
export function powerMultiplier(item: string | null, move: Move): number {
  if (!item) return 1;
  if (TYPE_BOOST[item] === move.type) return 1.2;
  if (item === 'muscle-band' && move.category === 'physical') return 1.1;
  if (item === 'wise-glasses' && move.category === 'special') return 1.1;
  return 1;
}

/** 공격 측 능력치 보정 (구애머리띠 공격 ×1.5, 구애안경 특수공격 ×1.5) */
export function attackMultiplier(item: string | null, category: MoveCategory): number {
  if (item === 'choice-band' && category === 'physical') return 1.5;
  if (item === 'choice-specs' && category === 'special') return 1.5;
  return 1;
}

/** 방어 측 능력치 보정 (돌격조끼 특수방어 ×1.5, 진화의휘석 진화 전이면 방어·특수방어 ×1.5) */
export function defenseMultiplier(item: string | null, category: MoveCategory, canEvolve: boolean): number {
  if (item === 'assault-vest' && category === 'special') return 1.5;
  if (item === 'eviolite' && canEvolve) return 1.5;
  return 1;
}

/** 최종 데미지 보정 (생명의구슬 ×1.3, 달인의띠 효과가 굉장하면 ×1.2) */
export function finalMultiplier(item: string | null, effectiveness: number): number {
  if (item === 'life-orb') return 1.3;
  if (item === 'expert-belt' && effectiveness > 1) return 1.2;
  return 1;
}

export function speedMultiplier(item: string | null): number {
  return item === 'choice-scarf' ? 1.5 : 1;
}

/** 급소 랭크 보너스 (초점렌즈 +1) */
export function critBonus(item: string | null): number {
  return item === 'scope-lens' ? 1 : 0;
}

/** 명중률 보정 (광각렌즈 ×1.1) */
export function accuracyMultiplier(item: string | null): number {
  return item === 'wide-lens' ? 1.1 : 1;
}

/** 이 반감 열매가 이번 공격에 반응하는지 */
export function resistBerryTriggers(item: string | null, moveType: ElementType, effectiveness: number): boolean {
  if (!item) return false;
  const type = RESIST_BERRY[item];
  if (!type || type !== moveType) return false;
  return type === 'normal' ? effectiveness > 0 : effectiveness > 1;
}

/**
 * 지금 고를 수 있는 기술 (PP가 남은 것 중). 구애 도구는 처음 쓴 기술로 고정되고, 돌격조끼는 변화기를 쓸 수 없다.
 * 비어 있으면 발버둥을 쓴다.
 */
export function usableMoves(mon: BattleMon, moves: Record<string, Move>): string[] {
  const withPp = mon.card.moves.filter((id) => (mon.pp[id] ?? 0) > 0 && moves[id]);
  return withPp.filter((id) => {
    if (mon.choiceLock && id !== mon.choiceLock) return false;
    if (mon.item === 'assault-vest' && moves[id].category === 'status') return false;
    return true;
  });
}

// ════════════════════════════════════════════
// 지니기·빼기 (도구는 가방 개수로 갖고, 지니게 하면 가방에서 빠진다. 카드 1장에 1개)
// ════════════════════════════════════════════

export type EquipError = 'not-found' | 'no-item' | 'not-held-item';

/**
 * 카드에 도구를 지니게 한다(slug = null이면 뺀다). 원래 지닌 도구는 가방으로 돌아간다.
 * heldItemSlugs: 지닐 수 있는 도구 목록 (회복약·진화의돌은 지닐 수 없다)
 */
export function equipHeldItem(
  collection: Card[], bag: Record<string, number>, uid: string, slug: string | null, heldItemSlugs: ReadonlySet<string>,
): { collection: Card[]; bag: Record<string, number> } | EquipError {
  const card = collection.find((c) => c.uid === uid);
  if (!card) return 'not-found';
  if (slug !== null && !heldItemSlugs.has(slug)) return 'not-held-item';
  if (slug !== null && (bag[slug] ?? 0) <= 0) return 'no-item';
  const next = { ...bag };
  if (card.heldItem) next[card.heldItem] = (next[card.heldItem] ?? 0) + 1;
  if (slug !== null) next[slug] -= 1;
  for (const k of Object.keys(next)) if (next[k] <= 0) delete next[k];
  return { collection: collection.map((c) => (c.uid === uid ? { ...c, heldItem: slug } : c)), bag: next };
}

/** 카드들이 지닌 도구를 가방으로 돌려받는다 (카드를 골드로 바꾸거나 너즐록으로 잃을 때) */
export function returnHeldItems(cards: Card[], bag: Record<string, number>): Record<string, number> {
  const next = { ...bag };
  for (const c of cards) if (c.heldItem) next[c.heldItem] = (next[c.heldItem] ?? 0) + 1;
  return next;
}

/** 전투에서 써서 사라진 도구(열매·기합의띠)를 지닌 아군 카드 uid */
export function consumedHeldItems(state: BattleState): string[] {
  return state.player.party
    .filter((m) => m.card.heldItem && m.item === null && isConsumable(m.card.heldItem))
    .map((m) => m.card.uid);
}
