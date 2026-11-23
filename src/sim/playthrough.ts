// src/sim/playthrough.ts
// 밸런스 측정용 자동 플레이 봇 (로드맵 8단계). 실제 게임과 같은 스토어·엔진으로 1~2장을 끝까지 진행한다.
// 화면 없이 돌아가므로 같은 시드면 같은 결과. 실행: npm run sim
import { battle, chooseEnemyAction, createBattle } from '../core/battle';
import { allocateIv, STAT_KEYS } from '../core/card';
import { nodeOpponent, type Opponent } from '../core/encounter';
import { HEAL_ITEMS, hpOf, maxHp } from '../core/items';
import { reachableNodes, type MapNode } from '../core/map';
import { levelEvolutions } from '../core/progress';
import type { BattleAction, BattleState, Card, Difficulty, ElementType } from '../core/types';
import { dex, trainers } from '../lib/dex';
import { useGameStore } from '../store/gameStore';

const g = () => useGameStore.getState();

/** 플레이어 쪽도 상대 AI와 같은 기준(기대 데미지 최대)으로 기술을 고른다: 양쪽을 바꿔 넣어 재사용 */
function playerAction(state: BattleState): BattleAction {
  return chooseEnemyAction({ ...state, player: state.enemy, enemy: state.player }, dex);
}

/** 승부가 날 때까지. 쓰러지면 남은 포켓몬 중 레벨이 가장 높은 쪽을 내보낸다 */
function fight(state: BattleState): BattleState {
  for (let i = 0; i < 500 && state.result === 'ongoing'; i++) {
    if (state.pendingSwitch) {
      const alive = state.player.party.map((m, idx) => ({ m, idx })).filter((x) => x.m.currentHp > 0);
      alive.sort((a, b) => b.m.card.level - a.m.card.level);
      state = battle(state, { kind: 'switch', toIdx: alive[0].idx }, dex);
    } else {
      state = battle(state, playerAction(state), dex);
    }
  }
  return state;
}

/** 다음 관장 타입에 효과가 굉장한 속성 (팩 고르기) */
function advantageTypes(leaderType: ElementType): ElementType[] {
  return (Object.keys(dex.typeChart) as ElementType[]).filter((t) => dex.typeChart[t][leaderType] > 1);
}

/** 레벨 높은 6마리를 파티로, 개체값 포인트는 더 높은 공격 스탯과 스피드에 */
function manageCards() {
  for (const c of g().collection) {
    let card = c;
    const sp = dex.species[card.speciesId].baseStats;
    const order: (typeof STAT_KEYS)[number][] = [sp.atk >= sp.spAtk ? 'atk' : 'spAtk', 'spd', 'hp'];
    for (const stat of order) {
      for (;;) {
        const next = allocateIv(card, stat, 1);
        if (typeof next === 'string') break;
        card = next;
      }
    }
    if (card !== c) g().updateCard(card);
  }
  const best = [...g().collection].sort((a, b) => b.level - a.level).slice(0, 6).map((c) => c.uid);
  g().setParty(best);
}

function evolveAll() {
  for (const c of g().collection) {
    let card: Card | undefined = c;
    while (card && levelEvolutions(card, dex).length) {
      g().evolveCard(card.uid, levelEvolutions(card, dex)[0].to);
      card = g().collection.find((x) => x.uid === c.uid);
    }
  }
}

function hpRatio(): number {
  const party = g().partyCards();
  const now = party.reduce((a, c) => a + hpOf(c, g().hp, dex), 0);
  const max = party.reduce((a, c) => a + maxHp(c, dex), 0);
  return max ? now / max : 0;
}

/** 전투 전: 회복약으로 가장 많이 다친 포켓몬부터, 쓰러진 포켓몬은 기력의조각 */
function usePotions() {
  for (const c of g().partyCards()) {
    const fainted = hpOf(c, g().hp, dex) <= 0;
    for (const item of fainted ? ['revive'] : HEAL_ITEMS.filter((i) => i.heal !== 'revive').map((i) => i.id)) {
      while ((g().bag[item] ?? 0) > 0 && hpOf(c, g().hp, dex) < maxHp(c, dex) * 0.6) {
        if (g().applyItem(item, c.uid)) break;
      }
    }
  }
}

