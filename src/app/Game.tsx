// 게임 진행 흐름: 스타터 → 지도 ↔ (전투 → 정산 → 보상 팩) / 휴식 / 상점 / 보상 / 사건 / 보관함 → 관장 → 다음 챕터
// 진행 상태는 자동 저장되고(store/autosave), 불러오면 열지 않은 보상 팩·관장 클리어 화면부터 이어진다.
import { useEffect, useState } from 'react';
import { fixJosa } from '../core/battle';
import { DIFFICULTY } from '../core/difficulty';
import { bossTitle, givesBadge, nodeOpponent, rewardMinRarity, type BattleKind, type Opponent } from '../core/encounter';
import type { MapNode } from '../core/map';
import type { BattleState } from '../core/types';
import { BagPanel } from '../features/bag/BagPanel';
import { battleEnv } from '../features/battle/BattleBackdrop';
import { BattleScreen } from '../features/battle/BattleScreen';
import { BoxScreen } from '../features/box/BoxScreen';
import { EventScreen } from '../features/event/EventScreen';
import { MapScreen } from '../features/map/MapScreen';
import { PackScreen } from '../features/pack/PackScreen';
import { StarterScreen } from '../features/pack/StarterScreen';
import { RestScreen } from '../features/rest/RestScreen';
import { BattleResultScreen } from '../features/result/BattleResultScreen';
import { ShopScreen } from '../features/shop/ShopScreen';
import { TreasureScreen } from '../features/treasure/TreasureScreen';
import { dex, trainers } from '../lib/dex';
import { useBattleStore } from '../store/battleStore';
import { saveNow } from '../store/autosave';
import { useGameStore, type BattleSettlement } from '../store/gameStore';

type Phase =
  | { name: 'map'; notice?: string }
  | { name: 'battle'; opponent: Opponent }
  | { name: 'result'; opponent: Opponent; settlement: BattleSettlement }
  | { name: 'pack'; kind: BattleKind }
  | { name: 'clear' }
  | { name: 'rest' }
  | { name: 'shop' }
  | { name: 'treasure' }
  | { name: 'event'; node: MapNode }
  | { name: 'box' };

