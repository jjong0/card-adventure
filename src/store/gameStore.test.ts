// src/store/gameStore.test.ts  (vitest) — 진행 흐름: 이동, 전투 정산, 패배 재시작, 챕터 클리어, 상점·아이템
import { beforeEach, describe, expect, it } from 'vitest';
import { battle, createBattle } from '../core/battle';
import { nodeOpponent } from '../core/encounter';
import { maxHp, shopStock } from '../core/items';
import { reachableNodes } from '../core/map';
import type { BattleState } from '../core/types';
import { dex, tmData, trainers } from '../lib/dex';
import { useGameStore } from './gameStore';

const initial = useGameStore.getState();
const g = () => useGameStore.getState();

/** 스타터를 고르고 시작. 시드를 고정해 지도가 항상 같다 */
function start() {
  useGameStore.setState({ ...initial, runSeed: 1234, seed: 1234 }, true);
  g().openStarterPack();
  g().chooseStarter(g().starterChoices![0].uid);
}

/** 지금 갈 수 있는 첫 노드로 이동해 상대를 만든다 */
function enterFirst(kind?: string) {
  const map = g().map();
  const ids = reachableNodes(map, g().mapNodeId);
  const node = map.floors.flat().find((n) => ids.includes(n.id) && (!kind || n.kind === kind))!;
  expect(g().moveTo(node.id)).toBe(true);
  return nodeOpponent(node, map.floors.length, g().chapterData(), trainers, g().starterType, dex, g().runSeed)!;
}

/** 승패가 날 때까지 첫 기술만 쓴다 */
function fight(state: BattleState): BattleState {
  for (let i = 0; i < 300 && state.result === 'ongoing'; i++) {
    const me = state.player.party[state.player.activeIdx];
    state = state.pendingSwitch
      ? battle(state, { kind: 'switch', toIdx: state.player.party.findIndex((m) => m.currentHp > 0) }, dex)
      : battle(state, { kind: 'move', moveId: me.card.moves.find((id) => dex.moves[id].category !== 'status') ?? me.card.moves[0] }, dex);
  }
  return state;
}

beforeEach(start);

describe('지도 이동', () => {
  it('갈 수 있는 노드로만 이동하고 방문 기록이 쌓인다', () => {
    const map = g().map();
    expect(g().moveTo(map.floors[3][0].id)).toBe(false);
    const first = map.floors[0][0];
    expect(g().moveTo(first.id)).toBe(true);
    expect(g().mapNodeId).toBe(first.id);
    expect(g().visitedNodes).toEqual([first.id]);
    expect(g().moveTo(map.floors[0][1].id)).toBe(false); // 같은 층으로는 못 간다
  });
});

describe('전투 정산', () => {
  it('승리: HP를 이어받고 골드·경험치를 받는다', () => {
    const op = enterFirst('wild');
    // 이기는 전투 시드를 찾는다 (스타터 한 마리라 시드에 따라 질 수도 있다)
    let end = fight(createBattle(g().partyCards(), op.cards, dex, 1, { playerHp: g().hp, wild: true }));
    for (let seed = 2; seed <= 50 && end.result !== 'win'; seed++) end = fight(createBattle(g().partyCards(), op.cards, dex, seed, { playerHp: g().hp, wild: true }));
    expect(end.result).toBe('win');
    const before = g().collection[0];
    const s = g().settleBattle(end, op)!;
    expect(s.gold).toBe(50 + op.cards[0].level * 5);
    expect(g().gold).toBe(s.gold);
    expect(s.growth).toHaveLength(1);
    expect(g().collection[0].exp).toBeGreaterThan(before.exp);
    // 레벨이 올랐으면 늘어난 최대 HP만큼 현재 HP도 오른다
    const grew = maxHp(g().collection[0], dex) - maxHp(before, dex);
    expect(g().hp[before.uid]).toBe(Math.min(maxHp(g().collection[0], dex), end.player.party[0].currentHp + grew));
  });

  it('패배: 정산이 없고, 챕터를 다시 시작하면 전원 회복 + 출발점 + 카드 유지', () => {
    const op = enterFirst();
    const lost = { ...createBattle(g().partyCards(), op.cards, dex, 7), result: 'lose' as const };
    lost.player.party[0].currentHp = 0;
    expect(g().settleBattle(lost, op)).toBeNull();
    expect(g().hp[g().party[0]]).toBe(0);
    const cards = g().collection;
    g().restartChapter();
    expect(g().hp).toEqual({});
    expect(g().mapNodeId).toBeNull();
    expect(g().visitedNodes).toEqual([]);
    expect(g().collection).toBe(cards);
    expect(g().gold).toBe(0);
  });
});

