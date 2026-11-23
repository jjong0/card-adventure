// src/store/gameStore.test.ts  (vitest) — 진행 흐름: 이동, 전투 정산, 패배 재시작, 챕터 클리어, 상점·아이템
import { beforeEach, describe, expect, it } from 'vitest';
import { battle, createBattle } from '../core/battle';
import { nodeOpponent } from '../core/encounter';
import { maxHp, shopStock } from '../core/items';
import { parseSave } from '../core/save';
import { reachableNodes } from '../core/map';
import type { BattleState } from '../core/types';
import { dex, tmData, trainers } from '../lib/dex';
import { useGameStore } from './gameStore';

const initial = useGameStore.getState();
const g = () => useGameStore.getState();

/** 스타터를 고르고 시작. 시드를 고정해 지도가 항상 같다 */
function start(difficulty: 'easy' | 'normal' | 'hard' | 'extreme' = 'normal', nuzlocke = false) {
  useGameStore.setState(initial, true);
  g().newGame({ slot: 1, difficulty, challenges: { nuzlocke, randomStarter: false }, seed: 1234 });
  g().openStarterPack();
  g().chooseStarter(g().starterChoices![0].uid);
}

/** 지금 갈 수 있는 첫 노드로 이동해 상대를 만든다 */
function enterFirst(kind?: string) {
  const map = g().map();
  const ids = reachableNodes(map, g().mapNodeId);
  const node = map.floors.flat().find((n) => ids.includes(n.id) && (!kind || n.kind === kind))!;
  expect(g().moveTo(node.id)).toBe(true);
  return nodeOpponent(node, { totalFloors: map.floors.length, chapter: g().chapterData(), trainers, starterType: g().starterType, difficulty: g().difficulty, seed: g().runSeed }, dex)!;
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

beforeEach(() => start());

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
  it('승리: HP를 이어받고 골드·경험치·회복약을 받는다', () => {
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
    // 야생은 회복약 1개가 가방에 들어간다
    expect(s.items).toHaveLength(1);
    expect(g().bag[s.items[0]]).toBe(1);
    // 레벨이 올랐으면 늘어난 최대 HP만큼 현재 HP도 오른다
    const grew = maxHp(g().collection[0], dex) - maxHp(before, dex);
    expect(g().hp[before.uid]).toBe(Math.min(maxHp(g().collection[0], dex), end.player.party[0].currentHp + grew));
  });

  it('반동으로 파티 전원이 쓰러진 채 이기면 맨 앞 포켓몬이 HP 1로 남는다', () => {
    const op = enterFirst('wild');
    const won = { ...createBattle(g().partyCards(), op.cards, dex, 1, { wild: true }), result: 'win' as const };
    won.player.party[0].currentHp = 0;
    expect(g().settleBattle(won, op)).not.toBeNull();
    expect(g().hp[g().party[0]]).toBe(1);
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

  it('PP: 전투가 끝나도 이어지고, PP 회복약으로 채우고, 휴식·패배 재시작이면 가득 찬다', () => {
    const op = enterFirst('wild');
    const uid = g().party[0];
    const moveId = g().collection[0].moves[0];
    let state = createBattle(g().partyCards(), op.cards, dex, 1, { wild: true });
    state = battle(state, { kind: 'move', moveId }, dex);
    const left = state.player.party[0].pp[moveId];
    g().settleBattle({ ...state, result: 'lose' }, op);
    expect(g().pp[uid][moveId]).toBe(left);
    // 다음 전투는 줄어든 PP로 시작
    expect(createBattle(g().partyCards(), op.cards, dex, 2, { playerPp: g().pp, wild: true }).player.party[0].pp[moveId]).toBe(left);
    useGameStore.setState({ bag: { ether: 1 } });
    expect(g().applyItem('ether', uid)).toBe('PP를 회복할 기술을 골라야 한다.');
    expect(g().applyItem('ether', uid, moveId)).toBeNull();
    expect(g().pp[uid][moveId]).toBe(Math.min(dex.moves[moveId].pp, left + 10));
    expect(g().bag.ether ?? 0).toBe(0);
    useGameStore.setState({ pp: { [uid]: { [moveId]: 0 } } });
    g().restHeal();
    expect(g().pp[uid]).toBeUndefined();
    useGameStore.setState({ pp: { [uid]: { [moveId]: 0 } } });
    g().restartChapter();
    expect(g().pp).toEqual({});
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
  it('지닌 도구: 지니면 가방에서 빠지고, 전투에서 먹은 열매는 사라진다', () => {
    const uid = g().party[0];
    useGameStore.setState({ bag: { 'sitrus-berry': 1, potion: 1 } });
    expect(g().equipItem(uid, 'potion')).toBe('지닐 수 없는 도구다.');
    expect(g().equipItem(uid, 'sitrus-berry')).toBeNull();
    expect(g().bag).toEqual({ potion: 1 });
    // 열매를 먹은 전투
    const op = enterFirst('wild');
    let state = createBattle(g().partyCards(), op.cards, dex, 1, { wild: true });
    state.player.party[0].currentHp = 1;
    state = battle(state, { kind: 'move', moveId: state.player.party[0].card.moves[0] }, dex);
    expect(state.player.party[0].item).toBeNull();
    g().settleBattle(state, op);
    expect(g().collection.find((c) => c.uid === uid)!.heldItem).toBeNull();
  });

  it('지닌 도구: 카드를 골드로 바꾸면 도구는 가방으로 돌아온다', () => {
    useGameStore.setState({ bag: { leftovers: 1 } });
    const spare = { ...g().collection[0], uid: 'spare', lineId: 'spare-line' };
    useGameStore.setState({ collection: [...g().collection, spare] });
    expect(g().equipItem('spare', 'leftovers')).toBeNull();
    expect(typeof g().sell('spare')).toBe('number');
    expect(g().bag).toEqual({ leftovers: 1 });
  });
});

describe('보상·사건 노드', () => {
  /** 그 종류 노드에 서 있는 상태로 만든다 (이동 경로는 건너뛴다) */
  const standOn = (kind: string) => {
    const node = g().map().floors.flat().find((n) => n.kind === kind)!;
    useGameStore.setState({ mapNodeId: node.id, visitedNodes: [node.id], nodeDone: false });
    return node;
  };

  it('보상: 서로 다른 도구 3개 중 하나를 가방에 넣고 노드가 끝난다. 다시는 못 가져간다', () => {
    standOn('treasure');
    const choices = g().treasureChoices();
    expect(new Set(choices).size).toBe(3);
    expect(g().treasureChoices()).toEqual(choices); // 다시 들어와도 같다
    expect(g().claimTreasure('not-in-list')).toBe(false);
    expect(g().claimTreasure(choices[1])).toBe(true);
    expect(g().bag[choices[1]]).toBe(1);
    expect(g().nodeDone).toBe(true);
    expect(g().claimTreasure(choices[0])).toBe(false);
  });

  it('사건: 골드가 모자라면 못 고르고, 고르면 결과가 적용되고 노드가 끝난다', () => {
    const node = standOn('event');
    const event = g().currentEvent()!;
    expect(event).not.toBeNull();
    // 마지막 선택지는 어느 사건이든 골드가 들지 않는다
    const last = event.choices.length - 1;
    const r = g().chooseEvent(last);
    expect(typeof r).toBe('object');
    if (typeof r === 'object' && !r.battle) expect(g().nodeDone).toBe(true);
    expect(g().chooseEvent(0)).toBe('고를 수 없는 선택지다.');
    expect(g().mapNodeId).toBe(node.id);
  });

  it('사건 결과: 도구·골드·회복이 실제로 반영된다 (모든 사건의 첫 선택지를 시드 여러 개로)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      start();
      useGameStore.setState({ runSeed: seed, gold: 100000 });
      standOn('event');
      const before = { gold: g().gold, bag: { ...g().bag } };
      const r = g().chooseEvent(0);
      if (typeof r === 'string') throw new Error(r);
      for (const line of r.gains) {
        if (line.endsWith('을(를) 얻었다.') && !line.includes('개를')) expect(Object.keys(g().bag).length).toBeGreaterThan(Object.keys(before.bag).length);
        if (line.endsWith('G를 받았다.')) expect(g().gold).toBeGreaterThan(before.gold);
        if (line.endsWith('G를 냈다.')) expect(g().gold).toBeLessThan(before.gold);
      }
      expect(g().nodeDone).toBe(!r.battle);
    }
  });
});

describe('저장과 불러오기', () => {
  it('저장 → JSON → 검사 → 불러오기를 거쳐도 진행 상태가 같다', () => {
    g().openTypePack('water');
    g().moveTo(g().map().floors[0][0].id);
    g().finishNode();
    useGameStore.setState({ gold: 777, bag: { potion: 3 }, playTimeSec: 90.7 });
    const save = g().toSave();
    const parsed = parseSave(JSON.stringify(save));
    if (typeof parsed === 'string') throw new Error(parsed);
    const before = g();
    useGameStore.setState(initial, true);
    g().loadSave(parsed, 2);
    for (const k of ['runSeed', 'seed', 'chapter', 'difficulty', 'gold', 'collection', 'party', 'mapNodeId', 'visitedNodes', 'bag', 'starterType'] as const) {
      expect(g()[k], k).toEqual(before[k]);
    }
    expect(g().slot).toBe(2);
    expect(g().playTimeSec).toBe(90);
  });

  it('진행 중이던 노드(전투 도중 등)는 저장하지 않는다', () => {
    const first = g().map().floors[0][0];
    g().moveTo(first.id);
    expect(g().toSave()).toMatchObject({ mapNodeId: null, visitedNodes: [] });
    g().finishNode();
    expect(g().toSave()).toMatchObject({ mapNodeId: first.id, visitedNodes: [first.id] });
  });

  it('이기면 노드는 끝나고 보상 팩이 대기한다. 팩을 열면 비고, 관장이었으면 클리어 대기', () => {
    const op = enterFirst();
    const won = { ...createBattle(g().partyCards(), op.cards, dex, 1), result: 'win' as const };
    g().settleBattle(won, op);
    expect(g().toSave()).toMatchObject({ pendingReward: op.kind, pendingClear: false });
    expect(g().toSave().visitedNodes).toHaveLength(1);
    g().claimReward();
    expect(g()).toMatchObject({ pendingReward: null, pendingClear: false });
    useGameStore.setState({ pendingReward: 'leader' });
    g().claimReward();
    expect(g().pendingClear).toBe(true);
    g().completeChapter();
    expect(g().pendingClear).toBe(false);
  });

  it('스타터를 고르기 전에 저장해도 같은 5장이 남는다', () => {
    useGameStore.setState(initial, true);
    g().newGame({ slot: 1, difficulty: 'normal', challenges: { nuzlocke: false, randomStarter: false }, seed: 99 });
    g().openStarterPack();
    expect(g().toSave().starterChoices).toEqual(g().starterChoices);
  });
});

describe('난이도와 챌린지', () => {
  it('골드: 쉬움 ×1.5, 패배하면 어려움은 절반을 잃는다', () => {
    start('easy');
    const op = enterFirst('wild');
    const won = { ...createBattle(g().partyCards(), op.cards, dex, 1, { wild: true }), result: 'win' as const };
    expect(g().settleBattle(won, op)!.gold).toBe(Math.round((50 + op.cards[0].level * 5) * 1.5));
    start('hard');
    useGameStore.setState({ gold: 1001 });
    g().restartChapter();
    expect(g().gold).toBe(500);
  });

  it('휴식 회복: 어려움은 최대 HP의 50%만', () => {
    start('hard');
    const uid = g().party[0];
    useGameStore.setState({ hp: { [uid]: 0 } });
    g().restHeal();
    expect(g().hp[uid]).toBe(Math.ceil(maxHp(g().collection[0], dex) * 0.5));
  });

  it('너즐록: 쓰러진 파티 포켓몬은 보관함에서 사라지고, 하나도 안 남으면 게임 오버', () => {
    start('normal', true);
    g().openTypePack('water');
    const [a, b] = g().party;
    const op = enterFirst();
    const s = createBattle(g().partyCards(), op.cards, dex, 1);
    s.player.party.find((m) => m.card.uid === a)!.currentHp = 0;
    g().settleBattle({ ...s, result: 'win' }, op);
    expect(g().collection.some((c) => c.uid === a)).toBe(false);
    expect(g().party).not.toContain(a);
    expect(g().party).toContain(b);
    expect(g().lastLost).toHaveLength(1);
    expect(g().gameOver).toBe(false);
    const s2 = createBattle(g().partyCards(), op.cards, dex, 1);
    for (const m of s2.player.party) m.currentHp = 0;
    useGameStore.setState({ collection: g().partyCards() }); // 보관함 = 파티만 남기기
    g().settleBattle({ ...s2, result: 'lose' }, op);
    expect(g().gameOver).toBe(true);
  });

  it('랜덤 스타터: 같은 시드면 같은 포켓몬', () => {
    const pick = () => {
      useGameStore.setState(initial, true);
      g().newGame({ slot: 1, difficulty: 'normal', challenges: { nuzlocke: false, randomStarter: true }, seed: 7 });
      g().openStarterPack();
      const uid = g().chooseRandomStarter();
      return dex.species[g().collection.find((c) => c.uid === uid)!.speciesId].name;
    };
    expect(pick()).toBe(pick());
    expect(g().collection).toHaveLength(1);
  });
});
