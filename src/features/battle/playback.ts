// src/features/battle/playback.ts
// 전투 연출 재생: 엔진이 돌려준 events를 하나씩 적용해 "화면에 보이는 상태"를 만든다.
// 엔진 결과(BattleState)는 이미 최종값이라, 화면은 이전 상태에서 출발해 이벤트를 따라가야 한다.
import type { Ailment, BattleEvent, BattleState, Side } from '../../core/types';

export interface ShownMon {
  hp: number;
  ailment: Ailment;
}

export interface ShownSide {
  activeIdx: number;
  mons: ShownMon[];
  /** 출전 포켓몬이 필드에 보이는지 (등장 전·기절 후 false) */
  visible: boolean;
}

/** 스프라이트 연출 신호. key가 바뀔 때마다 같은 연출도 다시 재생한다 */
export interface Cue {
  side: Side;
  kind: 'enter' | 'attack' | 'hit' | 'faint' | 'statUp' | 'statDown';
  key: number;
}

/** 기술 이펙트 신호. key가 바뀔 때마다 새로 재생한다 */
export interface MoveFx {
  side: Side;
  moveId: string;
  key: number;
}

export interface Shown {
  player: ShownSide;
  enemy: ShownSide;
  message: string | null;
  cue: Cue | null;
  effect: MoveFx | null;
}

function sideSnapshot(state: BattleState, side: Side, visible: boolean): ShownSide {
  const s = state[side];
  return {
    activeIdx: s.activeIdx,
    mons: s.party.map((m) => ({ hp: m.currentHp, ailment: m.ailment })),
    visible: visible && s.party[s.activeIdx].currentHp > 0,
  };
}

/** 이벤트를 재생하기 전의 화면. 새 전투(createBattle 직후)면 아직 아무도 등장하지 않은 상태 */
export function shownBefore(state: BattleState, isNewBattle: boolean): Shown {
  return {
    player: sideSnapshot(state, 'player', !isNewBattle),
    enemy: sideSnapshot(state, 'enemy', !isNewBattle),
    message: null,
    cue: null,
    effect: null,
  };
}

function updateActive(side: ShownSide, f: (m: ShownMon) => ShownMon): ShownSide {
  return { ...side, mons: side.mons.map((m, i) => (i === side.activeIdx ? f(m) : m)) };
}

export function applyEvent(shown: Shown, e: BattleEvent): Shown {
  const key = (shown.cue?.key ?? 0) + 1;
  switch (e.type) {
    case 'message':
      return { ...shown, message: e.text };
    case 'switchIn':
      return { ...shown, [e.side]: { ...shown[e.side], activeIdx: e.idx, visible: true }, cue: { side: e.side, kind: 'enter', key } };
    case 'move':
      return { ...shown, cue: { side: e.side, kind: 'attack', key }, effect: { side: e.side, moveId: e.moveId, key } };
    case 'damage':
      return { ...shown, [e.side]: updateActive(shown[e.side], (m) => ({ ...m, hp: e.to })), cue: { side: e.side, kind: 'hit', key } };
    case 'heal': {
      const side = shown[e.side];
      if (e.idx === undefined) return { ...shown, [e.side]: updateActive(side, (m) => ({ ...m, hp: e.to })) };
      return { ...shown, [e.side]: { ...side, mons: side.mons.map((m, i) => (i === e.idx ? { ...m, hp: e.to } : m)) } };
    }
    case 'status':
      return { ...shown, [e.side]: updateActive(shown[e.side], (m) => ({ ...m, ailment: e.ailment })) };
    case 'faint':
      return { ...shown, [e.side]: { ...shown[e.side], visible: false }, cue: { side: e.side, kind: 'faint', key } };
    case 'stage':
      return { ...shown, cue: { side: e.side, kind: e.delta > 0 ? 'statUp' : 'statDown', key } };
  }
}

/** 이벤트 하나를 보여주는 시간(ms). 메시지는 읽을 시간, HP는 바가 줄어드는 시간 */
export function eventDuration(e: BattleEvent): number {
  switch (e.type) {
    case 'message':
      return Math.min(1600, 700 + e.text.length * 25);
    case 'damage':
    case 'heal':
      return 650;
    case 'faint':
      return 700;
    case 'switchIn':
      return 500;
    case 'move':
      return 800; // 기술 이펙트 재생 시간 (MoveEffect)
    case 'stage':
      return 600; // 랭크 화살표 (StatArrows)
    default:
      return 0;
  }
}