describe('팩과 파티', () => {
  it('새로 얻은 카드는 파티 빈 칸에 합류하고, 6마리를 넘지 않는다', () => {
    for (let i = 0; i < 4; i++) g().openTypePack('water');
    expect(g().party.length).toBe(Math.min(6, g().collection.length));
    expect(new Set(g().party).size).toBe(g().party.length);
  });
});

describe('챕터 클리어', () => {
  it('배지와 관장 기술머신을 받고 다음 챕터 출발점으로, 마지막 챕터 뒤에는 끝', () => {
    const tm1 = g().chapterData().rewardTm.moveId;
    g().moveTo(g().map().floors[0][0].id);
    g().completeChapter();
    expect(g()).toMatchObject({ chapter: 2, badges: ['falkner'], mapNodeId: null, visitedNodes: [], finished: false });
    expect(g().tms).toEqual([tm1]);
    g().completeChapter();
    expect(g()).toMatchObject({ chapter: 2, badges: ['falkner', 'bugsy'], finished: true });
  });
});

describe('상점과 아이템', () => {
  const stock = () => shopStock(g().chapterData(), tmData, dex, dex.evolutions);

  it('골드가 모자라면 못 사고, 사면 가방에 들어간다. 기술머신은 한 번만 산다', () => {
    const potion = stock().find((i) => i.id === 'potion')!;
    const tm = stock().find((i) => i.category === 'tm')!;
    expect(g().buy(potion)).toBe('no-gold');
    useGameStore.setState({ gold: 10000 });
    expect(g().buy(potion)).toBe('ok');
    expect(g().buy(potion)).toBe('ok');
    expect(g().bag.potion).toBe(2);
    expect(g().buy(tm)).toBe('ok');
    expect(g().buy(tm)).toBe('owned');
    expect(g().gold).toBe(10000 - 300 * 2 - 3000);
  });

  it('상처약: 다친 포켓몬을 회복하고 하나 줄어든다. 가득 차 있으면 쓰이지 않는다', () => {
    const uid = g().party[0];
    useGameStore.setState({ bag: { potion: 2 }, hp: { [uid]: 1 } });
    expect(g().applyItem('potion', uid)).toBeNull();
    expect(g().hp[uid]).toBe(Math.min(maxHp(g().collection[0], dex), 21));
    expect(g().bag.potion).toBe(1);
    useGameStore.setState({ hp: {} });
    expect(g().applyItem('potion', uid)).toBe('HP가 가득 차 있다.');
    expect(g().bag.potion).toBe(1);
    expect(g().applyItem('revive', uid)).toBe('가방에 없는 도구다.');
  });

  it('휴식: 회복은 전원 가득, 강화는 레벨 +3', () => {
    const uid = g().party[0];
    useGameStore.setState({ hp: { [uid]: 0 } });
    g().restHeal();
    expect(g().hp[uid]).toBe(maxHp(g().collection[0], dex));
    const lv = g().collection[0].level;
    expect(g().restTrain(uid)!.toLevel).toBe(lv + 3);
    expect(g().collection[0].level).toBe(lv + 3);
  });
});
