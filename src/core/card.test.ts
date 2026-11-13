// src/core/card.test.ts  (vitest) — 카드 성장·팩 개봉·자동 합치기 규칙 검증
import { describe, expect, it } from 'vitest';
import speciesList from '../data/species.json';
import learnsets from '../data/learnsets.json';
import { allocateIv, dupNeeded, effectiveIvs, equipMoves, mergeDuplicate, MAXED_DUP_GOLD, STAR_POINTS } from './card';
import { addToCollection, createCard, createRng, lineRootOf, openPack, STARTER_IDS, type GachaDex } from './gacha';
import type { Card, Learnsets, Species } from './types';

const species = Object.fromEntries((speciesList as Species[]).map((s) => [s.id, s]));
const dex: GachaDex = { species, learnsets: learnsets as Learnsets };
const rng = createRng(1);
const fresh = (id: string, level = 5) => createCard(species[id], level, dex, rng);

describe('진화 계열', () => {
  it('리자몽·리자드의 계열 = 파이리', () => {
    expect(lineRootOf('6', species)).toBe('4');
    expect(lineRootOf('5', species)).toBe('4');
  });
  it('베이리프 카드로 치코리타 카드가 합쳐짐', () => {
    const { results } = addToCollection([fresh('152')], [fresh('153')], species);
    expect(results[0].kind).toBe('star-up');
  });
});

describe('★등급: 중복 1/2/3/4장', () => {
  it('★1→★2는 1장, ★2→★3는 2장, ★3→★4는 3장, ★4→★5는 4장 (총 10장)', () => {
    let col: Card[] = [fresh('152')];
    const stars: number[] = [];
    for (let i = 0; i < 10; i++) {
      col = addToCollection(col, [fresh('152')], species).collection;
      stars.push(col[0].star);
    }
    expect(stars).toEqual([2, 2, 3, 3, 3, 4, 4, 4, 4, 5]);
  });
  it('등급 상승마다 포인트 +8/+10/+12/+16 (총 46)', () => {
    let col: Card[] = [fresh('152')];
    for (let i = 0; i < 10; i++) col = addToCollection(col, [fresh('152')], species).collection;
    expect(col[0].ivPoints).toBe(STAR_POINTS.reduce((a, b) => a + b, 0));
    expect(col[0].ivPoints).toBe(46);
  });
  it('★5 이후 중복은 골드로 환산', () => {
    const maxed: Card = { ...fresh('152'), star: 5 };
    const r = addToCollection([maxed], [fresh('152')], species);
    expect(r.results[0].kind).toBe('gold');
    expect(r.gold).toBe(MAXED_DUP_GOLD.N);
    expect(r.collection[0].star).toBe(5);
  });
  it('합치면 레벨은 높은 쪽, 기술은 합집합, 장착 기술은 유지', () => {
    const base = fresh('152', 5);
    const dup = fresh('152', 20);
    const r = mergeDuplicate(base, dup, 'N');
    expect(r.card.level).toBe(20);
    expect(new Set(r.card.learnedMoves)).toEqual(new Set([...base.learnedMoves, ...dup.learnedMoves]));
    expect(r.card.moves).toEqual(base.moves);
  });
  it('dupNeeded: 다음 ★까지 남은 장수', () => {
    expect(dupNeeded({ ...fresh('152'), star: 3, dupProgress: 1 })).toBe(2);
    expect(dupNeeded({ ...fresh('152'), star: 5 })).toBeNull();
  });
});

