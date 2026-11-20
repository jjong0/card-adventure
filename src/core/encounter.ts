// src/core/encounter.ts
// 전투 상대 생성: 지도 노드 → 야생·트레이너·엘리트·관장 상대와 보상 (docs/spec.md §3.2~3.4)
// 난이도 보정(레벨·개체값·관장 파티, §5.3)은 difficulty.ts 규칙을 쓴다.
import { defaultEquip, learnableUpTo } from './card';
import { adjustOpponent, DIFFICULTY, leaderTrainer } from './difficulty';
import { createCard, createRng, lineRootOf, type Rng } from './gacha';
import type { MapNode } from './map';
import type { Card, ChapterData, Difficulty, Learnsets, Move, Rarity, Species, Stats, Trainer } from './types';

export interface EncounterDex {
  species: Record<string, Species>;
  moves: Record<string, Move>;
  learnsets: Learnsets;
}

const allStats = (v: number): Stats => ({ hp: v, atk: v, def: v, spAtk: v, spDef: v, spd: v });
const ZERO = allStats(0);

/**
 * 원본 트레이너의 파티를 카드로 바꾼다.
 * - 개체값은 원작처럼 전 스탯 동일 (trainers.json의 iv)
 * - 기술이 비어 있으면 원작처럼 그 레벨까지 배우는 레벨업 기술 중 최근 4개
 */
export function trainerCards(trainer: Trainer, dex: EncounterDex): Card[] {
  return trainer.party.map((p, i) => {
    const learned = learnableUpTo(dex.learnsets[p.speciesId], p.level);
    const listed = p.moves.filter((id) => dex.moves[id]);
    const moves = listed.length ? listed : defaultEquip(learned);
    return {
      uid: `trainer-${trainer.index}-${i}`,
      speciesId: p.speciesId,
      lineId: lineRootOf(p.speciesId, dex.species),
      level: p.level,
      exp: 0,
      star: 1,
      dupProgress: 0,
      ivBase: allStats(p.iv),
      ivAlloc: { ...ZERO },
      ivPoints: 0,
      learnedMoves: [...new Set([...learned, ...moves])],
      moves,
      heldItem: p.item?.slug ?? null,
    };
  });
}

// ════════════════════════════════════════════
// 지도 노드의 상대
// ════════════════════════════════════════════

export type StarterType = 'grass' | 'fire' | 'water';
export type BattleKind = 'wild' | 'trainer' | 'elite' | 'leader';

export interface Opponent {
  kind: BattleKind;
  /** 화면 표시 이름 (야생 구구, 곤충채집소년, 라이벌, 관장 비상) */
  name: string;
  /** 트레이너 직업 (assets.json 이미지 키). 야생은 없음 */
  trainerClass?: string;
  rival?: boolean;
  /** 상대가 기술을 무작위로 고른다 (야생, 쉬움) */
  randomAi: boolean;
  cards: Card[];
}

/** 노드 상대를 정하는 데 필요한 진행 상황 */
export interface EncounterContext {
  /** 지도 층 수 (트레이너 강도를 층 위치로 정한다) */
  totalFloors: number;
  chapter: ChapterData;
  trainers: Trainer[];
  starterType: StarterType;
  difficulty: Difficulty;
  /** 세이브 고정 시드 */
  seed: number;
}

/** 엘리트 노드 후보: 그 챕터 풀에서 파티 최고 레벨이 가장 높은 순으로 이만큼 */
const ELITE_POOL = 5;

/** 노드마다 고정된 시드: 같은 세이브에서 같은 노드는 다시 도전해도 같은 상대 */
export function nodeSeed(seed: number, chapter: number, node: Pick<MapNode, 'floor' | 'index'>): number {
  return (seed ^ Math.imul(chapter, 0x85ebca6b) ^ Math.imul(node.floor * 31 + node.index + 1, 0xc2b2ae35)) >>> 0;
}

const maxLevel = (t: Trainer) => Math.max(...t.party.map((p) => p.level));

/** 야생 포켓몬 1마리: 챕터 출현표의 확률대로, 레벨은 출현 범위에서 (spec §3.3) */
export function wildCard(chapter: ChapterData, dex: EncounterDex, rng: Rng): Card {
  const total = chapter.wild.reduce((a, w) => a + w.weight, 0);
  let x = rng() * total;
  const entry = chapter.wild.find((w) => (x -= w.weight) < 0) ?? chapter.wild[chapter.wild.length - 1];
  const level = entry.minLevel + Math.floor(rng() * (entry.maxLevel - entry.minLevel + 1));
  return createCard(dex.species[entry.speciesId], level, dex, rng);
}

