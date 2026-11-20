// src/core/progress.test.ts  (vitest) — 경험치·레벨업·기술 습득·진화 (spec §4.4~4.6)
import { describe, expect, it } from 'vitest';
import speciesList from '../data/species.json';
import moves from '../data/moves.json';
import typeChart from '../data/typeChart.json';
import learnsets from '../data/learnsets.json';
import expTable from '../data/expTable.json';
import evolutions from '../data/evolutions.json';
import { battle, createBattle } from './battle';
import { learnableUpTo } from './card';
import { createCard, createRng } from './gacha';
import {
  addLevels, distributeExp, evolutionItems, evolve, evolveWithItem, expForLevel, expYield,
  gainExp, levelEvolutions, levelForExp, MAX_LEVEL, type ProgressDex,
} from './progress';
import type { Dex, Evolutions, Learnsets, Move, Species, TypeChart } from './types';

const species = Object.fromEntries((speciesList as Species[]).map((s) => [s.id, s]));
const ls = learnsets as Learnsets;
const dex: ProgressDex = { species, learnsets: ls, expTable, evolutions: evolutions as Evolutions };
const battleDex: Dex = { species, moves: moves as unknown as Record<string, Move>, typeChart: typeChart as TypeChart };
const rng = createRng(1);
const fresh = (id: string, level: number) => createCard(species[id], level, { species, learnsets: ls }, rng);
const expAt = (id: string, level: number) => expForLevel(expTable, species[id].growthRate, level);
const moveId = (slug: string) => Object.values(battleDex.moves).find((m) => m.slug === slug)!.id;

describe('경험치 공식 (4세대)', () => {
  it('야생 floor(b×L/7), 트레이너 ×1.5, 참여자 수로 나눔', () => {
    expect(expYield(50, 10, 1, false)).toBe(71);  // 500/7 = 71.4
    expect(expYield(50, 10, 1, true)).toBe(107);  // 750/7 = 107.1
    expect(expYield(50, 10, 2, false)).toBe(35);  // 500/7/2 = 35.7
    expect(expYield(50, 10, 0, false)).toBe(0);
  });

  it('성장 곡선: medium(중간 빠름) Lv50 = 125,000, 경계값', () => {
    expect(expForLevel(expTable, 'medium', 50)).toBe(125000);
    expect(levelForExp(expTable, 'medium', 124999)).toBe(49);
    expect(levelForExp(expTable, 'medium', 125000)).toBe(50);
    expect(levelForExp(expTable, 'medium', 10 ** 9)).toBe(MAX_LEVEL);
  });

  it('전투 결과: 쓰러뜨린 상대의 경험치를 참여자끼리 나눔', () => {
    const a = fresh('143', 50);
    const b = fresh('445', 100);
    b.moves = [moveId('earthquake')];
    let s = createBattle([a, b], [fresh('4', 5)], battleDex, 1);
    s = battle(s, { kind: 'switch', toIdx: 1 }, battleDex);
    s = battle(s, { kind: 'move', moveId: moveId('earthquake') }, battleDex);
    const each = expYield(species['4'].baseExp, 5, 2, true);
    expect(distributeExp(s, true, species)).toEqual({ [a.uid]: each, [b.uid]: each });
  });
});