const TIER_RANK = { rare: 3, uncommon: 2, common: 1 } as const;

/** 가방의 지닌 도구를 도구가 없는 파티 포켓몬에게 (등급 높은 도구를 레벨 높은 포켓몬부터) */
function equipHeldItems() {
  const items = Object.keys(g().bag).filter((k) => dex.items[k] && g().bag[k] > 0);
  items.sort((a, b) => TIER_RANK[dex.items[b].tier] - TIER_RANK[dex.items[a].tier]);
  const bare = g().partyCards().filter((c) => !c.heldItem).sort((a, b) => b.level - a.level);
  for (const [i, c] of bare.entries()) if (items[i]) g().equipItem(c.uid, items[i]);
}

function openRewardPack(kindOrType: Opponent['kind'] | null, typeIdx: number) {
  const types = advantageTypes(g().chapterData().type);
  const type = types[typeIdx % types.length];
  const min = kindOrType === 'elite' ? 'R' : kindOrType === 'leader' ? 'SR' : undefined;
  g().openTypePack(type, min);
  g().claimReward();
}

/**
 * 사람처럼 고른다: 지도에 보이는 상대 최고 레벨을 보고 내 레벨보다 많이 높은 노드는 피한다.
 * HP가 낮으면 휴식, 골드가 넉넉하면 상점(챕터당 한 번), 그 밖에는 이길 만한 전투 중 보상이 큰 쪽.
 */
function pickNode(nodes: MapNode[], shopVisited: boolean, preview: (n: MapNode) => Opponent | null, lostAt: Set<string>): MapNode {
  const ratio = hpRatio();
  const by = (k: MapNode['kind']) => nodes.find((n) => n.kind === k);
  if (ratio < 0.6 && by('rest')) return by('rest')!;
  if (!shopVisited && g().gold >= 1500 && by('shop')) return by('shop')!;
  if (by('leader')) return by('leader')!;
  if (by('treasure')) return by('treasure')!;
  const alive = g().partyCards().filter((c) => hpOf(c, g().hp, dex) > 0);
  const top = Math.max(...alive.map((c) => c.level));
  const myPower = alive.reduce((a, c) => a + c.level, 0);
  const battles = nodes
    .map((n) => ({ n, op: preview(n) }))
    .filter((x): x is { n: MapNode; op: Opponent } => x.op !== null)
    .map((x) => ({
      ...x,
      gap: Math.max(...x.op.cards.map((c) => c.level)) - top,
      // 마릿수까지 본 전력 비: 상대 레벨 합 ÷ 내 살아 있는 파티 레벨 합
      power: x.op.cards.reduce((a, c) => a + c.level, 0) / Math.max(1, myPower),
    }));
  const reward = { elite: 3, trainer: 2, wild: 1, leader: 0 } as const;
  // 이길 만한 전투(최고 레벨이 2 이상 높지 않고, 전력이 내 파티의 1.2배 이하, 전에 진 노드 아님) 중 보상 큰 쪽.
  // 없으면 전력 비가 가장 작은 쪽
  const safe = battles.filter((b) => b.gap <= 1 && b.power <= 1.2 && !lostAt.has(b.n.id) && (b.op.kind !== 'elite' || ratio > 0.8));
  if (safe.length) return safe.sort((a, b) => reward[b.op.kind] - reward[a.op.kind] || a.gap - b.gap)[0].n;
  if (battles.length) return battles.sort((a, b) => Number(lostAt.has(a.n.id)) - Number(lostAt.has(b.n.id)) || a.power - b.power)[0].n;
  return by('rest') ?? by('event') ?? by('shop') ?? nodes[0];
}

export interface ChapterStat {
  chapter: number;
  cleared: boolean;
  restarts: number;
  battles: number;
  /** 관장전 직전 파티 최고 레벨 */
  topLevel: number;
  partySize: number;
  /** 진 곳: "층 종류 내최고Lv/상대최고Lv" */
  losses: string[];
}

export interface RunResult {
  difficulty: Difficulty;
  seed: number;
  chapters: ChapterStat[];
  gameOver: boolean;
}

