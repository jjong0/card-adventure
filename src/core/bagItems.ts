// src/core/bagItems.ts
// 가방에서 쓰는 약 목록 (spec §6). 전투 엔진(battle.ts)과 지도의 가방(items.ts)이 함께 쓰려고 의존성 없이 따로 둔다.

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

// ── PP 회복약 (이름·효과는 원작. 상점에서는 팔지 않고 승리 보상으로만 나온다) ──
export interface PpItem {
  id: string;
  name: string;
  /** 회복량 (null = 전부) */
  restore: number | null;
  /** 기술 1개(true) / 장착한 기술 전부(false) */
  single: boolean;
}

export const PP_ITEMS: PpItem[] = [
  { id: 'ether', name: 'PP에이드', restore: 10, single: true },
  { id: 'max-ether', name: 'PP회복', restore: null, single: true },
  { id: 'elixir', name: 'PP에이더', restore: 10, single: false },
  { id: 'max-elixir', name: 'PP맥스', restore: null, single: false },
];

/** 회복약·PP 회복약 이름 */
export function bagItemName(id: string): string {
  return HEAL_ITEMS.find((i) => i.id === id)?.name ?? PP_ITEMS.find((i) => i.id === id)?.name ?? id;
}
