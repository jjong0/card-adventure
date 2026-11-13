// src/core/collection.test.ts  (vitest) — 판매, 파티 편성, 정렬
import { describe, expect, it } from 'vitest';
import speciesList from '../data/species.json';
import moves from '../data/moves.json';
import typeChart from '../data/typeChart.json';
import learnsets from '../data/learnsets.json';
import { createCard, createRng } from './gacha';
import { matchupScore, sellCard, sellValue, setParty, sortCards } from './collection';
import type { Card, Dex, Learnsets, Move, Species, TypeChart } from './types';

const species = Object.fromEntries((speciesList as Species[]).map((s) => [s.id, s]));
const dex: Dex = { species, moves: moves as unknown as Record<string, Move>, typeChart: typeChart as TypeChart };
const rng = createRng(5);
const make = (id: string, level = 10, patch: Partial<Card> = {}): Card => ({
  ...createCard(species[id], level, { species, learnsets: learnsets as Learnsets }, rng),
  ...patch,
});

describe('판매', () => {
  it('금액 = 등급별 기본 골드 × ★ (N 100, R 200 …)', () => {
    expect(sellValue(make('16'), dex)).toBe(100);                // 구구 N ★1
    expect(sellValue(make('17', 20, { star: 3 }), dex)).toBe(600); // 피죤 R ★3
  });

  it('파티에 있는 카드는 팔 수 없고, 없는 카드는 not-found', () => {
    const a = make('16');
    const b = make('19');
    expect(sellCard([a, b], [a.uid], a.uid, dex)).toBe('in-party');
    expect(sellCard([a, b], [a.uid], 'nope', dex)).toBe('not-found');
    const r = sellCard([a, b], [a.uid], b.uid, dex);
    expect(r).toEqual({ collection: [a], gold: 100 });
  });
});

describe('파티 편성', () => {
  const cards = ['1', '4', '7', '16', '19', '25', '10'].map((id) => make(id));
  const uids = cards.map((c) => c.uid);

  it('1~6마리, 중복 없이, 보관함 카드만', () => {
    expect(setParty(cards, uids.slice(0, 6))).toEqual(uids.slice(0, 6));
    expect(setParty(cards, [])).toBe('empty');
    expect(setParty(cards, uids)).toBe('too-many');
    expect(setParty(cards, [uids[0], uids[0]])).toBe('duplicate');
    expect(setParty(cards, ['ghost'])).toBe('not-in-collection');
  });
});

describe('정렬', () => {
  it('비행 관장 상대: 전기 기술 피카츄 > 노말 구구 > 풀 이상해씨', () => {
    const pikachu = make('25', 10); // 전기쇼크
    const pidgey = make('16', 10);
    const bulba = make('1', 10);
    expect(matchupScore(pikachu, 'flying', dex)).toBeGreaterThan(matchupScore(pidgey, 'flying', dex));
    expect(matchupScore(pidgey, 'flying', dex)).toBeGreaterThan(matchupScore(bulba, 'flying', dex));
    expect(sortCards([bulba, pidgey, pikachu], 'matchup', dex, 'flying').map((c) => c.speciesId)).toEqual(['25', '16', '1']);
  });

  it('등급순(등급 → ★), 레벨순, 획득순(배열 순서 유지)', () => {
    const n = make('16', 5);
    const r = make('17', 30);
    const n3 = make('19', 50, { star: 3 });
    expect(sortCards([n, r, n3], 'rarity', dex).map((c) => c.speciesId)).toEqual(['17', '19', '16']);
    expect(sortCards([n, r, n3], 'level', dex).map((c) => c.level)).toEqual([50, 30, 5]);
    expect(sortCards([n, r, n3], 'acquired', dex)).toEqual([n, r, n3]);
  });
});
