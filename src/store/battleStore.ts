// src/store/battleStore.ts
// 전투 화면 상태: 엔진 결과(state)와, 이벤트를 하나씩 재생한 화면 상태(shown)
import { create } from 'zustand';
import { battle, createBattle, type BattleOptions } from '../core/battle';
import type { BattleAction, BattleEvent, BattleState, Card } from '../core/types';
import { applyEvent, shownBefore, type Shown } from '../features/battle/playback';
import { dex } from '../lib/dex';

interface BattleStore {
  state: BattleState | null;
  shown: Shown | null;
  /** 아직 재생하지 않은 이벤트 */
  queue: BattleEvent[];
  /** 마지막으로 재생한 이벤트 (다음 이벤트까지 기다릴 시간 계산용) */
  current: BattleEvent | null;
  start: (player: Card[], enemy: Card[], seed: number, opts?: BattleOptions) => void;
  /** 재생 중이거나 전투가 끝났으면 무시. 엔진이 무효로 판단한 행동도 무시된다 */
  act: (action: BattleAction) => void;
  next: () => void;
  skip: () => void;
}

export const useBattleStore = create<BattleStore>((set, get) => ({
  state: null,
  shown: null,
  queue: [],
  current: null,

  start: (player, enemy, seed, opts) => {
    const state = createBattle(player, enemy, dex, seed, opts);
    set({ state, shown: shownBefore(state, true), queue: state.events, current: null });
  },

  act: (action) => {
    const { state, queue } = get();
    if (!state || queue.length || state.result !== 'ongoing') return;
    const next = battle(state, action, dex);
    if (next === state) return;
    set({ state: next, queue: next.events, current: null });
  },

  next: () => {
    const { shown, queue } = get();
    if (!shown || !queue.length) return;
    set({ shown: applyEvent(shown, queue[0]), queue: queue.slice(1), current: queue[0] });
  },

  skip: () => {
    const { shown, queue } = get();
    if (!shown || !queue.length) return;
    set({ shown: queue.reduce(applyEvent, shown), queue: [], current: queue[queue.length - 1] });
  },
}));
