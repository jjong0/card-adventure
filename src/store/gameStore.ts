// src/store/gameStore.ts
// 진행 상태: 보관함·파티·골드·챕터·지도 위치·HP·가방. 규칙은 모두 core 함수가 처리하고 여기서는 상태만 바꾼다.
// 세이브 형식으로 바꾸기(toSave)·되돌리기(loadSave)를 여기서 하고, 저장소 접근은 saveRepository가 한다.
import { create } from 'zustand';
import { MAX_PARTY, sellCard, setParty as checkParty } from '../core/collection';
import { adjustGold, DIFFICULTY, goldAfterLoss, levelCap } from '../core/difficulty';
import { battleGold, rewardPackLevel, type BattleKind, type Opponent, type StarterType } from '../core/encounter';
import { addToCollection, CARDS_PER_PACK, createRng, openPack, type AddResult } from '../core/gacha';
import { HEAL_ITEMS, hpOf, maxHp, restParty, teachTm, useHealItem, type HpMap, type ShopItem } from '../core/items';
import { generateMap, reachableNodes, type ChapterMap } from '../core/map';
import { addLevels, distributeExp, evolve, evolveWithItem, gainExp, type LevelUpResult } from '../core/progress';
import { SAVE_VERSION } from '../core/save';
import type { BattleState, Card, ChapterData, Difficulty, ElementType, Rarity, SaveData } from '../core/types';
import { chapters, dex, tmData } from '../lib/dex';

/** 강화 노드에서 오르는 레벨 (spec §12 기본값) */
export const REST_LEVELS = 3;

export interface PackOpening {
  type: ElementType;
  minRarity?: Rarity;
  /** 팩에서 나온 5장 (합치기 전 모습) */
  cards: Card[];
  /** 카드별 결과: NEW / ★상승 / 진행도 / 골드 */
  results: AddResult[];
  gold: number;
}

/** 전투 승리 후 정산: 골드와 카드별 경험치·레벨업 */
export interface BattleSettlement {
  gold: number;
  growth: { exp: number; result: LevelUpResult }[];
}

export type Challenges = SaveData['challenges'];

export interface NewGameOptions {
  slot: number;
  difficulty: Difficulty;
  challenges: Challenges;
  seed: number;
}

interface GameStore {
  /** 지금 플레이 중인 세이브 슬롯 (1~3). 타이틀 화면이면 null */
  slot: number | null;
  createdAt: string;
  /** 세이브 고정 시드: 지도와 노드 상대를 정한다 */
  runSeed: number;
  /** 굴릴 때마다 바뀌는 시드: 팩·전투 난수 */
  seed: number;
  chapter: number;
  /** 시작할 때 고르고 바꿀 수 없다 (spec §5.3) */
  difficulty: Difficulty;
  challenges: Challenges;
  /** 준비된 챕터(1~2장)를 모두 끝냄 */
  finished: boolean;
  gold: number;
  badges: string[];
  collection: Card[];
  party: string[];
  starterType: StarterType;
  /** 스타터 팩에서 고를 5장. 고르면 비운다 */
  starterChoices: Card[] | null;
  /** 지금 서 있는 노드. 챕터를 막 시작했으면 null */
  mapNodeId: string | null;
  visitedNodes: string[];
  /** 지금 노드를 끝냈는지. 끝내기 전에 닫으면 노드에 들어가기 전 상태로 저장된다 */
  nodeDone: boolean;
  /** 현재 HP (없는 카드는 가득) */
  hp: HpMap;
  bag: Record<string, number>;
  /** 보유 기술머신 (move id) */
  tms: string[];
  /** 이기고 아직 열지 않은 보상 팩 */
  pendingReward: BattleKind | null;
  /** 그 보상 팩의 카드 레벨 */
  pendingRewardLevel: number | null;
  /** 관장을 이기고 아직 다음 챕터로 넘어가지 않음 */
  pendingClear: boolean;
  playTimeSec: number;
  /** 너즐록: 방금 전투에서 잃은 포켓몬 이름 */
  lastLost: string[];
  /** 너즐록: 카드가 하나도 남지 않음 */
  gameOver: boolean;