export function Game() {
  const game = useGameStore();
  const startBattle = useBattleStore((s) => s.start);
  // 불러온 세이브에 열지 않은 보상 팩이나 관장 클리어가 남아 있으면 그 화면부터
  const [phase, setPhase] = useState<Phase>(() =>
    game.pendingReward ? { name: 'pack', kind: game.pendingReward } : game.pendingClear ? { name: 'clear' } : { name: 'map' },
  );
  const [bagOpen, setBagOpen] = useState(false);
  const toMap = (notice?: string) => setPhase({ name: 'map', notice });
  const tick = game.tick;

  // 플레이 시간: 탭이 보일 때만 센다
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && tick(1), 1000);
    return () => clearInterval(t);
  }, [tick]);

  const exitToTitle = () => {
    saveNow();
    game.leaveToTitle();
  };

  if (game.gameOver) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center font-pixel">
        <h2 className="font-title text-[44px] text-text-dim">모험이 끝났다</h2>
        <p className="text-[15px] leading-7 text-text-dim">
          너즐록: 모든 포켓몬을 잃었다. 이 세이브는 지워졌다.
          <br />
          {game.chapter}장 · 배지 {game.badges.length}개 · 플레이 {Math.floor(game.playTimeSec / 60)}분
        </p>
        <button
          type="button"
          autoFocus
          onClick={game.leaveToTitle}
          className="rounded-lg bg-accent px-8 py-2.5 text-[17px] font-bold text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          타이틀로
        </button>
      </div>
    );
  }

  if (!game.collection.length) return <StarterScreen />;

  const fightOpponent = (opponent: Opponent) => {
    // 익스트림은 관장전에서 가방을 쓸 수 없다 (spec §5.3)
    const itemsAllowed = opponent.kind !== 'leader' || DIFFICULTY[game.difficulty].leaderItems;
    startBattle(game.partyCards(), opponent.cards, game.nextSeed(), {
      playerHp: game.hp, playerPp: game.pp, wild: opponent.kind === 'wild', randomAi: opponent.randomAi, itemsAllowed,
    });
    setPhase({ name: 'battle', opponent });
  };

  const enter = (node: MapNode, opponent: Opponent | null) => {
    if (opponent) return fightOpponent(opponent);
    if (node.kind === 'shop') setPhase({ name: 'shop' });
    else if (node.kind === 'treasure') setPhase({ name: 'treasure' });
    else if (node.kind === 'event') setPhase({ name: 'event', node });
    else setPhase({ name: 'rest' });
  };

  /** 사건에서 벌어진 승부: 그 노드 자리에 야생·트레이너 노드가 있는 것처럼 상대를 만든다 */
  const eventBattle = (node: MapNode, kind: 'wild' | 'trainer') => {
    const map = game.map();
    const ctx = { totalFloors: map.floors.length, chapter: game.chapterData(), trainers, starterType: game.starterType, difficulty: game.difficulty, seed: game.runSeed };
    const opponent = nodeOpponent({ ...node, kind }, ctx, dex);
    if (opponent) fightOpponent(opponent);
    else { game.finishNode(); toMap(); }
  };

  /** 너즐록으로 잃은 포켓몬 안내 */
  const lostNotice = () => {
    const lost = useGameStore.getState().lastLost;
    return lost.length ? ` ${lost.join(', ')}을(를) 영영 잃었다.` : '';
  };

  const endBattle = (opponent: Opponent) => (state: BattleState) => {
    const settlement = game.settleBattle(state, opponent);
    if (settlement) return setPhase({ name: 'result', opponent, settlement });
    const before = useGameStore.getState().gold;
    game.restartChapter();
    const lostGold = before - useGameStore.getState().gold;
    toMap(fixJosa(
      `눈앞이 깜깜해졌다… 챕터 처음부터 다시 도전한다.${lostGold ? ` ${lostGold.toLocaleString()}G를 잃었다.` : ''}${lostNotice()}`,
    ));
  };

  const runAway = (opponent: Opponent) => () => {
    const state = useBattleStore.getState().state;
    if (state) game.settleBattle(state, opponent);
    game.finishNode();
    toMap(fixJosa(`무사히 도망쳤다. 보상은 없다.${lostNotice()}`));
  };

  switch (phase.name) {
    case 'battle':
      return (
        <BattleScreen
          onRun={phase.opponent.kind === 'wild' ? runAway(phase.opponent) : undefined}
          onEnd={endBattle(phase.opponent)}
          endLabel={{ win: '결과 보기', lose: '챕터 처음부터 다시' }}
          bag={game.bag}
          env={battleEnv(game.chapter, phase.opponent.kind === 'leader')}
        />
      );
    case 'result':
      return (
        <div className="relative h-full">
          <BattleResultScreen opponent={phase.opponent} settlement={phase.settlement} onNext={() => setPhase({ name: 'pack', kind: phase.opponent.kind })} />
          {useGameStore.getState().lastLost.length > 0 && (
            <p className="absolute inset-x-0 top-6 text-center font-pixel text-[14px] text-[#F2795A]" role="status">{fixJosa(lostNotice().trim())}</p>
          )}
        </div>
      );
    case 'pack':
      return (
        <PackScreen
          reward={{
            minRarity: rewardMinRarity(phase.kind),
            onDone: () => {
              game.claimReward();
              if (phase.kind === 'leader') setPhase({ name: 'clear' });
              else toMap();
            },
          }}
        />
      );
    case 'clear': {
      const ch = game.chapterData();
      const hasNext = !game.finished;
      return (
        <div className="flex h-full flex-col items-center justify-center gap-5 text-center font-pixel">
          <h2 className="font-title text-[44px] text-accent">{ch.chapter}장 클리어!</h2>
          <p className="text-[16px]">
            {fixJosa(`${bossTitle(ch.chapter) ? `${bossTitle(ch.chapter)} ` : ''}${ch.leader.name}을(를) 이겼다!${givesBadge(ch.chapter) ? ' 배지를 손에 넣었다.' : ''}`)}
          </p>
          {ch.rewardTm && (
            <p className="text-[15px] text-text-dim">
              {ch.rewardTm.name} <span className="text-text">{dex.moves[ch.rewardTm.moveId].name}</span>도 받았다. 가방에서 포켓몬에게 가르칠 수 있다.
            </p>
          )}
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
      return <ShopScreen onDone={() => { game.finishNode(); toMap(); }} />;
    case 'treasure':
      return <TreasureScreen onDone={() => toMap()} />;
    case 'event':
      return <EventScreen onDone={() => toMap()} onBattle={(kind) => eventBattle(phase.node, kind)} />;
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
            <h2 className="font-title text-[40px] text-accent">모험 완료!</h2>
            <p className="text-[15px] leading-7 text-text-dim">
              은빛산의 레드까지 모든 챕터를 끝냈다.<br />{DIFFICULTY[game.difficulty].label} · 배지 {game.badges.length}개 · 보관함 {game.collection.length}계열 · {game.gold.toLocaleString()}G
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPhase({ name: 'box' })} className="rounded-lg bg-surface px-5 py-2 text-[15px] ring-1 ring-line hover:ring-accent">보관함 보기</button>
              <button type="button" onClick={exitToTitle} className="rounded-lg bg-surface px-5 py-2 text-[15px] ring-1 ring-line hover:ring-accent">타이틀로</button>
            </div>
          </div>
        );
      }
      return (
        <div className="relative h-full">
          <MapScreen onEnter={enter} onOpenBox={() => setPhase({ name: 'box' })} onOpenBag={() => setBagOpen(true)} onExit={exitToTitle} notice={phase.notice} />
          {bagOpen && <BagPanel onClose={() => setBagOpen(false)} />}
        </div>
      );
  }
}
