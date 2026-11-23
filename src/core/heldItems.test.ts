// src/core/heldItems.test.ts (vitest) — 지닌 도구 효과
import { describe, expect, it } from 'vitest';
import speciesList from '../data/species.json';
import moves from '../data/moves.json';
import typeChart from '../data/typeChart.json';
import evolutions from '../data/evolutions.json';
import heldItems from '../data/heldItems.json';
import { battle, chooseEnemyAction, createBattle } from './battle';
import { CURE_BERRY, RESIST_BERRY, TYPE_BOOST, usableMoves } from './heldItems';
import type { BattleState, Card, Dex, Evolutions, Move, Species, TypeChart } from './types';

const dex: Dex = {
  species: Object.fromEntries((speciesList as Species[]).map((s) => [s.id, s])),
  moves: moves as unknown as Record<string, Move>,
  typeChart: typeChart as TypeChart,
  evolutions: evolutions as Evolutions,
  items: Object.fromEntries(heldItems.map((i) => [i.slug, i])),
};
const moveId = (slug: string) => Object.values(dex.moves).find((m) => m.slug === slug)!.id;
const IV31 = { hp: 31, atk: 31, def: 31, spAtk: 31, spDef: 31, spd: 31 };
const ZERO = { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0 };
const card = (speciesId: string, level: number, moveSlugs: string[], heldItem: string | null = null): Card => {
  const ids = moveSlugs.map(moveId);
  return {
    uid: `${speciesId}-${level}-${heldItem}`, speciesId, lineId: speciesId, level, exp: 0, star: 1, dupProgress: 0,
    ivBase: IV31, ivAlloc: ZERO, ivPoints: 0, learnedMoves: ids, moves: ids, heldItem,
  };
};
const use = (s: BattleState, slug: string) => battle(s, { kind: 'move', moveId: moveId(slug) }, dex);
/** 상대가 받은 데미지 (튀어오르기만 쓰는 상대) */
const dealt = (s: BattleState) => s.enemy.party[0].stats.hp - s.enemy.party[0].currentHp;

describe('데이터', () => {
  it('효과 표의 도구는 모두 heldItems.json에 있다', () => {
    const slugs = new Set(heldItems.map((i) => i.slug));
    for (const s of [...Object.keys(TYPE_BOOST), ...Object.keys(RESIST_BERRY), ...Object.keys(CURE_BERRY)]) {
      expect(slugs.has(s), s).toBe(true);
    }
  });
});

describe('공격 보정', () => {
  // 리자몽 Lv50 화염방사 → 잠만보 Lv50 (같은 시드면 난수가 같다)
  const fire = (item: string | null, seed = 7) =>
    use(createBattle([card('6', 50, ['flamethrower'], item)], [card('143', 50, ['splash'])], dex, seed), 'flamethrower');

  it('목탄: 불꽃 기술 위력 ×1.2', () => {
    const base = dealt(fire(null));
    expect(dealt(fire('charcoal'))).toBeGreaterThanOrEqual(Math.floor(base * 1.15));
    expect(dealt(fire('mystic-water'))).toBe(base); // 다른 타입 도구는 효과 없음
  });

  it('구애안경: 특수 기술 ×1.5, 구애머리띠는 특수 기술에 효과 없음', () => {
    const base = dealt(fire(null));
    expect(dealt(fire('choice-specs'))).toBeGreaterThanOrEqual(Math.floor(base * 1.4));
    expect(dealt(fire('choice-band'))).toBe(base);
  });

  it('생명의구슬: ×1.3, 공격 후 최대 HP 1/10 반동', () => {
    const base = fire(null);
    const orb = fire('life-orb');
    expect(dealt(orb)).toBeGreaterThanOrEqual(Math.floor(dealt(base) * 1.25));
    const me = orb.player.party[0];
    expect(me.stats.hp - me.currentHp).toBe(Math.floor(me.stats.hp / 10));
  });
});

describe('방어 보정', () => {
  // 돌격조끼를 지니면 변화기를 못 써서 발버둥(반동)을 하므로, 상대는 공격기를 쓰되 느린 포켓몬으로 둔다
  const hit = (defItem: string | null, slug: string, defender = '143', level = 50) =>
    use(createBattle([card('6', 50, [slug])], [card(defender, level, ['tackle'], defItem)], dex, 3), slug);

  it('돌격조끼: 특수 기술 데미지 감소, 변화기는 고를 수 없다', () => {
    expect(dealt(hit('assault-vest', 'flamethrower'))).toBeLessThan(dealt(hit(null, 'flamethrower')));
    const s = createBattle([card('6', 50, ['flamethrower', 'growl'], 'assault-vest')], [card('143', 50, ['splash'])], dex, 1);
    expect(use(s, 'growl')).toBe(s); // 무효한 행동은 상태를 그대로 돌려준다
  });

  it('진화의휘석: 진화 전 포켓몬만 방어 상승', () => {
    // 럭키(113)는 해피너스로 진화, 해피너스(242)는 최종
    expect(dealt(hit('eviolite', 'slash', '113'))).toBeLessThan(dealt(hit(null, 'slash', '113')));
    expect(dealt(hit('eviolite', 'slash', '242'))).toBe(dealt(hit(null, 'slash', '242')));
  });

  it('오카열매: 효과가 굉장한 불꽃 기술 데미지 반감, 한 번 쓰면 사라진다', () => {
    // 이상해꽃(풀/독)은 불꽃에 약하다. 한 방에 쓰러지지 않게 레벨을 높인다
    const base = dealt(hit(null, 'flamethrower', '3', 80));
    const s = hit('occa-berry', 'flamethrower', '3', 80);
    expect(dealt(s)).toBeLessThanOrEqual(Math.ceil(base / 2) + 1);
    expect(s.enemy.party[0].item).toBeNull();
  });
});

