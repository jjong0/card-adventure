// src/core/battle.test.ts  (vitest)
import { describe, expect, it } from 'vitest';
import speciesList from '../data/species.json';
import moves from '../data/moves.json';
import typeChart from '../data/typeChart.json';
import learnsets from '../data/learnsets.json';
import { battle, calcDamage, calcStats, createBattle, fixJosa, typeEffectiveness } from './battle';
import { createRng } from './gacha';
import { defaultEquip, learnableUpTo } from './card';
import type { BattleState, Card, Dex, Learnsets, Move, Species, TypeChart } from './types';

const dex: Dex = {
  species: Object.fromEntries((speciesList as Species[]).map((s) => [s.id, s])),
  moves: moves as unknown as Record<string, Move>,
  typeChart: typeChart as TypeChart,
};
const moveId = (slug: string) => Object.values(dex.moves).find((m) => m.slug === slug)!.id;
const IV31 = { hp: 31, atk: 31, def: 31, spAtk: 31, spDef: 31, spd: 31 };
const ZERO = { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0 };
const makeCard = (speciesId: string, level: number, moves: string[]): Card => ({
  uid: `${speciesId}-${level}`, speciesId, lineId: speciesId, level, exp: 0, star: 1, dupProgress: 0,
  ivBase: IV31, ivAlloc: ZERO, ivPoints: 0, learnedMoves: moves, moves, heldItem: null,
});
const card = (speciesId: string, level: number, moveSlugs: string[]): Card => makeCard(speciesId, level, moveSlugs.map(moveId));

describe('능력치', () => {
  it('한카리아스 Lv100 개체값 31 노력치 0: HP 357 / 공격 296', () => {
    const s = calcStats(dex.species['445'].baseStats, IV31, 100);
    expect(s.hp).toBe(357);
    expect(s.atk).toBe(296);
  });
  it('껍질몬은 HP 1 고정', () => {
    expect(calcStats(dex.species['292'].baseStats, IV31, 50).hp).toBe(1);
  });
});

describe('데미지 공식', () => {
  // 원작 공식 예시: Lv75 글레이시아(공격 123) 얼음엄니(65) → 한카리아스(방어 163), 자속·4배 → 168~196
  const base = { level: 75, power: 65, attack: 123, defense: 163, stab: true, effectiveness: 4, crit: false, burned: false };
  it('최소 난수 85 → 168', () => expect(calcDamage({ ...base, randomRoll: 85 })).toBe(168));
  it('최대 난수 100 → 196', () => expect(calcDamage({ ...base, randomRoll: 100 })).toBe(196));
  it('무효면 0', () => expect(calcDamage({ ...base, effectiveness: 0, randomRoll: 100 })).toBe(0));
});

describe('타입 상성', () => {
  it('얼음 → 드래곤/땅 4배', () => expect(typeEffectiveness('ice', ['dragon', 'ground'], dex)).toBe(4));
  it('땅 → 비행 무효', () => expect(typeEffectiveness('ground', ['fire', 'flying'], dex)).toBe(0));
});

/** 시드를 바꿔가며 조건을 만족하는 결과 찾기 (확률 효과 테스트용) */
function findTurn(make: () => BattleState, act: Parameters<typeof battle>[1], pred: (s: BattleState) => boolean) {
  for (let seed = 1; seed < 500; seed++) {
    const s = battle({ ...make(), seed }, act, dex);
    if (pred(s)) return s;
  }
  throw new Error('조건을 만족하는 시드 없음');
}

