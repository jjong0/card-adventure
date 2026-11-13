// src/core/collection.ts
// 보관함 조작: 카드 판매(골드로 바꾸기), 파티 편성, 정렬 (docs/spec.md §1 파티, §8 화면 7)
import { MAXED_DUP_GOLD } from './card';
import { typeEffectiveness } from './battle';
import { RARITY_ORDER } from './gacha';
import type { Card, Dex, ElementType } from './types';

export const MAX_PARTY = 6;

// ════════════════════════════════════════════
// 판매
// ════════════════════════════════════════════

/** 판매 금액 = ★5 이후 중복 골드 × ★등급 (spec §12 미정 → 기본값). 키운 카드일수록 비싸다 */
export function sellValue(card: Card, dex: Pick<Dex, 'species'>): number {
  return MAXED_DUP_GOLD[dex.species[card.speciesId].rarity] * card.star;
}

export type SellError = 'not-found' | 'in-party';

/** 카드를 팔아 골드로. 파티에 있는 카드는 먼저 빼야 한다 */
export function sellCard(collection: Card[], party: string[], uid: string, dex: Pick<Dex, 'species'>): { collection: Card[]; gold: number } | SellError {
  const card = collection.find((c) => c.uid === uid);
  if (!card) return 'not-found';
  if (party.includes(uid)) return 'in-party';
  return { collection: collection.filter((c) => c.uid !== uid), gold: sellValue(card, dex) };
}

// ════════════════════════════════════════════
// 파티
// ════════════════════════════════════════════

export type PartyError = 'empty' | 'too-many' | 'duplicate' | 'not-in-collection';

/** 파티 편성 검사: 1~6마리, 중복 없음, 보관함에 있는 카드만 */
export function setParty(collection: Card[], uids: string[]): string[] | PartyError {
  if (!uids.length) return 'empty';
  if (uids.length > MAX_PARTY) return 'too-many';
  if (new Set(uids).size !== uids.length) return 'duplicate';
  const owned = new Set(collection.map((c) => c.uid));
  if (!uids.every((u) => owned.has(u))) return 'not-in-collection';
  return uids;
}

// ════════════════════════════════════════════
// 정렬
// ════════════════════════════════════════════

/**
 * 다음 관장 상성 점수: (장착 공격기 중 관장 타입에 가장 잘 듣는 배율, 자속이면 ×1.5) ÷ (관장 타입이 이 카드에 주는 배율).
 * 높을수록 유리. 공격기가 없으면 공격 배율 1로 본다.
 */
export function matchupScore(card: Card, leaderType: ElementType, dex: Dex): number {
  const sp = dex.species[card.speciesId];
  const offense = Math.max(
    1,
    ...card.moves
      .map((id) => dex.moves[id])
      .filter((m) => m && m.category !== 'status')
      .map((m) => typeEffectiveness(m.type, [leaderType], dex) * (sp.types.includes(m.type) ? 1.5 : 1)),
  );
  const defense = typeEffectiveness(leaderType, sp.types, dex);
  return offense / Math.max(defense, 0.125); // 무효(0)는 0.125로 막아 무한대가 되지 않게
}

export type SortKey = 'matchup' | 'rarity' | 'level' | 'acquired';

/** 보관함 정렬. 획득순은 보관함 배열 순서(먼저 얻은 것이 앞). 같은 값이면 획득순 */
export function sortCards(cards: Card[], key: SortKey, dex: Dex, leaderType?: ElementType): Card[] {
  const order = new Map(cards.map((c, i) => [c.uid, i]));
  const score = (c: Card): number => {
    switch (key) {
      case 'matchup':
        return leaderType ? matchupScore(c, leaderType, dex) : 0;
      case 'rarity':
        return RARITY_ORDER.indexOf(dex.species[c.speciesId].rarity) * 10 + c.star;
      case 'level':
        return c.level;
      case 'acquired':
        return 0;
    }
  };
  return [...cards].sort((a, b) => score(b) - score(a) || order.get(a.uid)! - order.get(b.uid)!);
}
