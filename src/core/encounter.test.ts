// src/core/encounter.test.ts  (vitest) — 원본 트레이너 → 전투용 카드
import { describe, expect, it } from 'vitest';
import speciesList from '../data/species.json';
import moves from '../data/moves.json';
import learnsets from '../data/learnsets.json';
import trainers from '../data/trainers.json';
import { learnableUpTo, defaultEquip } from './card';
import { trainerCards, type EncounterDex } from './encounter';
import type { Learnsets, Move, Species, Trainer } from './types';

const species = Object.fromEntries((speciesList as Species[]).map((s) => [s.id, s]));
const dex: EncounterDex = { species, moves: moves as unknown as Record<string, Move>, learnsets: learnsets as Learnsets };
const all = trainers as Trainer[];

describe('trainerCards', () => {
  it('비상: 원작 파티(구구 Lv9, 피죤 Lv13)와 원작 기술, 전 스탯 같은 개체값', () => {
    const falkner = all.find((t) => t.key === 'falkner' && t.battle === 'story')!;
    const cards = trainerCards(falkner, dex);
    expect(cards.map((c) => [c.speciesId, c.level])).toEqual([['16', 9], ['17', 13]]);
    expect(cards[1].moves).toEqual(falkner.party[1].moves);
    expect(cards[1].lineId).toBe('16');
    expect(new Set(Object.values(cards[0].ivBase))).toEqual(new Set([falkner.party[0].iv]));
  });

  it('기술이 비어 있는 일반 트레이너는 레벨업 기본 기술 4개', () => {
    const t = all.find((x) => x.role === 'trainer' && x.party.every((p) => !p.moves.length))!;
    const [c] = trainerCards(t, dex);
    const p = t.party[0];
    expect(c.moves).toEqual(defaultEquip(learnableUpTo(dex.learnsets[p.speciesId], p.level)));
    expect(c.moves.length).toBeGreaterThan(0);
  });

  it('전원 변환 가능: 모든 카드가 기술 1개 이상, uid 중복 없음', () => {
    const uids = new Set<string>();
    for (const t of all) {
      for (const c of trainerCards(t, dex)) {
        expect(c.moves.length, `${t.index}`).toBeGreaterThan(0);
        expect(uids.has(c.uid)).toBe(false);
        uids.add(c.uid);
      }
    }
  });
});