  chapterData: () => ChapterData;
  /** 지금 팩을 열면 나오는 카드 레벨 (보상 팩이 대기 중이면 그 레벨) */
  packLevel: () => number;
  map: () => ChapterMap;
  partyCards: () => Card[];

  newGame: (opts: NewGameOptions) => void;
  loadSave: (save: SaveData, slot: number) => void;
  toSave: () => SaveData;
  leaveToTitle: () => void;
  tick: (sec: number) => void;

  openStarterPack: () => void;
  chooseStarter: (uid: string) => void;
  /** 랜덤 스타터 챌린지: 5장 중 하나를 시드로 고른다 */
  chooseRandomStarter: () => string | null;
  openTypePack: (type: ElementType, minRarity?: Rarity) => PackOpening;
  updateCard: (card: Card) => void;
  sell: (uid: string) => 'not-found' | 'in-party' | number;
  setParty: (uids: string[]) => boolean;

  moveTo: (nodeId: string) => boolean;
  /** 보상 없이 노드를 끝냄 (도망, 상점에서 나감) */
  finishNode: () => void;
  nextSeed: () => number;
  /** 전투가 끝난 뒤: HP를 이어받고, 너즐록이면 쓰러진 카드를 잃고, 이겼으면 골드·경험치 정산 */
  settleBattle: (state: BattleState, opponent: Opponent) => BattleSettlement | null;
  /** 보상 팩을 열었음. 관장이었으면 클리어 대기로 */
  claimReward: () => void;
  evolveCard: (uid: string, to: string) => boolean;
  /** 패배: 챕터 처음부터, 카드 유지, 전원 회복, 난이도에 따라 골드를 잃음 (spec §1, §5.3) */
  restartChapter: () => void;
  /** 관장 승리: 배지·기술머신을 받고 다음 챕터로 */
  completeChapter: () => void;
  restHeal: () => void;
  restTrain: (uid: string) => LevelUpResult | null;
  buy: (item: ShopItem) => 'no-gold' | 'owned' | 'ok';
  /** 회복약·진화의돌 사용. 실패하면 이유 */
  applyItem: (itemId: string, uid: string) => string | null;
  teach: (uid: string, moveId: string) => string | null;
}

/** 시드로 난수를 만들어 쓰고, 다음 시드를 돌려준다 */
function roll<T>(seed: number, f: (rng: () => number) => T): [T, number] {
  const rng = createRng(seed);
  const value = f(rng);
  return [value, Math.floor(rng() * 2 ** 32)];
}

/** 레벨업·진화로 최대 HP가 늘면 늘어난 만큼 현재 HP도 올린다 (원작과 같음). 쓰러진 카드는 그대로 */
function growHp(hp: HpMap, before: Card, after: Card): HpMap {
  const now = hp[before.uid];
  if (now === undefined || now <= 0) return hp;
  return { ...hp, [before.uid]: Math.min(maxHp(after, dex), now + Math.max(0, maxHp(after, dex) - maxHp(before, dex))) };
}

const STARTER_TYPES: StarterType[] = ['grass', 'fire', 'water'];
const HEAL_ERROR: Record<string, string> = {
  fainted: '쓰러진 포켓몬에게는 쓸 수 없다.',
  full: 'HP가 가득 차 있다.',
  'not-fainted': '쓰러진 포켓몬에게만 쓸 수 있다.',
  'unknown-item': '쓸 수 없는 도구다.',
};
const TEACH_ERROR: Record<string, string> = {
  'not-a-tm': '기술머신이 아니다.',
  'cannot-learn': '이 포켓몬은 배울 수 없다.',
  'already-known': '이미 배운 기술이다.',
};

