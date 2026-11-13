import { describe, expect, it } from 'vitest';
import speciesList from '../../data/species.json';
import moves from '../../data/moves.json';
import typeChart from '../../data/typeChart.json';
import { battle, createBattle } from '../../core/battle';
import type { Card, Dex, Move, Species, TypeChart } from '../../core/types';
import { applyEvent, shownBefore } from './playback';

const dex: Dex = {
  species: Object.fromEntries((speciesList as Species[]).map((s) => [s.id, s])),
  moves: moves as unknown as Record<string, Move>,
  typeChart: typeChart as TypeChart,
};
const moveId = (slug: string) => Object.values(dex.moves).find((m) => m.slug === slug)!.id;
const IV = { hp: 31, atk: 31, def: 31, spAtk: 31, spDef: 31, spd: 31 };
const card = (speciesId: string, level: number, slugs: string[]): Card => ({
  uid: `${speciesId}-${level}`, speciesId, lineId: speciesId, level, exp: 0, star: 1, dupProgress: 0,
  ivBase: IV, ivAlloc: { ...IV, hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0 }, ivPoints: 0,
  learnedMoves: slugs.map(moveId), moves: slugs.map(moveId), heldItem: null,
});

describe('연출 재생', () => {
  it('새 전투: 처음엔 아무도 안 보이고, 등장 이벤트 후 둘 다 보임', () => {
    const s = createBattle([card('4', 10, ['ember'])], [card('16', 10, ['tackle'])], dex, 1);
    const start = shownBefore(s, true);
    expect(start.player.visible || start.enemy.visible).toBe(false);
    const end = s.events.reduce(applyEvent, start);
    expect(end.player.visible && end.enemy.visible).toBe(true);
    expect(end.message).toBe('가랏! 파이리!');
  });

  it('이벤트를 끝까지 적용하면 엔진 결과와 같은 HP·상태이상·출전 포켓몬', () => {
    let s = createBattle(
      [card('25', 30, ['thunder-wave', 'thunder-shock']), card('4', 30, ['ember'])],
      [card('16', 28, ['tackle']), card('19', 28, ['tackle'])],
      dex, 3,
    );
    for (const act of ['thunder-wave', 'thunder-shock', 'thunder-shock', 'thunder-shock', 'thunder-shock']) {
      if (s.result !== 'ongoing') break;
      const prev = s;
      s = battle(s, s.pendingSwitch ? { kind: 'switch', toIdx: 1 } : { kind: 'move', moveId: moveId(act) }, dex);
      const end = s.events.reduce(applyEvent, shownBefore(prev, false));
      for (const side of ['player', 'enemy'] as const) {
        expect(end[side].activeIdx).toBe(s[side].activeIdx);
        expect(end[side].mons.map((m) => m.hp)).toEqual(s[side].party.map((m) => m.currentHp));
        expect(end[side].mons.map((m) => m.ailment)).toEqual(s[side].party.map((m) => m.ailment));
      }
    }
  });

  it('기절하면 그 쪽 스프라이트를 숨기고 faint 연출 신호', () => {
    const s0 = createBattle([card('445', 100, ['earthquake'])], [card('4', 5, ['ember']), card('7', 5, ['bubble'])], dex, 1);
    const s1 = battle(s0, { kind: 'move', moveId: moveId('earthquake') }, dex);
    const shown = shownBefore(s0, false);
    const faintAt = s1.events.findIndex((e) => e.type === 'faint');
    const atFaint = s1.events.slice(0, faintAt + 1).reduce(applyEvent, shown);
    expect(atFaint.enemy.visible).toBe(false);
    expect(atFaint.cue).toMatchObject({ side: 'enemy', kind: 'faint' });
    expect(s1.events.reduce(applyEvent, shown).enemy).toMatchObject({ visible: true, activeIdx: 1 }); // 다음 포켓몬 등장
  });

  it('랭크 상승·하락은 그 쪽에 화살표 연출 신호', () => {
    const s0 = createBattle([card('445', 50, ['swords-dance', 'leer'])], [card('143', 50, ['growl'])], dex, 1);
    const up = battle(s0, { kind: 'move', moveId: moveId('swords-dance') }, dex);
    const cues = (s: typeof up, prev: typeof s0) => s.events.reduce<{ side: string; kind: string }[]>((acc, e) => {
      const shown = applyEvent(shownBefore(prev, false), e);
      if (e.type === 'stage' && shown.cue) acc.push({ side: shown.cue.side, kind: shown.cue.kind });
      return acc;
    }, []);
    expect(cues(up, s0)).toContainEqual({ side: 'player', kind: 'statUp' });
    expect(cues(battle(s0, { kind: 'move', moveId: moveId('leer') }, dex), s0)).toContainEqual({ side: 'enemy', kind: 'statDown' });
  });
});
