// src/core/encounter.test.ts  (vitest) — 원본 트레이너 → 전투용 카드
import { describe, expect, it } from 'vitest';
import speciesList from '../data/species.json';
import moves from '../data/moves.json';
import learnsets from '../data/learnsets.json';
import trainers from '../data/trainers.json';
import { learnableUpTo, defaultEquip } from './card';
import chaptersJson from '../data/chapters.json';
import { battleGold, nodeOpponent, nodeSeed, rewardMinRarity, rewardPackLevel, trainerCards, wildCard, type EncounterDex } from './encounter';
import { createRng } from './gacha';
import type { MapNode } from './map';
import type { ChapterData, Difficulty, Learnsets, Move, Species, Trainer } from './types';

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

describe('지도 노드의 상대', () => {
  const ch1 = (chaptersJson as ChapterData[])[0];
  const node = (kind: MapNode['kind'], floor = 4, index = 0, rival = false): MapNode => ({ id: `${floor}-${index}`, floor, index, x: 0.5, kind, rival, next: [] });
  const ctx = (seed = 1, starter: 'grass' | 'fire' | 'water' = 'fire', difficulty: Difficulty = 'normal') => ({ totalFloors: 10, chapter: ch1, trainers: all, starterType: starter, difficulty, seed });
  const opp = (n: MapNode, seed = 1, starter: 'grass' | 'fire' | 'water' = 'fire', difficulty: Difficulty = 'normal') => nodeOpponent(n, ctx(seed, starter, difficulty), dex)!;

  it('야생: 출현표에 있는 종, 레벨은 출현 범위 안 (1000번)', () => {
    const rng = createRng(3);
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const c = wildCard(ch1, dex, rng);
      const e = ch1.wild.find((w) => w.speciesId === c.speciesId)!;
      expect(e).toBeDefined();
      expect(c.level >= e.minLevel && c.level <= e.maxLevel).toBe(true);
      seen.add(c.speciesId);
    }
    expect(seen.size).toBe(ch1.wild.length); // 확률이 낮은 종도 나온다
  });

  it('같은 노드는 다시 도전해도 같은 상대, 다른 노드는 다른 시드', () => {
    expect(opp(node('trainer'))).toEqual(opp(node('trainer')));
    expect(opp(node('wild'))).toEqual(opp(node('wild')));
    expect(nodeSeed(1, 1, { floor: 4, index: 0 })).not.toBe(nodeSeed(1, 1, { floor: 4, index: 1 }));
  });

  it('트레이너는 챕터 풀에서, 엘리트는 풀에서 가장 강한 쪽에서 나온다', () => {
    const levels = ch1.trainers.map((i) => Math.max(...all.find((t) => t.index === i)!.party.map((p) => p.level))).sort((a, b) => b - a);
    for (let seed = 1; seed <= 50; seed++) {
      const t = opp(node('trainer'), seed);
      expect(Math.max(...t.cards.map((c) => c.level))).toBeLessThanOrEqual(ch1.trainerLevel.upTo);
      expect(Math.max(...opp(node('elite'), seed).cards.map((c) => c.level))).toBeGreaterThanOrEqual(levels[4]);
    }
  });

  it('트레이너는 층이 높을수록 강하다: 1층은 풀의 약한 쪽, 8층은 강한 쪽', () => {
    const top = (floor: number, seed: number) => Math.max(...opp(node('trainer', floor), seed).cards.map((c) => c.level));
    const avg = (floor: number) => Array.from({ length: 100 }, (_, s) => top(floor, s + 1)).reduce((a, b) => a + b, 0) / 100;
    for (let seed = 1; seed <= 100; seed++) expect(top(1, seed)).toBeLessThanOrEqual(7); // 풀(Lv3~13)의 아래 25%: 스타터(팩 Lv6)로 싸울 만한 상대
    expect(avg(1)).toBeLessThan(avg(4));
    expect(avg(4)).toBeLessThan(avg(8));
    expect(avg(8)).toBeGreaterThan(10);
  });

  it('라이벌 노드: 내 스타터에 유리한 스타터를 가진 라이벌', () => {
    const line = { grass: '155', fire: '158', water: '152' } as const;
    for (const starter of ['grass', 'fire', 'water'] as const) {
      const r = opp(node('elite', 4, 0, true), 1, starter);
      expect(r).toMatchObject({ rival: true, name: '라이벌' });
      expect(r.cards.map((c) => c.lineId)).toContain(line[starter]);
    }
  });

  it('관장은 원작 파티, 상점·휴식은 상대 없음', () => {
    expect(opp(node('leader', 10)).cards.map((c) => [c.speciesId, c.level])).toEqual([['16', 9], ['17', 13]]);
    expect(nodeOpponent(node('shop'), ctx(), dex)).toBeNull();
    expect(nodeOpponent(node('rest'), ctx(), dex)).toBeNull();
  });

  it('보상: 골드와 팩 최소 등급', () => {
    expect(battleGold(opp(node('leader', 10)))).toBe(13 * 120);
    const wild = opp(node('wild'));
    expect(battleGold(wild)).toBe(50 + wild.cards[0].level * 5);
    const tr = opp(node('trainer'));
    expect(battleGold({ ...tr, kind: 'elite' })).toBe(battleGold(tr) * 2);
    expect([rewardMinRarity('wild'), rewardMinRarity('trainer'), rewardMinRarity('elite'), rewardMinRarity('leader')]).toEqual([undefined, undefined, 'R', 'SR']);
  });

  it('난이도: 트레이너 레벨 보정, 쉬움은 무작위 AI, 어려움 관장은 1마리 더, 야생은 레벨만', () => {
    const lv = (d: Difficulty) => opp(node('leader', 10), 1, 'fire', d).cards.map((c) => c.level);
    expect(lv('normal')).toEqual([9, 13]);
    expect(lv('easy')).toEqual([7, 11]);
    expect(lv('hard')).toEqual([12, 16, 16]); // 원작 2마리 + 재대결 에이스(Lv13으로 스케일) 모두 +3
    expect(opp(node('trainer'), 1, 'fire', 'easy').randomAi).toBe(true);
    expect(opp(node('trainer'), 1, 'fire', 'normal').randomAi).toBe(false);
    const wN = opp(node('wild'), 1, 'fire', 'normal').cards[0];
    const wE = opp(node('wild'), 1, 'fire', 'hard').cards[0];
    expect(wE.speciesId).toBe(wN.speciesId);
    expect(wE.level).toBe(wN.level + 3);
    expect(wE.ivBase).toEqual(wN.ivBase); // 야생 개체값은 난이도와 무관
  });

  it('보상 팩 카드 레벨: 상대 최고 레벨 − 2, 챕터 야생 최고 레벨 이상, 레벨 캡 이하', () => {
    const leader = opp(node('leader', 10)); // 비상 에이스 Lv13
    expect(rewardPackLevel(leader, ch1, 'normal')).toBe(11);
    const wild = opp(node('wild', 1));
    expect(rewardPackLevel(wild, ch1, 'normal')).toBe(ch1.packLevel); // 야생 Lv2~4 → 야생 최고 Lv6
    const hardLeader = opp(node('leader', 10), 1, 'fire', 'hard'); // 에이스 Lv16
    expect(rewardPackLevel(hardLeader, ch1, 'hard')).toBe(13); // 16 − 2 = 14지만 레벨 캡 13
  });
});
