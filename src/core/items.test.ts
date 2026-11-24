// src/core/items.test.ts  (vitest) — 회복약, 휴식, 기술머신, 상점 구성
import { describe, expect, it } from 'vitest';
import speciesList from '../data/species.json';
import moves from '../data/moves.json';
import typeChart from '../data/typeChart.json';
import learnsets from '../data/learnsets.json';
import evolutions from '../data/evolutions.json';
import tmJson from '../data/tmCompat.json';
import chaptersJson from '../data/chapters.json';
import { createCard, createRng } from './gacha';
import { HEAL_ITEMS, hpOf, maxHp, PP_ITEMS, ppOf, restorePp, restParty, rewardItems, shopStock, shopTms, teachTm, useHealItem, usePpItem, type PpMap } from './items';
import type { ChapterData, Dex, Evolutions, Learnsets, Move, Species, TmData, TypeChart } from './types';

const species = Object.fromEntries((speciesList as Species[]).map((s) => [s.id, s]));
const dex: Dex = { species, moves: moves as unknown as Record<string, Move>, typeChart: typeChart as TypeChart };
const tm = tmJson as TmData;
const chapters = chaptersJson as ChapterData[];
const rng = createRng(9);
const make = (id: string, level = 20) => createCard(species[id], level, { species, learnsets: learnsets as Learnsets }, rng);
const slugId = (slug: string) => Object.values(dex.moves).find((m) => m.slug === slug)!.id;

describe('회복약', () => {
  const c = make('143', 30);
  const max = maxHp(c, dex);

  it('기록이 없으면 가득, 상처약은 20 회복하되 최대 HP를 넘지 않는다', () => {
    expect(hpOf(c, {}, dex)).toBe(max);
    expect(useHealItem('potion', c, { [c.uid]: 10 }, dex)).toEqual({ [c.uid]: 30 });
    expect(useHealItem('hyper-potion', c, { [c.uid]: max - 5 }, dex)).toEqual({ [c.uid]: max });
  });

  it('가득 찼거나 쓰러진 포켓몬에는 못 쓰고, 기력의조각은 쓰러진 포켓몬만 절반으로 되살린다', () => {
    expect(useHealItem('potion', c, {}, dex)).toBe('full');
    expect(useHealItem('potion', c, { [c.uid]: 0 }, dex)).toBe('fainted');
    expect(useHealItem('revive', c, { [c.uid]: 5 }, dex)).toBe('not-fainted');
    expect(useHealItem('revive', c, { [c.uid]: 0 }, dex)).toEqual({ [c.uid]: Math.floor(max / 2) });
    expect(useHealItem('nope', c, {}, dex)).toBe('unknown-item');
  });

  it('휴식: 쓰러진 포켓몬까지 전원 회복, 비율을 주면 그만큼만', () => {
    const d = make('25', 20);
    const hp = { [c.uid]: 0, [d.uid]: 3 };
    expect(restParty([c, d], hp, dex)).toEqual({ [c.uid]: max, [d.uid]: maxHp(d, dex) });
    expect(restParty([c], hp, dex, 0.5)[c.uid]).toBe(Math.ceil(max * 0.5));
  });
});

describe('기술머신', () => {
  it('배울 수 있는 종만 배우고, 빈 칸이 있으면 자동 장착', () => {
    const rockTomb = slugId('rock-tomb');
    const geodude = make('74', 5);
    const r = teachTm(geodude, rockTomb, tm);
    if (typeof r === 'string') throw new Error(r);
    expect(r.learnedMoves).toContain(rockTomb);
    expect(teachTm(r, rockTomb, tm)).toBe('already-known');
    expect(teachTm(make('129'), rockTomb, tm)).toBe('cannot-learn'); // 잉어킹
    expect(teachTm(geodude, slugId('tackle'), tm)).toBe('not-a-tm');
  });
});