/** 한 판: 새 게임부터 준비된 챕터를 끝낼 때까지 (챕터마다 재시작 maxRestarts번까지) */
export function playthrough(difficulty: Difficulty, seed: number, maxRestarts = 8): RunResult {
  useGameStore.getState().newGame({ slot: 1, difficulty, challenges: { nuzlocke: false, randomStarter: false }, seed });
  g().openStarterPack();
  g().chooseRandomStarter(); // 사람마다 고르는 스타터가 달라서 무작위
  const chapters: ChapterStat[] = [];
  let typeIdx = 0;

  while (!g().finished && !g().gameOver) {
    const chapter = g().chapter;
    const stat: ChapterStat = { chapter, cleared: false, restarts: 0, battles: 0, topLevel: 0, partySize: 0, losses: [] };
    let shopVisited = false;
    const lostAt = new Set<string>();
    while (g().chapter === chapter && !g().finished && stat.restarts <= maxRestarts) {
      const map = g().map();
      const ids = reachableNodes(map, g().mapNodeId);
      const ctx = { totalFloors: map.floors.length, chapter: g().chapterData(), trainers, starterType: g().starterType, difficulty, seed: g().runSeed };
      const preview = (n: MapNode) => nodeOpponent(n, ctx, dex);
      const node = pickNode(map.floors.flat().filter((n) => ids.includes(n.id)), shopVisited, preview, lostAt);
      g().moveTo(node.id);
      let op = preview(node);

      if (node.kind === 'treasure') {
        const best = [...g().treasureChoices()].sort((a, b) => TIER_RANK[dex.items[b].tier] - TIER_RANK[dex.items[a].tier])[0];
        g().claimTreasure(best);
        equipHeldItems();
        continue;
      }
      if (node.kind === 'event') {
        // 골드가 드는 선택지는 넉넉할 때만, 그 밖에는 첫 선택지 (사람은 대개 "해 본다"를 고른다)
        const ev = g().currentEvent()!;
        const idx = ev.choices.findIndex((c) => !c.goldPerChapter || g().gold >= c.goldPerChapter * chapter + 1000);
        const r = g().chooseEvent(Math.max(0, idx));
        if (typeof r === 'string') { g().finishNode(); continue; }
        equipHeldItems();
        evolveAll();
        if (!r.battle) continue;
        op = preview({ ...node, kind: r.battle });
      }

      if (node.kind === 'rest') {
        if (hpRatio() < 0.95) g().restHeal();
        else g().restTrain([...g().partyCards()].sort((a, b) => b.level - a.level)[0].uid);
        evolveAll();
        continue;
      }
      if (node.kind === 'shop') {
        shopVisited = true;
        for (const id of ['super-potion', 'super-potion', 'revive', 'potion', 'potion']) {
          const item = { id, name: id, price: HEAL_ITEMS.find((i) => i.id === id)!.price, category: 'heal' as const };
          if (g().gold - item.price >= 500) g().buy(item);
        }
        g().finishNode();
        continue;
      }
      if (!op) continue;
      usePotions();
      if (node.kind === 'leader') {
        stat.topLevel = Math.max(...g().partyCards().map((c) => c.level));
        stat.partySize = g().party.length;
      }
      const start = createBattle(g().partyCards(), op.cards, dex, g().nextSeed(), { playerHp: g().hp, wild: op.kind === 'wild', randomAi: op.randomAi });
      const end = fight(start);
      stat.battles++;
      const settled = g().settleBattle(end, op);
      if (!settled) {
        const mine = Math.max(...start.player.party.map((m) => m.card.level));
        const theirs = Math.max(...op.cards.map((c) => c.level));
        stat.losses.push(`${node.floor}층 ${op.kind} ${mine}/${theirs}`);
        lostAt.add(node.id);
        g().restartChapter();
        stat.restarts++;
        shopVisited = false;
        continue;
      }
      evolveAll();
      openRewardPack(op.kind, typeIdx++);
      manageCards();
      if (op.kind === 'leader') {
        stat.cleared = true;
        g().completeChapter();
      }
    }
    chapters.push(stat);
    if (!stat.cleared) break;
  }
  return { difficulty, seed, chapters, gameOver: g().gameOver };
}