describe('버티기', () => {
  it('기합의띠: HP가 가득이면 한 번 HP 1로 버틴다', () => {
    let s = createBattle([card('445', 100, ['earthquake'])], [card('25', 5, ['splash'], 'focus-sash')], dex, 1);
    s = use(s, 'earthquake');
    expect(s.enemy.party[0].currentHp).toBe(1);
    expect(s.enemy.party[0].item).toBeNull();
    expect(s.log.some((l) => l.includes('기합의띠로 버텼다'))).toBe(true);
    s = use(s, 'earthquake');
    expect(s.result).toBe('win');
  });
});

describe('울퉁불퉁멧', () => {
  it('접촉 기술로 때리면 공격한 쪽이 최대 HP 1/6 데미지', () => {
    const s = use(createBattle([card('143', 50, ['tackle'])], [card('95', 50, ['splash'], 'rocky-helmet')], dex, 1), 'tackle');
    const me = s.player.party[0];
    expect(me.stats.hp - me.currentHp).toBe(Math.floor(me.stats.hp / 6));
  });
  it('접촉하지 않는 기술은 반응하지 않는다', () => {
    const s = use(createBattle([card('6', 50, ['flamethrower'])], [card('95', 50, ['splash'], 'rocky-helmet')], dex, 1), 'flamethrower');
    expect(s.player.party[0].currentHp).toBe(s.player.party[0].stats.hp);
  });
});

describe('회복', () => {
  it('먹다남은음식: 턴 끝에 최대 HP 1/16 회복', () => {
    const s0 = createBattle([card('143', 50, ['splash'], 'leftovers')], [card('6', 50, ['splash'])], dex, 1);
    s0.player.party[0].currentHp = 100;
    const s = use(s0, 'splash');
    expect(s.player.party[0].currentHp).toBe(100 + Math.floor(s.player.party[0].stats.hp / 16));
  });

  it('검은오물: 독 타입이 아니면 턴 끝에 1/8 데미지', () => {
    const s = use(createBattle([card('143', 50, ['splash'], 'black-sludge')], [card('6', 50, ['splash'])], dex, 1), 'splash');
    const me = s.player.party[0];
    expect(me.stats.hp - me.currentHp).toBe(Math.floor(me.stats.hp / 8));
  });

  it('자뭉열매: HP가 절반 이하가 되면 최대 HP 1/4 회복 후 사라진다', () => {
    const s0 = createBattle([card('143', 50, ['splash'], 'sitrus-berry')], [card('6', 50, ['splash'])], dex, 1);
    const max = s0.player.party[0].stats.hp;
    s0.player.party[0].currentHp = Math.floor(max / 2);
    const s = use(s0, 'splash');
    expect(s.player.party[0].currentHp).toBe(Math.floor(max / 2) + Math.floor(max / 4));
    expect(s.player.party[0].item).toBeNull();
  });

  it('리샘열매: 마비에 걸리면 바로 낫는다', () => {
    // 상대 피카츄가 전기자석파 (명중 90이라 맞는 시드를 찾는다)
    for (let seed = 1; seed < 50; seed++) {
      const s = use(createBattle([card('143', 50, ['splash'], 'lum-berry')], [card('25', 50, ['thunder-wave'])], dex, seed), 'splash');
      if (s.player.party[0].item !== null) continue;
      expect(s.player.party[0].ailment).toBe('none');
      expect(s.log.some((l) => l.includes('리샘열매를 먹고'))).toBe(true);
      return;
    }
    throw new Error('전기자석파가 맞는 시드 없음');
  });
});

describe('구애 고정', () => {
  it('처음 쓴 기술로 고정되고, 다른 기술은 고를 수 없다. 교체하면 풀린다', () => {
    let s = createBattle(
      [card('6', 50, ['flamethrower', 'slash'], 'choice-specs'), card('143', 50, ['splash'])],
      [card('143', 50, ['splash'])], dex, 1,
    );
    s = use(s, 'flamethrower');
    expect(s.player.party[0].choiceLock).toBe(moveId('flamethrower'));
    expect(usableMoves(s.player.party[0], dex.moves)).toEqual([moveId('flamethrower')]);
    expect(use(s, 'slash')).toBe(s);
    s = battle(s, { kind: 'switch', toIdx: 1 }, dex);
    expect(s.player.party[0].choiceLock).toBeNull();
  });

  it('상대 AI도 고정된 기술만 고른다', () => {
    const s = createBattle([card('143', 50, ['splash'])], [card('6', 50, ['flamethrower', 'slash'], 'choice-band')], dex, 1);
    s.enemy.party[0].choiceLock = moveId('flamethrower');
    expect(chooseEnemyAction(s, dex)).toEqual({ kind: 'move', moveId: moveId('flamethrower') });
  });
});

describe('선제공격손톱', () => {
  it('느린 쪽이 가끔 먼저 움직인다', () => {
    // 잠만보(느림) vs 피카츄(빠름): 손톱이 발동하면 잠만보가 먼저
    let first = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = use(createBattle([card('143', 50, ['splash'], 'quick-claw')], [card('25', 50, ['splash'])], dex, seed), 'splash');
      if (s.log.some((l) => l.includes('행동이 빨라졌다'))) {
        first++;
        const order = s.log.filter((l) => l.endsWith('튀어오르기!'));
        expect(order[0]).toContain('잠만보');
      }
    }
    expect(first).toBeGreaterThan(20);
    expect(first).toBeLessThan(70);
  });
});