describe('상점', () => {
  it('여러 타입 관장(그린·레드) 챕터 기술머신: 위력이 가장 높은 공격기 3개', () => {
    const blue = chapters.find((c) => c.chapter === 21)!;
    expect(blue.type).toBeNull();
    const list = shopTms(blue, tm, dex);
    expect(list).toHaveLength(3);
    expect(list.map((m) => m.move.power)).toEqual([...list.map((m) => m.move.power!)].sort((a, b) => b - a));
  });

  it('챕터 기술머신: 관장 타입에 효과가 굉장한 공격기 최대 3개, 위력이 낮은 순 (전기는 땅 기술 2개뿐)', () => {
    for (const ch of chapters) {
      const list = shopTms(ch, tm, dex);
      expect(list.length).toBe(ch.type === 'electric' ? 2 : 3);
      if (!ch.type) continue; // 여러 타입 관장은 아래에서
      for (const m of list) expect(dex.typeChart[m.move.type][ch.type]).toBe(2);
      expect(list.map((m) => m.move.power)).toEqual([...list.map((m) => m.move.power!)].sort((a, b) => a - b));
    }
  });

  it('구성: 회복약 4 + 진화의돌 6 + 기술머신 3, 가격은 spec 값', () => {
    const stock = shopStock(chapters[0], tm, dex, evolutions as Evolutions);
    expect(stock.filter((i) => i.category === 'heal').map((i) => [i.name, i.price])).toEqual([['상처약', 300], ['좋은상처약', 700], ['고급상처약', 1200], ['기력의조각', 1500]]);
    expect(stock.filter((i) => i.category === 'stone').map((i) => i.name)).toEqual(['불꽃의돌', '물의돌', '천둥의돌', '리프의돌', '달의돌', '태양의돌']);
    expect(stock.filter((i) => i.category === 'stone').every((i) => i.price === 2100)).toBe(true);
    expect(stock.filter((i) => i.category === 'tm').every((i) => i.price === 3000 && i.moveId)).toBe(true);
  });
});

describe('승리 보상 약', () => {
  it('야생·트레이너 1개, 엘리트·관장 2개. PP 회복약도 섞여 나오고, 관장은 상처약·PP에이드가 없다', () => {
    const rng = createRng(9);
    const seen = { wild: new Set<string>(), leader: new Set<string>() };
    for (let i = 0; i < 2000; i++) {
      const w = rewardItems('wild', rng);
      expect(w).toHaveLength(1);
      seen.wild.add(w[0]);
      expect(rewardItems('trainer', rng)).toHaveLength(1);
      expect(rewardItems('elite', rng)).toHaveLength(2);
      for (const id of rewardItems('leader', rng)) seen.leader.add(id);
    }
    expect(seen.wild.has('hyper-potion')).toBe(false);
    expect(seen.wild.has('ether')).toBe(true);
    expect(seen.leader.has('potion')).toBe(false);
    expect(seen.leader.has('ether')).toBe(false);
    const known = new Set([...HEAL_ITEMS, ...PP_ITEMS].map((i) => i.id));
    for (const id of [...seen.wild, ...seen.leader]) expect(known.has(id)).toBe(true);
  });
});

describe('PP', () => {
  const card = { ...make('25'), moves: ['84', '98'] }; // 전기쇼크(30), 전광석화(30)
  it('기록이 없으면 가득, PP에이드는 기술 1개 +10, PP맥스는 전부 가득', () => {
    expect(ppOf(card, '84', {}, dex)).toBe(30);
    const pp = { [card.uid]: { '84': 5, '98': 0 } };
    expect(usePpItem('ether', card, pp, dex)).toBe('need-move');
    const one = usePpItem('ether', card, pp, dex, '84') as PpMap;
    expect(one[card.uid]).toEqual({ '84': 15, '98': 0 });
    const all = usePpItem('max-elixir', card, pp, dex) as PpMap;
    expect(ppOf(card, '84', all, dex)).toBe(30);
    expect(ppOf(card, '98', all, dex)).toBe(30);
    expect(usePpItem('elixir', card, {}, dex)).toBe('full');
  });
  it('휴식하면 파티 PP가 가득 찬다', () => {
    expect(restorePp([card], { [card.uid]: { '84': 1 }, other: { '1': 2 } })).toEqual({ other: { '1': 2 } });
  });
});