describe('레벨업과 기술 습득', () => {
  it('파이리 Lv5 → Lv13: 사이 레벨 기술을 배우고 빈 칸에만 자동 장착', () => {
    const c = fresh('4', 5); // 할퀴기, 울음소리, 불꽃세례 장착 (3칸)
    expect(c.moves).toHaveLength(3);
    const r = gainExp(c, expAt('4', 13) - expAt('4', 5), dex);
    expect(r.fromLevel).toBe(5);
    expect(r.toLevel).toBe(13);
    expect(r.newMoves).toEqual(['108', '225']); // Lv8 연막, Lv12 용의숨결
    expect(r.card.moves).toEqual([...c.moves, '108']); // 4칸 꽉 참 → 용의숨결은 배우기만
    expect(r.card.learnedMoves).toContain('225');
  });

  it('exp 0으로 만든 팩 카드도 현재 레벨 경험치에서 출발', () => {
    const c = fresh('4', 20);
    expect(c.exp).toBe(0);
    expect(gainExp(c, 1, dex).card.exp).toBe(expAt('4', 20) + 1);
  });

  it('레벨 캡: 캡 레벨의 경험치에서 멈추고 더 쌓이지 않음', () => {
    const r = gainExp(fresh('4', 5), 10 ** 7, dex, 10);
    expect(r.card.level).toBe(10);
    expect(r.card.exp).toBe(expAt('4', 10));
    expect(gainExp(r.card, 500, dex, 10).card.exp).toBe(expAt('4', 10));
  });

  it('최대 Lv100', () => {
    expect(gainExp(fresh('4', 5), 10 ** 9, dex).card.level).toBe(MAX_LEVEL);
  });

  it('강화 노드도 레벨 캡까지만, 이미 캡 이상이면 그대로', () => {
    expect(addLevels(fresh('4', 11), 3, dex, 13).toLevel).toBe(13);
    expect(addLevels(fresh('4', 15), 3, dex, 13).toLevel).toBe(15);
  });

  it('강화 노드: 레벨 +3, 그 사이 기술도 배움', () => {
    const r = addLevels(fresh('4', 6), 3, dex);
    expect(r.toLevel).toBe(9);
    expect(r.newMoves).toEqual(['108']);
  });
});

describe('진화', () => {
  it('파이리 Lv16에서 리자드 진화 가능, Lv15는 불가', () => {
    expect(levelEvolutions(fresh('4', 15), dex)).toEqual([]);
    const r = gainExp(fresh('4', 15), expAt('4', 16) - expAt('4', 15), dex);
    expect(r.evolutions.map((e) => e.to)).toEqual(['5']);
  });

  it('진화: 종만 바뀌고 계열 유지, 새 종이 현재 레벨까지 배우는 기술 습득', () => {
    const c = fresh('4', 20);
    expect(evolve(fresh('4', 15), '5', dex)).toBe('invalid');
    const r = evolve(c, '5', dex);
    if (r === 'invalid') throw new Error('진화 실패');
    expect(r.card.speciesId).toBe('5');
    expect(r.card.lineId).toBe('4');
    expect(r.card.uid).toBe(c.uid);
    for (const m of learnableUpTo(ls['5'], 20)) expect(r.card.learnedMoves).toContain(m);
    expect(r.newMoves).toEqual([]); // 리자드가 Lv20까지 배우는 기술은 파이리 때 이미 다 배움 (중복 추가 없음)
  });

  it('진화 시 기술(레벨 0): 피카츄 → 라이츄는 번개펀치를 배움', () => {
    const r = evolveWithItem(fresh('25', 20), 'thunder-stone', dex);
    expect(r !== 'invalid' && r.newMoves).toContain('9');
  });

  it('진화 도구: 이브이 + 물의돌 = 샤미드, 맞지 않는 도구는 거부', () => {
    const eevee = fresh('133', 20);
    expect(evolutionItems(eevee, dex)).toEqual(expect.arrayContaining(['water-stone', 'leaf-stone']));
    const r = evolveWithItem(eevee, 'water-stone', dex);
    expect(r !== 'invalid' && r.card.speciesId).toBe('134');
    expect(evolveWithItem(fresh('25', 20), 'fire-stone', dex)).toBe('invalid');
  });

  it('친밀도 진화는 Lv22 대체: 이브이 Lv21 불가, Lv22면 에브이·블래키·님피아 후보', () => {
    expect(levelEvolutions(fresh('133', 21), dex)).toEqual([]);
    expect(levelEvolutions(fresh('133', 22), dex).map((e) => e.to).sort()).toEqual(['196', '197', '700']);
  });

  it('교환 진화는 Lv36 대체: 고우스트 Lv35 불가, Lv36 팬텀', () => {
    expect(levelEvolutions(fresh('93', 35), dex)).toEqual([]);
    expect(levelEvolutions(fresh('93', 36), dex)).toEqual([{ to: '94', method: 'substitute', level: 36, reason: 'trade' }]);
  });

  it('갈래 진화: 배루키 Lv20에서 세 갈래 모두 후보', () => {
    expect(levelEvolutions(fresh('236', 20), dex).map((e) => e.to).sort()).toEqual(['106', '107', '237']);
  });
});