/** 트레이너 노드가 고르는 범위: 풀을 레벨순으로 놓았을 때 층 위치 주변의 이 비율만큼 */
const TRAINER_WINDOW = 0.25;

/**
 * 전투 노드의 상대. 상점·휴식 노드는 null.
 * - 트레이너: 챕터 풀을 레벨순으로 놓고 층 위치에 맞는 구간에서 무작위.
 *   낮은 층은 약한 트레이너, 높은 층은 강한 트레이너 (스타터 한 마리로 Lv13 상대를 만나지 않게)
 * - 엘리트: 풀에서 가장 강한 몇 명 중 하나, 라이벌 노드면 라이벌
 * - 라이벌은 내 스타터에게 유리한 스타터를 가진 쪽 (chapters.json rivals)
 */
export function nodeOpponent(node: MapNode, ctx: EncounterContext, dex: EncounterDex): Opponent | null {
  const { totalFloors, chapter, trainers, starterType, difficulty, seed } = ctx;
  const rng = createRng(nodeSeed(seed, chapter.chapter, node));
  const byIndex = (i: number) => trainers.find((t) => t.index === i)!;
  const randomAi = DIFFICULTY[difficulty].randomAi;
  const fromTrainer = (t: Trainer, kind: BattleKind, name = t.name): Opponent => ({
    kind, name, trainerClass: t.class, randomAi, cards: adjustOpponent(trainerCards(t, dex), difficulty, rng),
  });

  switch (node.kind) {
    case 'wild': {
      // 야생은 레벨만 난이도를 따른다 (개체값은 원래 무작위, 기술 선택도 늘 무작위)
      const base = wildCard(chapter, dex, rng);
      const [card] = adjustOpponent([base], difficulty, rng).map((c) => ({ ...c, ivBase: base.ivBase }));
      return { kind: 'wild', name: `야생 ${dex.species[card.speciesId].name}`, randomAi: true, cards: [card] };
    }
    case 'trainer': {
      const pool = chapter.trainers.map(byIndex).sort((a, b) => maxLevel(a) - maxLevel(b) || a.index - b.index);
      // 일반 노드가 있는 층은 1 ~ totalFloors-2 (그 위는 휴식·관장)
      const progress = totalFloors > 3 ? Math.min(1, (node.floor - 1) / (totalFloors - 3)) : 0;
      const size = Math.max(1, Math.round(pool.length * TRAINER_WINDOW));
      const start = Math.round(progress * (pool.length - size));
      return fromTrainer(pool[start + Math.floor(rng() * size)], 'trainer');
    }
    case 'elite': {
      if (node.rival && chapter.rivals) return { ...fromTrainer(byIndex(chapter.rivals[starterType]), 'elite'), rival: true };
      const strongest = chapter.trainers.map(byIndex).sort((a, b) => maxLevel(b) - maxLevel(a) || a.index - b.index).slice(0, ELITE_POOL);
      return fromTrainer(strongest[Math.floor(rng() * strongest.length)], 'elite');
    }
    case 'leader': {
      const story = byIndex(chapter.leader.trainerIndex);
      const rematch = trainers.find((t) => t.key === story.key && t.battle === 'rematch');
      return fromTrainer(leaderTrainer(story, rematch, difficulty), 'leader', `관장 ${story.name}`);
    }
    default:
      return null;
  }
}

// ════════════════════════════════════════════
// 보상
// ════════════════════════════════════════════

/**
 * 승리 골드 (spec §12 기본값). 야생 50 + 레벨×5.
 * 트레이너는 원작 상금 공식(마지막 포켓몬 레벨 × 직업별 기본 상금 × 4)을 따르되,
 * 직업별 기본 상금 데이터가 없어 일반 10(레벨×40), 관장 30(레벨×120)으로 통일했다. 엘리트는 ×2.
 */
export function battleGold(op: Opponent): number {
  const last = op.cards[op.cards.length - 1].level;
  if (op.kind === 'wild') return 50 + last * 5;
  if (op.kind === 'leader') return last * 120;
  return last * 40 * (op.kind === 'elite' ? 2 : 1);
}

/** 승리 보상 팩의 최소 등급: 엘리트 R 이상, 관장 SR 이상 (spec §3.2) */
export function rewardMinRarity(kind: BattleKind): Rarity | undefined {
  return kind === 'elite' ? 'R' : kind === 'leader' ? 'SR' : undefined;
}