describe('개체값 포인트 (2V 상한)', () => {
  const base = (): Card => ({
    ...fresh('152'),
    ivBase: { hp: 20, atk: 20, def: 20, spAtk: 20, spDef: 20, spd: 20 },
    ivPoints: 46,
  });
  const pump = (c: Card, stat: keyof Card['ivBase'], n: number) => {
    for (let i = 0; i < n; i++) {
      const r = allocateIv(c, stat, 1);
      if (typeof r === 'string') return r;
      c = r;
    }
    return c;
  };
  it('두 스탯까지는 31 가능, 세 번째는 30에서 멈춤', () => {
    let c = pump(base(), 'atk', 11) as Card;
    c = pump(c, 'spd', 11) as Card;
    expect(effectiveIvs(c).atk).toBe(31);
    expect(effectiveIvs(c).spd).toBe(31);
    const third = pump(c, 'hp', 11);
    expect(third).toBe('perfect-limit');
    const stopped = pump(c, 'hp', 10) as Card;
    expect(effectiveIvs(stopped).hp).toBe(30);
  });
  it('포인트가 없으면 거부, 회수하면 포인트 반환', () => {
    const c = { ...base(), ivPoints: 0 };
    expect(allocateIv(c, 'atk', 1)).toBe('no-points');
    const up = allocateIv({ ...base() }, 'atk', 1) as Card;
    const down = allocateIv(up, 'atk', -1) as Card;
    expect(down.ivPoints).toBe(46);
    expect(down.ivAlloc.atk).toBe(0);
  });
});

describe('기술 장착 (기억머신 상시)', () => {
  it('배운 기술 중 1~4개만 장착 가능', () => {
    const c = fresh('152', 20);
    expect(c.learnedMoves.length).toBeGreaterThan(4);
    expect(c.moves.length).toBe(4);
    const ok = equipMoves(c, c.learnedMoves.slice(0, 2));
    expect(typeof ok).not.toBe('string');
    expect(equipMoves(c, ['99999'])).toBe('invalid');
    expect(equipMoves(c, c.learnedMoves.slice(0, 5))).toBe('invalid');
  });
});

describe('카드팩', () => {
  it('속성 팩: 5장, 모두 해당 속성', () => {
    const cards = openPack({ kind: 'type', cardsPerPack: 5, typeFilter: 'grass', level: 8 }, dex, createRng(3));
    expect(cards).toHaveLength(5);
    for (const c of cards) {
      expect(species[c.speciesId].types).toContain('grass');
      expect(c.level).toBe(8);
    }
  });
  it('엘리트 팩(R 이상)·관장 팩(SR 이상): 하한 미만 등급이 안 나옴', () => {
    const order = ['N', 'R', 'SR', 'UR'];
    for (let seed = 0; seed < 200; seed++) {
      for (const min of ['R', 'SR'] as const) {
        for (const c of openPack({ kind: 'type', cardsPerPack: 5, typeFilter: 'bug', minRarity: min, level: 10 }, dex, createRng(seed))) {
          expect(order.indexOf(species[c.speciesId].rarity)).toBeGreaterThanOrEqual(order.indexOf(min));
        }
      }
    }
  });
  it('스타터 팩: 27종 스타터 중 서로 다른 5장', () => {
    const cards = openPack({ kind: 'starter', cardsPerPack: 5, level: 5 }, dex, createRng(9));
    expect(new Set(cards.map((c) => c.speciesId)).size).toBe(5);
    for (const c of cards) expect(STARTER_IDS).toContain(c.speciesId);
  });
  it('등급 확률이 대략 N60/R30/SR8/UR2 (전체 풀 2만 장)', () => {
    const count: Record<string, number> = { N: 0, R: 0, SR: 0, UR: 0 };
    const r = createRng(42);
    for (let i = 0; i < 4000; i++) for (const c of openPack({ kind: 'type', cardsPerPack: 5, level: 5 }, dex, r)) count[species[c.speciesId].rarity]++;
    expect(count.N / 20000).toBeCloseTo(0.6, 1);
    expect(count.R / 20000).toBeCloseTo(0.3, 1);
    expect(count.SR / 20000).toBeCloseTo(0.08, 1);
    expect(count.UR / 20000).toBeCloseTo(0.02, 1);
  });
});
