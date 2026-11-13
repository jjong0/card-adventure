// src/core/gacha.ts
// 카드팩 개봉과 보관함 추가(자동 합치기). 모두 순수 함수 — 상태 저장은 store에서.
import { defaultEquip, learnableUpTo, mergeDuplicate, type MergeResult } from './card';
import type { Card, Learnsets, PackDef, Rarity, Species, Stats } from './types';

/** 시드 기반 RNG (mulberry32) — 같은 시드 = 같은 결과 → 디버깅·리플레이 가능 */
export function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rng = () => number;

export const RARITY_ORDER: Rarity[] = ['N', 'R', 'SR', 'UR'];
/** 속성 팩 기본 확률 */
export const RARITY_RATES: Record<Rarity, number> = { N: 0.6, R: 0.3, SR: 0.08, UR: 0.02 };
export const CARDS_PER_PACK = 5;

/** 스타터 팩 풀: 1~9세대 스타팅 포켓몬 27종 (진화 전 단계) */
export const STARTER_IDS = [
  '1', '4', '7', '152', '155', '158', '252', '255', '258', '387', '390', '393', '495', '498', '501',
  '650', '653', '656', '722', '725', '728', '810', '813', '816', '906', '909', '912',
];

export interface GachaDex {
  species: Record<string, Species>;
  learnsets: Learnsets;
}

/** 진화 계열의 최초 종 id (중복 판정 기준) */
export function lineRootOf(speciesId: string, species: Record<string, Species>): string {
  let cur = species[speciesId];
  while (cur?.evolvesFrom && species[cur.evolvesFrom]) cur = species[cur.evolvesFrom];
  return cur?.id ?? speciesId;
}

function rollRarity(rng: Rng, min: Rarity = 'N'): Rarity {
  const allowed = RARITY_ORDER.slice(RARITY_ORDER.indexOf(min));
  const total = allowed.reduce((a, r) => a + RARITY_RATES[r], 0);
  let x = rng() * total;
  for (const r of allowed) {
    x -= RARITY_RATES[r];
    if (x < 0) return r;
  }
  return allowed[allowed.length - 1];
}

function rollIvs(rng: Rng): Stats {
  const iv = () => Math.floor(rng() * 32);
  return { hp: iv(), atk: iv(), def: iv(), spAtk: iv(), spDef: iv(), spd: iv() };
}

const ZERO: Stats = { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0 };

export function createCard(sp: Species, level: number, dex: GachaDex, rng: Rng): Card {
  const learnedMoves = learnableUpTo(dex.learnsets[sp.id], level);
  return {
    uid: `${sp.id}-${Math.floor(rng() * 2 ** 32).toString(36)}`,
    speciesId: sp.id,
    lineId: lineRootOf(sp.id, dex.species),
    level,
    exp: 0, // 레벨에 맞는 경험치는 progress 로직에서 expTable로 채움
    star: 1,
    dupProgress: 0,
    ivBase: rollIvs(rng),
    ivAlloc: { ...ZERO },
    ivPoints: 0,
    learnedMoves,
    moves: defaultEquip(learnedMoves),
    heldItem: null,
  };
}

/** 팩 개봉: 카드 5장 (같은 팩 안에서도 중복 가능 — 받은 뒤 자동 합치기) */
export function openPack(pack: PackDef, dex: GachaDex, rng: Rng): Card[] {
  const all = Object.values(dex.species);
  const pool =
    pack.kind === 'starter'
      ? STARTER_IDS.map((id) => dex.species[id]).filter(Boolean)
      : pack.typeFilter
        ? all.filter((s) => s.types.includes(pack.typeFilter!))
        : all;

  const cards: Card[] = [];
  const picked = new Set<string>();
  for (let i = 0; i < pack.cardsPerPack; i++) {
    let sp: Species;
    if (pack.kind === 'starter') {
      // 스타터 팩은 서로 다른 5종에서 1장 선택하므로 중복 없이 뽑음
      const left = pool.filter((s) => !picked.has(s.id));
      sp = left[Math.floor(rng() * left.length)];
      picked.add(sp.id);
    } else {
      const rarity = rollRarity(rng, pack.minRarity);
      const minIdx = RARITY_ORDER.indexOf(pack.minRarity ?? 'N');
      const exact = pool.filter((s) => s.rarity === rarity);
      const atLeastMin = pool.filter((s) => RARITY_ORDER.indexOf(s.rarity) >= minIdx);
      // 해당 속성에 그 등급이 없으면 최소 등급 이상 전체에서, 그것도 없으면 속성 전체에서
      const from = exact.length ? exact : atLeastMin.length ? atLeastMin : pool;
      sp = from[Math.floor(rng() * from.length)];
    }
    cards.push(createCard(sp, pack.level, dex, rng));
  }
  return cards;
}

export type AddResult =
  | { kind: 'new'; card: Card }
  | ({ kind: MergeResult['kind']; card: Card; incoming: Card } & Partial<{ from: number; to: number; points: number; gold: number }>);

/**
 * 보관함에 카드 추가. 같은 계열이 있으면 자동 합치기, 없으면 새로 추가.
 * 팩 결과 화면의 NEW / ★1→★2 / 진행도 / 골드 표시에 그대로 사용.
 */
export function addToCollection(collection: Card[], incoming: Card[], species: Record<string, Species>) {
  const next = [...collection];
  const results: AddResult[] = [];
  let gold = 0;
  for (const card of incoming) {
    const idx = next.findIndex((c) => c.lineId === card.lineId);
    if (idx === -1) {
      next.push(card);
      results.push({ kind: 'new', card });
      continue;
    }
    const r = mergeDuplicate(next[idx], card, species[card.speciesId].rarity);
    next[idx] = r.card;
    if (r.kind === 'gold') gold += r.gold;
    results.push({ ...r, incoming: card });
  }
  return { collection: next, results, gold };
}
