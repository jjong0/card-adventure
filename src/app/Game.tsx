// 게임 진행 흐름: 스타터 → 지도 ↔ (전투 → 정산 → 보상 팩) / 휴식 / 상점 / 보관함 → 관장 → 다음 챕터
// 타이틀·새 게임·저장은 로드맵 7단계에서 이 앞에 붙는다.
import { useState } from 'react';
import { fixJosa } from '../core/battle';
import { rewardMinRarity, type Opponent } from '../core/encounter';
import type { MapNode } from '../core/map';
import type { BattleState } from '../core/types';
import { BagPanel } from '../features/bag/BagPanel';
import { BattleScreen } from '../features/battle/BattleScreen';
import { BoxScreen } from '../features/box/BoxScreen';
import { MapScreen } from '../features/map/MapScreen';
import { PackScreen } from '../features/pack/PackScreen';
import { StarterScreen } from '../features/pack/StarterScreen';
import { RestScreen } from '../features/rest/RestScreen';
import { BattleResultScreen } from '../features/result/BattleResultScreen';
import { ShopScreen } from '../features/shop/ShopScreen';
import { dex } from '../lib/dex';
import { useBattleStore } from '../store/battleStore';
import { useGameStore, type BattleSettlement } from '../store/gameStore';

type Phase =
  | { name: 'map'; notice?: string }
  | { name: 'battle'; opponent: Opponent }
  | { name: 'result'; opponent: Opponent; settlement: BattleSettlement }
  | { name: 'pack'; opponent: Opponent }
  | { name: 'clear' }
  | { name: 'rest' }
  | { name: 'shop' }
  | { name: 'box' };

export function Game() {
  const game = useGameStore();
  const startBattle = useBattleStore((s) => s.start);
  const [phase, setPhase] = useState<Phase>({ name: 'map' });
  const [bagOpen, setBagOpen] = useState(false);
  const toMap = (notice?: string) => setPhase({ name: 'map', notice });

  if (!game.collection.length) return <StarterScreen />;

  const enter = (node: MapNode, opponent: Opponent | null) => {
    if (opponent) {
      startBattle(game.partyCards(), opponent.cards, game.nextSeed(), { playerHp: game.hp, wild: opponent.kind === 'wild', randomAi: opponent.randomAi });
      setPhase({ name: 'battle', opponent });
    } else {
      setPhase(node.kind === 'shop' ? { name: 'shop' } : { name: 'rest' });
    }
  };

  const endBattle = (opponent: Opponent) => (state: BattleState) => {
    const settlement = game.settleBattle(state, opponent);
    if (settlement) return setPhase({ name: 'result', opponent, settlement });
    game.restartChapter();
    toMap('눈앞이 깜깜해졌다… 포켓몬센터에서 회복하고 챕터 처음부터 다시 도전한다.');
  };

  const runAway = (opponent: Opponent) => () => {
    const state = useBattleStore.getState().state;
    if (state) game.settleBattle(state, opponent);
    toMap('무사히 도망쳤다. 보상은 없다.');
  };

  switch (phase.name) {
    case 'battle':
      return (
        <BattleScreen
          onRun={phase.opponent.kind === 'wild' ? runAway(phase.opponent) : undefined}
          onEnd={endBattle(phase.opponent)}
          endLabel={{ win: '결과 보기', lose: '챕터 처음부터 다시' }}
        />
      );
    case 'result':
      return <BattleResultScreen opponent={phase.opponent} settlement={phase.settlement} onNext={() => setPhase({ name: 'pack', opponent: phase.opponent })} />;
    case 'pack':
      return (
        <PackScreen
          reward={{
            minRarity: rewardMinRarity(phase.opponent.kind),
            onDone: () => (phase.opponent.kind === 'leader' ? setPhase({ name: 'clear' }) : toMap()),
          }}
        />
      );
    case 'clear': {
      const ch = game.chapterData();
      const hasNext = !game.finished;
      return (
        <div className="flex h-full flex-col items-center justify-center gap-5 text-center font-pixel">
          <h2 className="font-title text-[44px] text-accent">{ch.chapter}장 클리어!</h2>
          <p className="text-[16px]">{fixJosa(`관장 ${ch.leader.name}을(를) 이기고 배지를 손에 넣었다.`)}</p>
          <p className="text-[15px] text-text-dim">
            {ch.rewardTm.name} <span className="text-text">{dex.moves[ch.rewardTm.moveId].name}</span>도 받았다. 가방에서 포켓몬에게 가르칠 수 있다.
          </p>
          <button
            type="button"
            autoFocus
            onClick={() => { game.completeChapter(); toMap(); }}
            className="rounded-lg bg-accent px-8 py-2.5 text-[17px] font-bold text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {hasNext ? '다음으로' : '계속'}
          </button>
        </div>
      );
    }
    case 'rest':
      return <RestScreen onDone={() => toMap()} />;
    case 'shop':
      return <ShopScreen onDone={() => toMap()} />;
    case 'box':
      return (
        <div className="flex h-full flex-col">
          <header className="flex h-12 shrink-0 items-center gap-4 border-b border-line bg-surface-2 px-6 font-pixel">
            <span className="font-title text-[20px] text-accent">보관함</span>
            <span className="text-[13px] text-text-dim">{game.collection.length}계열 · {game.gold.toLocaleString()}G</span>
            <button type="button" onClick={() => toMap()} className="ml-auto rounded-md bg-surface px-3 py-1 text-[13px] ring-1 ring-line hover:ring-accent">지도로 돌아간다</button>
          </header>
          <main className="min-h-0 flex-1 overflow-hidden"><BoxScreen /></main>
        </div>
      );
    case 'map':
      if (game.finished) {
        return (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center font-pixel">
            <h2 className="font-title text-[40px] text-accent">여기까지!</h2>
            <p className="text-[15px] leading-7 text-text-dim">
              지금 준비된 챕터(1~2장)를 모두 끝냈다.<br />배지 {game.badges.length}개 · 보관함 {game.collection.length}계열 · {game.gold.toLocaleString()}G
            </p>
            <button type="button" onClick={() => setPhase({ name: 'box' })} className="rounded-lg bg-surface px-5 py-2 text-[15px] ring-1 ring-line hover:ring-accent">보관함 보기</button>
          </div>
        );
      }
      return (
        <div className="relative h-full">
          <MapScreen onEnter={enter} onOpenBox={() => setPhase({ name: 'box' })} onOpenBag={() => setBagOpen(true)} notice={phase.notice} />
          {bagOpen && <BagPanel onClose={() => setBagOpen(false)} />}
        </div>
      );
  }
}