describe('기술 효과', () => {
  it('칼춤: 자신의 공격 +2', () => {
    const s = battle(createBattle([card('445', 50, ['swords-dance'])], [card('1', 5, ['tackle'])], dex, 1), { kind: 'move', moveId: moveId('swords-dance') }, dex);
    expect(s.player.party[0].stages.atk).toBe(2);
  });

  it('울음소리: 상대의 공격 -1', () => {
    const s = battle(createBattle([card('1', 50, ['growl'])], [card('4', 50, ['growl'])], dex, 1), { kind: 'move', moveId: moveId('growl') }, dex);
    expect(s.enemy.party[0].stages.atk).toBe(-1);
  });

  it('인파이트: 자신의 방어·특수방어 -1 (상대 아님)', () => {
    const s = battle(createBattle([card('68', 50, ['close-combat'])], [card('143', 100, ['growl'])], dex, 1), { kind: 'move', moveId: moveId('close-combat') }, dex);
    expect(s.player.party[0].stages.def).toBe(-1);
    expect(s.player.party[0].stages.spDef).toBe(-1);
    expect(s.enemy.party[0].stages.def).toBe(0);
  });

  it('전기자석파: 땅 타입에 무효, 일반 타입은 마비', () => {
    const vsGround = battle(createBattle([card('25', 50, ['thunder-wave'])], [card('50', 50, ['growl'])], dex, 1), { kind: 'move', moveId: moveId('thunder-wave') }, dex);
    expect(vsGround.enemy.party[0].ailment).toBe('none');
    const hit = findTurn(
      () => createBattle([card('25', 50, ['thunder-wave'])], [card('143', 50, ['growl'])], dex, 1),
      { kind: 'move', moveId: moveId('thunder-wave') },
      (s) => s.enemy.party[0].ailment === 'paralysis',
    );
    expect(hit.enemy.party[0].ailment).toBe('paralysis');
  });

  it('맹독: 독 타입에는 무효, 턴마다 데미지 증가', () => {
    const vsPoison = battle(createBattle([card('89', 50, ['toxic'])], [card('23', 50, ['growl'])], dex, 1), { kind: 'move', moveId: moveId('toxic') }, dex);
    expect(vsPoison.enemy.party[0].ailment).toBe('none');
    const s1 = findTurn(
      () => createBattle([card('89', 50, ['toxic'])], [card('143', 50, ['growl'])], dex, 1),
      { kind: 'move', moveId: moveId('toxic') },
      (s) => s.enemy.party[0].ailment === 'toxic',
    );
    const e = s1.enemy.party[0];
    expect(e.stats.hp - e.currentHp).toBe(Math.floor(e.stats.hp / 16)); // 1턴째 1/16
  });

  it('지구던지기: 레벨만큼 고정 데미지, 고스트에는 무효', () => {
    const s = battle(createBattle([card('68', 42, ['seismic-toss'])], [card('143', 100, ['growl'])], dex, 1), { kind: 'move', moveId: moveId('seismic-toss') }, dex);
    expect(s.enemy.party[0].stats.hp - s.enemy.party[0].currentHp).toBe(42);
    const ghost = battle(createBattle([card('68', 42, ['seismic-toss'])], [card('94', 50, ['lick'])], dex, 1), { kind: 'move', moveId: moveId('seismic-toss') }, dex);
    expect(ghost.enemy.party[0].currentHp).toBe(ghost.enemy.party[0].stats.hp);
  });

  it('기가드레인: 준 데미지의 50% 회복', () => {
    const start = createBattle([card('3', 50, ['giga-drain'])], [card('9', 50, ['growl'])], dex, 7);
    start.player.party[0].currentHp = 10;
    const s = battle(start, { kind: 'move', moveId: moveId('giga-drain') }, dex);
    const dealt = s.enemy.party[0].stats.hp - s.enemy.party[0].currentHp;
    expect(s.player.party[0].currentHp).toBe(10 + Math.max(1, Math.floor(dealt / 2)));
  });

  it('카운터: 받은 물리 데미지의 2배 반격', () => {
    const start = createBattle([card('202', 50, ['counter'])], [card('143', 50, ['tackle'])], dex, 3);
    const s = battle(start, { kind: 'move', moveId: moveId('counter') }, dex);
    const taken = s.player.party[0].stats.hp - s.player.party[0].currentHp;
    const enemy = s.enemy.party[0];
    expect(Math.min(enemy.stats.hp, taken * 2)).toBe(enemy.stats.hp - enemy.currentHp);
  });
});

