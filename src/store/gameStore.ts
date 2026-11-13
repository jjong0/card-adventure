// src/store/gameStore.ts
// 진행 상태: 보관함·파티·골드·챕터·난수 시드. 규칙은 모두 core 함수가 처리하고 여기서는 상태만 바꾼다.
// 저장(localStorage, 세이브 파일)은 로드맵 7단계에서 saveRepository로 붙인다.
import { create } from 'zustand';
import chaptersJson from '../data/chapters.json';
import { sellCard, setParty as checkParty } from '../core/collection';
import { addToCollection, CARDS_PER_PACK, createRng, openPack, type AddResult } from '../core/gacha';
import type { Card, ChapterData, ElementType, Rarity } from '../core/types';
import { dex } from '../lib/dex';

const chapters = chaptersJson as ChapterData[];

export interface PackOpening {
  type: ElementType;
  minRarity?: Rarity;
  /** 팩에서 나온 5장 (합치기 전 모습) */
  cards: Card[];
  /** 카드별 결과: NEW / ★상승 / 진행도 / 골드 */
  results: AddResult[];
  gold: number;
}

interface GameStore {
  seed: number;
  chapter: number;
  gold: number;
  collection: Card[];
  party: string[];
  /** 스타터 팩에서 고를 5장. 고르면 비운다 */
  starterChoices: Card[] | null;

  chapterData: () => ChapterData;
  openStarterPack: () => void;
  chooseStarter: (uid: string) => void;
  openTypePack: (type: ElementType, minRarity?: Rarity) => PackOpening;
  updateCard: (card: Card) => void;
  sell: (uid: string) => 'not-found' | 'in-party' | number;
  setParty: (uids: string[]) => boolean;
}

/** 시드로 난수를 만들어 쓰고, 다음 시드를 돌려준다 */
function roll<T>(seed: number, f: (rng: () => number) => T): [T, number] {
  const rng = createRng(seed);
  const value = f(rng);
  return [value, Math.floor(rng() * 2 ** 32)];
}

export const useGameStore = create<GameStore>((set, get) => ({
  seed: Date.now() >>> 0, // 시드만 시각에서 얻고, 난수는 모두 createRng로 (새 게임 화면이 생기면 SaveData.seed)
  chapter: 1,
  gold: 0,
  collection: [],
  party: [],
  starterChoices: null,

  chapterData: () => chapters.find((c) => c.chapter === get().chapter) ?? chapters[0],

  openStarterPack: () => {
    const level = get().chapterData().packLevel;
    const [cards, seed] = roll(get().seed, (rng) =>
      openPack({ kind: 'starter', cardsPerPack: CARDS_PER_PACK, level }, dex, rng),
    );
    set({ starterChoices: cards, seed });
  },

  chooseStarter: (uid) => {
    const card = get().starterChoices?.find((c) => c.uid === uid);
    if (!card) return;
    const { collection } = addToCollection(get().collection, [card], dex.species);
    set({ collection, party: [...get().party, card.uid].slice(0, 6), starterChoices: null });
  },

  openTypePack: (type, minRarity) => {
    const level = get().chapterData().packLevel;
    const [cards, seed] = roll(get().seed, (rng) =>
      openPack({ kind: 'type', cardsPerPack: CARDS_PER_PACK, typeFilter: type, minRarity, level }, dex, rng),
    );
    const { collection, results, gold } = addToCollection(get().collection, cards, dex.species);
    set({ collection, seed, gold: get().gold + gold });
    return { type, minRarity, cards, results, gold };
  },

  updateCard: (card) => set({ collection: get().collection.map((c) => (c.uid === card.uid ? card : c)) }),

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
}));
