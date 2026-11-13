// src/core/encounter.ts
// 전투 상대 생성: 원본 트레이너 파티 → 전투용 카드 (docs/spec.md §3.4, §5.3)
// 난이도 보정(레벨·개체값·관장 파티)은 지도 단계(로드맵 6단계)에서 추가한다.
import { defaultEquip, learnableUpTo } from './card';
import { lineRootOf } from './gacha';
import type { Card, Learnsets, Move, Species, Stats, Trainer } from './types';

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