describe('로그 조사', () => {
  it('받침에 따라 은/는, 이/가, 을/를, 으로/로', () => {
    expect(fixJosa('갸라도스은(는) 쓰러졌다!')).toBe('갸라도스는 쓰러졌다!');
    expect(fixJosa('한카리아스의 공격이(가) 올라갔다!')).toBe('한카리아스의 공격이 올라갔다!');
    expect(fixJosa('상대는 리자몽을(를) 내보냈다!')).toBe('상대는 리자몽을 내보냈다!');
    expect(fixJosa('스피드이(가)')).toBe('스피드가');
    expect(fixJosa('마릴(으)로부터')).toBe('마릴로부터');
    expect(fixJosa('잠만보(으)로부터')).toBe('잠만보로부터');
    expect(fixJosa('뮤츠(으)로부터')).toBe('뮤츠로부터');
    expect(fixJosa('리자몽(으)로부터')).toBe('리자몽으로부터');
  });
});

describe('전투 흐름', () => {
  it('상대를 쓰러뜨리면 교체된 포켓몬은 그 턴에 행동하지 않음', () => {
    const start = createBattle(
      [card('445', 100, ['earthquake'])],
      [card('25', 5, ['thunder-shock']), card('4', 5, ['ember'])],
      dex, 1,
    );
    const s = battle(start, { kind: 'move', moveId: moveId('earthquake') }, dex);
    expect(s.enemy.activeIdx).toBe(1);
    expect(s.log.join('\n')).not.toMatch(/파이리의/);
  });

  it('플레이어 포켓몬이 쓰러지면 pendingSwitch → 교체만 가능', () => {
    const start = createBattle(
      [card('25', 5, ['thunder-shock']), card('4', 5, ['ember'])],
      [card('445', 100, ['earthquake'])],
      dex, 1,
    );
    const s = battle(start, { kind: 'move', moveId: moveId('thunder-shock') }, dex);
    expect(s.pendingSwitch).toBe(true);
    expect(battle(s, { kind: 'move', moveId: moveId('thunder-shock') }, dex)).toBe(s); // 무시
    const s2 = battle(s, { kind: 'switch', toIdx: 1 }, dex);
    expect(s2.pendingSwitch).toBe(false);
    expect(s2.player.activeIdx).toBe(1);
  });

  it('같은 시드 = 같은 결과', () => {
    const make = () => createBattle([card('6', 50, ['flamethrower'])], [card('9', 50, ['water-gun'])], dex, 99);
    const a = battle(make(), { kind: 'move', moveId: moveId('flamethrower') }, dex);
    const b = battle(make(), { kind: 'move', moveId: moveId('flamethrower') }, dex);
    expect(a).toEqual(b);
  });

  it('무작위 3v3 전투 300판: 모두 200턴 안에 종료, HP 이상값 없음', () => {
    const ls = learnsets as Learnsets;
    const all = Object.keys(dex.species);
    const rng = createRng(2026);
    const randomCard = (): Card => {
      const id = all[Math.floor(rng() * all.length)];
      const level = 20 + Math.floor(rng() * 60);
      return makeCard(id, level, defaultEquip(learnableUpTo(ls[id], level)));
    };
    for (let g = 0; g < 300; g++) {
      let s = createBattle([randomCard(), randomCard(), randomCard()], [randomCard(), randomCard(), randomCard()], dex, g);
      let steps = 0;
      while (s.result === 'ongoing' && steps++ < 400) {
        if (s.pendingSwitch) {
          s = battle(s, { kind: 'switch', toIdx: s.player.party.findIndex((m) => m.currentHp > 0) }, dex);
          continue;
        }
        const me = s.player.party[s.player.activeIdx];
        const usable = me.card.moves.filter((id) => me.pp[id] > 0);
        const mv = usable[Math.floor(rng() * usable.length)] ?? me.card.moves[0];
        s = battle(s, { kind: 'move', moveId: mv }, dex);
        for (const m of [...s.player.party, ...s.enemy.party]) {
          expect(Number.isInteger(m.currentHp)).toBe(true);
          expect(m.currentHp).toBeGreaterThanOrEqual(0);
          expect(m.currentHp).toBeLessThanOrEqual(m.stats.hp);
        }
      }
      expect(s.result).not.toBe('ongoing');
    }
  });
});