/** 새 게임을 시작하기 전의 빈 진행 상태 */
function blankRun(seed: number) {
  return {
    createdAt: new Date().toISOString(),
    runSeed: seed,
    seed,
    chapter: 1,
    difficulty: 'normal' as Difficulty,
    challenges: { nuzlocke: false, randomStarter: false },
    finished: false,
    gold: 0,
    badges: [] as string[],
    collection: [] as Card[],
    party: [] as string[],
    starterType: 'fire' as StarterType,
    starterChoices: null as Card[] | null,
    mapNodeId: null as string | null,
    visitedNodes: [] as string[],
    nodeDone: true,
    hp: {} as HpMap,
    bag: {} as Record<string, number>,
    tms: [] as string[],
    pendingReward: null as BattleKind | null,
    pendingRewardLevel: null as number | null,
    pendingClear: false,
    playTimeSec: 0,
    lastLost: [] as string[],
    gameOver: false,
  };
}

let mapCache: { key: string; map: ChapterMap } | null = null;

export const useGameStore = create<GameStore>((set, get) => {
  const replaceCard = (after: Card) => {
    const before = get().collection.find((c) => c.uid === after.uid);
    if (!before) return;
    set({ collection: get().collection.map((c) => (c.uid === after.uid ? after : c)), hp: growHp(get().hp, before, after) });
  };
  const fullHeal = (): HpMap => ({});

  /** 너즐록: 쓰러진 파티 포켓몬을 보관함에서 영구 삭제 (spec §5.3) */
  const applyNuzlocke = () => {
    if (!get().challenges.nuzlocke) return set({ lastLost: [] });
    const fainted = get().partyCards().filter((c) => (get().hp[c.uid] ?? 1) <= 0);
    const gone = new Set(fainted.map((c) => c.uid));
    const collection = get().collection.filter((c) => !gone.has(c.uid));
    set({
      collection,
      party: get().party.filter((u) => !gone.has(u)),
      lastLost: fainted.map((c) => dex.species[c.speciesId].name),
      gameOver: collection.length === 0,
    });
    // 파티가 비었는데 보관함에 카드가 남아 있으면 앞에서부터 채운다
    if (!get().party.length && collection.length) set({ party: collection.slice(0, MAX_PARTY).map((c) => c.uid) });
  };

  return {
    slot: null,
    ...blankRun(Date.now() >>> 0),

    chapterData: () => chapters.find((c) => c.chapter === get().chapter) ?? chapters[chapters.length - 1],

    packLevel: () => (get().pendingReward ? get().pendingRewardLevel : null) ?? get().chapterData().packLevel,

    map: () => {
      const { runSeed, chapter } = get();
      const key = `${runSeed}:${chapter}`;
      if (mapCache?.key !== key) mapCache = { key, map: generateMap(runSeed, chapter, { hasRival: !!get().chapterData().rivals }) };
      return mapCache.map;
    },

    partyCards: () => {
      const byUid = new Map(get().collection.map((c) => [c.uid, c]));
      return get().party.map((u) => byUid.get(u)).filter((c): c is Card => !!c);
    },

    // ── 세이브 ───────────────────────────────
    newGame: ({ slot, difficulty, challenges, seed }) => set({ ...blankRun(seed), slot, difficulty, challenges }),

    loadSave: (save, slot) =>
      set({
        ...blankRun(save.runSeed),
        ...save,
        slot,
        nodeDone: true,
        lastLost: [],
        gameOver: false,
      }),

    toSave: () => {
      const s = get();
      // 진행 중이던 노드는 저장하지 않는다: 다시 불러오면 그 노드에 들어가기 전으로
      const visited = s.nodeDone ? s.visitedNodes : s.visitedNodes.slice(0, -1);
      return {
        version: SAVE_VERSION,
        createdAt: s.createdAt,
        updatedAt: new Date().toISOString(),
        difficulty: s.difficulty,
        challenges: s.challenges,
        runSeed: s.runSeed,
        seed: s.seed,
        chapter: s.chapter,
        finished: s.finished,
        mapNodeId: visited.at(-1) ?? null,
        visitedNodes: visited,
        gold: s.gold,
        badges: s.badges,
        collection: s.collection,
        party: s.party,
        starterType: s.starterType,
        starterChoices: s.starterChoices,
        hp: s.hp,
        bag: s.bag,
        tms: s.tms,
        pendingReward: s.pendingReward,
        pendingRewardLevel: s.pendingRewardLevel,
        pendingClear: s.pendingClear,
        playTimeSec: Math.floor(s.playTimeSec),
      };
    },

    leaveToTitle: () => set({ slot: null }),

    tick: (sec) => set({ playTimeSec: get().playTimeSec + sec }),

    // ── 카드 ────────────────────────────────
    openStarterPack: () => {
      const level = get().chapterData().packLevel;
      const [cards, seed] = roll(get().seed, (rng) => openPack({ kind: 'starter', cardsPerPack: CARDS_PER_PACK, level }, dex, rng));
      set({ starterChoices: cards, seed });
    },

    chooseStarter: (uid) => {
      const card = get().starterChoices?.find((c) => c.uid === uid);
      if (!card) return;
      const { collection } = addToCollection(get().collection, [card], dex.species);
      const types = dex.species[card.speciesId].types;
      const starterType = STARTER_TYPES.find((t) => types.includes(t)) ?? 'fire';
      set({ collection, party: [...get().party, card.uid].slice(0, MAX_PARTY), starterChoices: null, starterType });
    },

    chooseRandomStarter: () => {
      const choices = get().starterChoices;
      if (!choices) return null;
      const [card, seed] = roll(get().seed, (rng) => choices[Math.floor(rng() * choices.length)]);
      set({ seed });
      get().chooseStarter(card.uid);
      return card.uid;
    },

    openTypePack: (type, minRarity) => {
      const level = get().packLevel();
      const [cards, seed] = roll(get().seed, (rng) =>
        openPack({ kind: 'type', cardsPerPack: CARDS_PER_PACK, typeFilter: type, minRarity, level }, dex, rng),
      );
      const { collection, results, gold } = addToCollection(get().collection, cards, dex.species);
      // 새로 얻은 카드는 파티에 빈 칸이 있으면 바로 합류한다 (원작에서 잡은 포켓몬이 파티에 들어가듯)
      const party = [...get().party];
      for (const r of results) if (r.kind === 'new' && party.length < MAX_PARTY) party.push(r.card.uid);
      set({ collection, party, seed, gold: get().gold + gold });
      return { type, minRarity, cards, results, gold };
    },

    updateCard: replaceCard,

    sell: (uid) => {
      const r = sellCard(get().collection, get().party, uid, dex);
      if (typeof r === 'string') return r;
      set({ collection: r.collection, gold: get().gold + r.gold });
      return r.gold;
    },

    setParty: (uids) => {
      const r = checkParty(get().collection, uids);
      if (typeof r === 'string') return false;
      set({ party: r });
      return true;
    },

    // ── 지도 진행 ────────────────────────────
    moveTo: (nodeId) => {
      if (!reachableNodes(get().map(), get().mapNodeId).includes(nodeId)) return false;
      set({ mapNodeId: nodeId, visitedNodes: [...get().visitedNodes, nodeId], nodeDone: false });
      return true;
    },

    finishNode: () => set({ nodeDone: true }),

    nextSeed: () => {
      const [value, seed] = roll(get().seed, (rng) => Math.floor(rng() * 2 ** 32));
      set({ seed });
      return value;
    },

    settleBattle: (state, opponent) => {
      const hp = { ...get().hp };
      for (const m of state.player.party) hp[m.card.uid] = m.currentHp;
      set({ hp });
      applyNuzlocke();
      if (state.result !== 'win') return null;

      const cap = levelCap(get().chapterData(), get().difficulty);
      const gained = distributeExp(state, opponent.kind !== 'wild', dex.species);
      const growth: BattleSettlement['growth'] = [];
      for (const [uid, exp] of Object.entries(gained)) {
        const card = get().collection.find((c) => c.uid === uid);
        if (!card) continue; // 너즐록으로 잃은 카드
        const result = gainExp(card, exp, dex, cap);
        replaceCard(result.card);
        growth.push({ exp, result });
      }
      const gold = adjustGold(battleGold(opponent), get().difficulty);
      // 승리로 노드는 끝났다. 보상 팩은 열 때까지 남겨 둔다 (닫았다 열어도 팩부터)
      const rewardLevel = rewardPackLevel(opponent, get().chapterData(), get().difficulty);
      set({ gold: get().gold + gold, nodeDone: true, pendingReward: opponent.kind, pendingRewardLevel: rewardLevel });
      return { gold, growth };
    },

    claimReward: () => set({ pendingClear: get().pendingReward === 'leader', pendingReward: null, pendingRewardLevel: null }),

    evolveCard: (uid, to) => {
      const card = get().collection.find((c) => c.uid === uid);
      const r = card ? evolve(card, to, dex) : 'invalid';
      if (r === 'invalid') return false;
      replaceCard(r.card);
      return true;
    },

    restartChapter: () =>
      set({ mapNodeId: null, visitedNodes: [], nodeDone: true, hp: fullHeal(), gold: goldAfterLoss(get().gold, get().difficulty) }),

    completeChapter: () => {
      const ch = get().chapterData();
      const hasNext = chapters.some((c) => c.chapter === ch.chapter + 1);
      set({
        badges: get().badges.includes(ch.leader.key) ? get().badges : [...get().badges, ch.leader.key],
        tms: get().tms.includes(ch.rewardTm.moveId) ? get().tms : [...get().tms, ch.rewardTm.moveId],
        chapter: hasNext ? ch.chapter + 1 : ch.chapter,
        finished: !hasNext,
        mapNodeId: null,
        visitedNodes: [],
        nodeDone: true,
        pendingClear: false,
        hp: fullHeal(),
      });
    },

    restHeal: () => set({ hp: restParty(get().partyCards(), get().hp, dex, DIFFICULTY[get().difficulty].restHeal), nodeDone: true }),

    restTrain: (uid) => {
      const card = get().collection.find((c) => c.uid === uid);
      if (!card) return null;
      const result = addLevels(card, REST_LEVELS, dex);
      replaceCard(result.card);
      set({ nodeDone: true });
      return result;
    },

    buy: (item) => {
      if (get().gold < item.price) return 'no-gold';
      if (item.category === 'tm') {
        if (get().tms.includes(item.moveId!)) return 'owned';
        set({ gold: get().gold - item.price, tms: [...get().tms, item.moveId!] });
      } else {
        set({ gold: get().gold - item.price, bag: { ...get().bag, [item.id]: (get().bag[item.id] ?? 0) + 1 } });
      }
      return 'ok';
    },

    applyItem: (itemId, uid) => {
      const card = get().collection.find((c) => c.uid === uid);
      if (!card || (get().bag[itemId] ?? 0) <= 0) return '가방에 없는 도구다.';
      const spend = () => set({ bag: { ...get().bag, [itemId]: get().bag[itemId] - 1 } });
      if (HEAL_ITEMS.some((i) => i.id === itemId)) {
        const r = useHealItem(itemId, card, get().hp, dex);
        if (typeof r === 'string') return HEAL_ERROR[r];
        set({ hp: r });
        spend();
        return null;
      }
      const r = evolveWithItem(card, itemId, dex);
      if (r === 'invalid') return '이 포켓몬에게는 효과가 없다.';
      replaceCard(r.card);
      spend();
      return null;
    },

    teach: (uid, moveId) => {
      const card = get().collection.find((c) => c.uid === uid);
      if (!card || !get().tms.includes(moveId)) return '가지고 있지 않은 기술머신이다.';
      const r = teachTm(card, moveId, tmData);
      if (typeof r === 'string') return TEACH_ERROR[r];
      replaceCard(r);
      return null;
    },
  };
});

/** 화면 표시용: 카드의 현재 HP */
export function currentHp(card: Card, hp: HpMap): number {
  return hpOf(card, hp, dex);
}
