// src/core/ai.test.ts (vitest) — 어려움(smart)·익스트림(expert) 상대 AI
import { describe, expect, it } from 'vitest';
import speciesList from '../data/species.json';
import moves from '../data/moves.json';
import typeChart from '../data/typeChart.json';
import { smartEnemyAction } from './ai';
import { createBattle, expectedDamage } from './battle';
import type { BattleState, Card, Dex, Move, Species, TypeChart } from './types';

const dex: Dex = {
  species: Object.fromEntries((speciesList as Species[]).map((s) => [s.id, s])),
  moves: moves as unknown as Record<string, Move>,
  typeChart: typeChart as TypeChart,
};
const moveId = (slug: string) => Object.values(dex.moves).find((m) => m.slug === slug)!.id;
const IV = { hp: 31, atk: 31, def: 31, spAtk: 31, spDef: 31, spd: 31 };
const ZERO = { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0 };
const card = (speciesId: string, level: number, slugs: string[]): Card => ({
  uid: `${speciesId}-${level}`, speciesId, lineId: speciesId, level, exp: 0, star: 1, dupProgress: 0,
  ivBase: IV, ivAlloc: ZERO, ivPoints: 0, learnedMoves: slugs.map(moveId), moves: slugs.map(moveId), heldItem: null,
});
const battleOf = (player: Card[], enemy: Card[]): BattleState => createBattle(player, enemy, dex, 1, { ai: 'smart' });

describe('교체', () => {
  // 상대: 이상해꽃(풀) → 내 리자몽의 화염방사에 크게 맞고, 풀 기술은 리자몽에게 반감
  const make = () => battleOf([card('6', 50, ['flamethrower'])], [card('3', 45, ['razor-leaf']), card('9', 45, ['surf'])]);

  it('크게 맞고 거의 못 때리면 잘 싸울 벤치 포켓몬(거북왕)으로 교체한다', () => {
    expect(smartEnemyAction(make(), dex, 'smart')).toEqual({ kind: 'switch', toIdx: 1 });
  });

  it('지난 턴에 교체했으면 이번 턴은 교체하지 않는다', () => {
    const s = make();
    s.turn = 5;
    s.enemySwitchTurn = 4;
    expect(smartEnemyAction(s, dex, 'smart').kind).toBe('move');
  });

  it('익스트림: 상대가 먼저 움직여 나를 쓰러뜨리고 내가 먼저 쓰러뜨릴 수 없으면 교체 (어려움은 그대로 싸움)', () => {
    // 상대 딱구리(느림, 몸통박치기) vs 내 리자몽(빠름). 딱구리는 HP 1, 몸통박치기로 리자몽 남은 HP의 절반을 깎는다
    const s = battleOf([card('6', 50, ['flamethrower'])], [card('76', 40, ['tackle']), card('9', 50, ['surf'])]);
    const golem = s.enemy.party[0];
    const zard = s.player.party[0];
    golem.currentHp = 1;
    zard.currentHp = Math.ceil(expectedDamage(golem, zard, dex.moves[moveId('tackle')], dex) * 2);
    expect(smartEnemyAction(s, dex, 'smart').kind).toBe('move');
    expect(smartEnemyAction(s, dex, 'expert')).toEqual({ kind: 'switch', toIdx: 1 });
  });
});

describe('기술 고르기', () => {
  it('버틸 만하면 상대가 멀쩡할 때 마비부터 건다 (공격이 약할 때)', () => {
    const s = battleOf([card('143', 30, ['splash'])], [card('25', 30, ['thunder-wave', 'tackle'])]);
    expect(smartEnemyAction(s, dex, 'smart')).toEqual({ kind: 'move', moveId: moveId('thunder-wave') });
  });

  it('이미 상태이상이면 걸지 않고 공격한다', () => {
    const s = battleOf([card('143', 30, ['splash'])], [card('25', 30, ['thunder-wave', 'tackle'])]);
    s.player.party[0].ailment = 'burn';
    expect(smartEnemyAction(s, dex, 'smart')).toEqual({ kind: 'move', moveId: moveId('tackle') });
  });

  it('땅 타입에는 전기자석파를 쓰지 않는다', () => {
    const s = battleOf([card('50', 30, ['splash'])], [card('25', 30, ['thunder-wave', 'tackle'])]);
    expect(smartEnemyAction(s, dex, 'smart')).toEqual({ kind: 'move', moveId: moveId('tackle') });
  });

  it('선공기로 쓰러뜨릴 수 있으면 선공기', () => {
    const s = battleOf([card('6', 50, ['flamethrower'])], [card('20', 40, ['quick-attack', 'hyper-fang'])]);
    s.player.party[0].currentHp = 1;
    expect(smartEnemyAction(s, dex, 'smart')).toEqual({ kind: 'move', moveId: moveId('quick-attack') });
  });

  it('HP가 넉넉하고 상대가 약하면 능력을 올린다 (칼춤)', () => {
    // 잠만보는 한 방에 쓰러뜨릴 수 없고, 잠만보의 몸통박치기는 스라크에게 약하다
    const s = battleOf([card('143', 30, ['tackle'])], [card('123', 40, ['swords-dance', 'wing-attack'])]);
    expect(smartEnemyAction(s, dex, 'smart')).toEqual({ kind: 'move', moveId: moveId('swords-dance') });
  });
});
