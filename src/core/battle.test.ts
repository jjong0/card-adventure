// src/core/battle.test.ts  (vitest)
import { describe, expect, it } from 'vitest';
import speciesList from '../data/species.json';
import moves from '../data/moves.json';
import typeChart from '../data/typeChart.json';
import learnsets from '../data/learnsets.json';
import { battle, calcDamage, calcStats, chooseEnemyAction, createBattle, fixJosa, typeEffectiveness } from './battle';
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

describe('고정·랜덤 데미지 기술', () => {
  const hit = (attacker: Card, slug: string, seed = 1) =>
    battle(createBattle([attacker], [card('143', 100, ['growl'])], dex, seed), { kind: 'move', moveId: moveId(slug) }, dex);
  const dealt = (s: BattleState) => s.enemy.party[0].stats.hp - s.enemy.party[0].currentHp;

  it('소닉붐 20, 용의분노 40 (레벨·능력치 무관)', () => {
    expect(dealt(findTurn(() => createBattle([card('81', 5, ['sonic-boom'])], [card('143', 100, ['growl'])], dex, 1), { kind: 'move', moveId: moveId('sonic-boom') }, (s) => dealt(s) > 0))).toBe(20);
    expect(dealt(hit(card('147', 80, ['dragon-rage']), 'dragon-rage'))).toBe(40);
  });

  it('소닉붐은 고스트에 무효', () => {
    const s = battle(createBattle([card('81', 50, ['sonic-boom'])], [card('92', 50, ['lick'])], dex, 1), { kind: 'move', moveId: moveId('sonic-boom') }, dex);
    expect(s.enemy.party[0].currentHp).toBe(s.enemy.party[0].stats.hp);
  });

  it('사이코웨이브: 레벨의 0.5~1.5배, 시드에 따라 달라짐', () => {
    const results = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const d = dealt(hit(card('63', 40, ['psywave']), 'psywave', seed));
      if (d === 0) continue; // 빗나감
      expect(d).toBeGreaterThanOrEqual(20);
      expect(d).toBeLessThanOrEqual(60);
      results.add(d);
    }
    expect(results.size).toBeGreaterThan(10);
  });

  it('매그니튜드: 4~10이 나오고 7이 가장 흔함 (확률 30%)', () => {
    const count: Record<string, number> = {};
    for (let seed = 1; seed <= 1000; seed++) {
      const s = hit(card('74', 30, ['magnitude']), 'magnitude', seed);
      const m = s.log.join('\n').match(/매그니튜드 (\d+)!/);
      if (m) count[m[1]] = (count[m[1]] ?? 0) + 1;
    }
    expect(Object.keys(count).sort((a, b) => +a - +b)).toEqual(['4', '5', '6', '7', '8', '9', '10']);
    const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
    expect(top).toBe('7');
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

describe('연출 이벤트', () => {
  it('전투 시작: 상대 → 내 포켓몬 순서로 등장 이벤트와 메시지', () => {
    const s = createBattle([card('4', 5, ['ember'])], [card('16', 5, ['tackle'])], dex, 1);
    expect(s.events.map((e) => e.type)).toEqual(['switchIn', 'message', 'switchIn', 'message']);
    expect(s.events[0]).toEqual({ type: 'switchIn', side: 'enemy', idx: 0 });
    expect(s.events[1]).toEqual({ type: 'message', text: '상대가 구구를 내보냈다!' }); // 조사 처리됨
  });

  it('events는 이번 호출분만 담는다 (누적 아님)', () => {
    const s1 = battle(createBattle([card('445', 50, ['swords-dance'])], [card('1', 5, ['growl'])], dex, 1), { kind: 'move', moveId: moveId('swords-dance') }, dex);
    const s2 = battle(s1, { kind: 'move', moveId: moveId('swords-dance') }, dex);
    const texts = s2.events.flatMap((e) => (e.type === 'message' ? [e.text] : []));
    expect(texts).toEqual(s2.log.slice(s1.log.length));
  });

  it('칼춤: stage 이벤트에 실제 변화량', () => {
    const s = battle(createBattle([card('445', 50, ['swords-dance'])], [card('1', 5, ['growl'])], dex, 1), { kind: 'move', moveId: moveId('swords-dance') }, dex);
    expect(s.events).toContainEqual({ type: 'stage', side: 'player', stat: 'atk', delta: 2 });
    expect(s.events.findIndex((e) => e.type === 'move')).toBeLessThan(s.events.findIndex((e) => e.type === 'stage'));
  });

  it('효과가 굉장한 공격: damage 이벤트에 상성 배율, 쓰러지면 faint', () => {
    const s = battle(createBattle([card('9', 50, ['water-gun'])], [card('4', 5, ['ember'])], dex, 1), { kind: 'move', moveId: moveId('water-gun') }, dex);
    const dmg = s.events.find((e) => e.type === 'damage' && e.side === 'enemy');
    expect(dmg).toMatchObject({ effectiveness: 2, to: 0 });
    expect(s.events).toContainEqual({ type: 'faint', side: 'enemy' });
  });

  it('무작위 3v3 전투 100판: 이벤트만 재생해도 HP·로그가 실제 상태와 일치', () => {
    const ls = learnsets as Learnsets;
    const all = Object.keys(dex.species);
    const rng = createRng(77);
    const randomCard = (): Card => {
      const id = all[Math.floor(rng() * all.length)];
      const level = 20 + Math.floor(rng() * 60);
      return makeCard(id, level, defaultEquip(learnableUpTo(ls[id], level)));
    };
    for (let g = 0; g < 100; g++) {
      let s = createBattle([randomCard(), randomCard(), randomCard()], [randomCard(), randomCard(), randomCard()], dex, g);
      let steps = 0;
      while (s.result === 'ongoing' && steps++ < 400) {
        const prev = s;
        if (s.pendingSwitch) {
          s = battle(s, { kind: 'switch', toIdx: s.player.party.findIndex((m) => m.currentHp > 0) }, dex);
        } else {
          const me = s.player.party[s.player.activeIdx];
          const usable = me.card.moves.filter((id) => me.pp[id] > 0);
          s = battle(s, { kind: 'move', moveId: usable[Math.floor(rng() * usable.length)] ?? me.card.moves[0] }, dex);
        }
        // 이전 상태에서 출발해 이벤트만으로 HP와 출전 포켓몬을 재구성
        const hp = { player: prev.player.party.map((m) => m.currentHp), enemy: prev.enemy.party.map((m) => m.currentHp) };
        const act = { player: prev.player.activeIdx, enemy: prev.enemy.activeIdx };
        const texts: string[] = [];
        for (const e of s.events) {
          if (e.type === 'message') texts.push(e.text);
          else if (e.type === 'switchIn') act[e.side] = e.idx;
          else if (e.type === 'damage' || e.type === 'heal') {
            expect(e.from).toBe(hp[e.side][act[e.side]]);
            hp[e.side][act[e.side]] = e.to;
          } else if (e.type === 'faint') expect(hp[e.side][act[e.side]]).toBe(0);
        }
        expect(texts).toEqual(s.log.slice(prev.log.length));
        expect(hp.player).toEqual(s.player.party.map((m) => m.currentHp));
        expect(hp.enemy).toEqual(s.enemy.party.map((m) => m.currentHp));
        expect(act).toEqual({ player: s.player.activeIdx, enemy: s.enemy.activeIdx });
      }
    }
  });
});

describe('경험치 분배 기록 (knockouts)', () => {
  it('교체해서 함께 싸운 아군 둘 다 참여자로 기록', () => {
    let s = createBattle([card('143', 50, ['tackle']), card('445', 100, ['earthquake'])], [card('4', 5, ['ember'])], dex, 1);
    s = battle(s, { kind: 'switch', toIdx: 1 }, dex);
    expect(s.knockouts).toEqual([]);
    s = battle(s, { kind: 'move', moveId: moveId('earthquake') }, dex);
    expect(s.knockouts).toEqual([{ enemyIdx: 0, participants: [0, 1] }]);
  });

  it('상대를 쓰러뜨리기 전에 쓰러진 아군은 빠진다', () => {
    let s = createBattle([card('25', 5, ['thunder-shock']), card('445', 100, ['earthquake'])], [card('143', 60, ['tackle'])], dex, 1);
    s = battle(s, { kind: 'move', moveId: moveId('thunder-shock') }, dex);
    expect(s.pendingSwitch).toBe(true);
    s = battle(s, { kind: 'switch', toIdx: 1 }, dex);
    for (let t = 0; t < 10 && !s.knockouts.length; t++) s = battle(s, { kind: 'move', moveId: moveId('earthquake') }, dex);
    expect(s.knockouts).toEqual([{ enemyIdx: 0, participants: [1] }]);
  });
});

describe('전투 옵션 (지도 진행용)', () => {
  it('시작 HP를 이어받고, 쓰러진 카드는 건너뛰어 첫 번째로 싸울 수 있는 카드가 나간다', () => {
    const a = card('25', 20, ['thunder-shock']);
    const b = card('4', 20, ['ember']);
    const s = createBattle([a, b], [card('16', 5, ['tackle'])], dex, 1, { playerHp: { [a.uid]: 0, [b.uid]: 7 } });
    expect(s.player.activeIdx).toBe(1);
    expect(s.player.party.map((m) => m.currentHp)).toEqual([0, 7]);
    expect(s.events).toContainEqual({ type: 'switchIn', side: 'player', idx: 1 });
    expect(s.log.at(-1)).toBe('가랏! 파이리!');
  });

  it('최대 HP보다 큰 값은 최대 HP로 맞추고, 전원이 쓰러져 있으면 시작할 수 없다', () => {
    const a = card('25', 20, ['thunder-shock']);
    const s = createBattle([a], [card('16', 5, ['tackle'])], dex, 1, { playerHp: { [a.uid]: 9999 } });
    expect(s.player.party[0].currentHp).toBe(s.player.party[0].stats.hp);
    expect(() => createBattle([a], [card('16', 5, ['tackle'])], dex, 1, { playerHp: { [a.uid]: 0 } })).toThrow();
  });

  it('시작 PP를 이어받는다. 기록이 없는 기술은 가득, 최대보다 큰 값은 최대로', () => {
    const a = card('25', 20, ['thunder-shock', 'quick-attack']);
    const [shock, quick] = a.moves;
    const s = createBattle([a], [card('16', 5, ['tackle'])], dex, 1, { playerPp: { [a.uid]: { [shock]: 3, [quick]: 999 } } });
    expect(s.player.party[0].pp).toEqual({ [shock]: 3, [quick]: 30 });
    expect(createBattle([a], [card('16', 5, ['tackle'])], dex, 1).player.party[0].pp[shock]).toBe(30);
  });

  it('야생: 등장 문구가 다르고, 여러 기술을 섞어 쓴다 (트레이너는 가장 센 기술만)', () => {
    const used = (wild: boolean) => {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 40; seed++) {
        const s0 = createBattle([card('143', 50, ['growl'])], [card('16', 30, ['tackle', 'gust', 'sand-attack'])], dex, seed, { wild });
        const s1 = battle(s0, { kind: 'move', moveId: moveId('growl') }, dex);
        const mv = s1.events.find((e) => e.type === 'move' && e.side === 'enemy');
        if (mv && mv.type === 'move') seen.add(mv.moveId);
      }
      return seen.size;
    };
    expect(createBattle([card('143', 50, ['growl'])], [card('16', 30, ['tackle'])], dex, 1, { wild: true }).log[0]).toBe('야생 구구가 나타났다!');
    expect(used(true)).toBe(3);
    expect(used(false)).toBe(1);
  });
});

describe('상대 AI (보통: 기대 데미지 최대)', () => {
  const pick = (enemy: Card, player: Card) => {
    const s = createBattle([player], [enemy], dex, 1);
    const a = chooseEnemyAction(s, dex);
    return a.kind === 'move' ? dex.moves[a.moveId].slug : 'switch';
  };

  it('데미지가 작아도 공격기가 있으면 변화기를 쓰지 않는다', () => {
    expect(pick(card('393', 6, ['growl', 'pound']), card('167', 6, ['poison-sting']))).toBe('pound');
  });

  it('공격기가 무효면 변화기, 공격기가 없으면 변화기', () => {
    expect(pick(card('16', 10, ['tackle', 'sand-attack']), card('92', 10, ['lick']))).toBe('sand-attack'); // 노말 → 고스트 무효
    expect(pick(card('1', 10, ['growl']), card('16', 10, ['tackle']))).toBe('growl');
  });

  it('쓰러뜨릴 수 있는 기술이 있으면 그 기술', () => {
    const s = createBattle([card('16', 10, ['tackle'])], [card('445', 60, ['tackle', 'earthquake'])], dex, 1);
    s.player.party[0].currentHp = 1;
    const a = chooseEnemyAction(s, dex);
    expect(a.kind === 'move' && ['tackle', 'earthquake'].includes(dex.moves[a.moveId].slug)).toBe(true);
  });
});
