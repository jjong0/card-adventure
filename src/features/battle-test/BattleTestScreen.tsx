// 전투 테스트 화면 (로드맵 4단계): 성도 스타터 3마리로 관장 비상과 대결
// 지도·저장이 생기면(6~7단계) 실제 진행 흐름으로 대체한다.
import { useCallback, useEffect } from 'react';
import { trainerCards } from '../../core/encounter';
import { createCard, createRng } from '../../core/gacha';
import { dex, trainers } from '../../lib/dex';
import { useBattleStore } from '../../store/battleStore';
import { BattleScreen } from '../battle/BattleScreen';

const TEST_PARTY = ['155', '158', '152']; // 브케인, 리아코, 치코리타
const TEST_LEVEL = 12;                    // 비상 에이스 Lv13 근처

/** 주소에 ?moves=crunch,ice-beam 처럼 기술 slug를 주면 첫 포켓몬이 그 기술(최대 4개)을 쓴다 (연출 확인용) */
function movesFromUrl(): string[] {
  const slugs = new URLSearchParams(window.location.search).get('moves')?.split(',') ?? [];
  const bySlug = new Map(Object.values(dex.moves).map((m) => [m.slug, m.id]));
  return slugs.map((s) => bySlug.get(s.trim())).filter((id): id is string => !!id).slice(0, 4);
}

export function BattleTestScreen() {
  const start = useBattleStore((s) => s.start);

  const restart = useCallback(() => {
    const seed = Date.now() >>> 0; // 시드만 시각에서 얻고, 난수는 모두 createRng로
    const rng = createRng(seed);
    const party = TEST_PARTY.map((id) => createCard(dex.species[id], TEST_LEVEL, dex, rng));
    const custom = movesFromUrl();
    if (custom.length) party[0] = { ...party[0], moves: custom, learnedMoves: [...new Set([...party[0].learnedMoves, ...custom])] };
    const falkner = trainers.find((t) => t.key === 'falkner' && t.battle === 'story')!;
    start(party, trainerCards(falkner, dex), seed);
  }, [start]);

  useEffect(restart, [restart]);

  return (
    <div className="relative h-full w-full">
      <BattleScreen canRun={false} onRestart={restart} />
      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 text-center font-pixel text-[12px] leading-5 text-text-dim">
        <p>테스트 전투 · 관장 비상</p>
        <p className="opacity-70">비공식 팬 프로젝트 · 닌텐도·게임프리크·주식회사 포켓몬과 무관</p>
      </div>
    </div>
  );
}
