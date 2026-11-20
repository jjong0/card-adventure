// 타이틀 → (새 게임 | 이어하기) → 게임. 주소에 ?test=battle을 붙이면 전투 연출 확인용 테스트 전투 (?moves=와 함께).
import { useEffect, useState } from 'react';
import { Stage } from '../components/Stage';
import { BattleTestScreen } from '../features/battle-test/BattleTestScreen';
import { NewGameScreen } from '../features/new-game/NewGameScreen';
import { TitleScreen } from '../features/title/TitleScreen';
import { startAutosave } from '../store/autosave';
import { useGameStore } from '../store/gameStore';
import { requestPersist } from '../store/saveRepository';
import { Game } from './Game';

const testBattle = new URLSearchParams(window.location.search).get('test') === 'battle';

export default function App() {
  const slot = useGameStore((s) => s.slot);
  const { newGame, loadSave } = useGameStore();
  const [newGameSlot, setNewGameSlot] = useState<number | null>(null);

  useEffect(() => {
    requestPersist();
    return startAutosave();
  }, []);

  if (testBattle) return <Stage><BattleTestScreen /></Stage>;

  let screen;
  if (slot !== null) screen = <Game key={slot} />;
  else if (newGameSlot !== null) {
    screen = (
      <NewGameScreen
        slot={newGameSlot}
        onBack={() => setNewGameSlot(null)}
        onStart={(difficulty, challenges) => {
          newGame({ slot: newGameSlot, difficulty, challenges, seed: Date.now() >>> 0 }); // 시드만 시각에서, 난수는 createRng로
          setNewGameSlot(null);
        }}
      />
    );
  } else {
    screen = <TitleScreen onNewGame={setNewGameSlot} onContinue={(s, save) => loadSave(save, s)} />;
  }
  return <Stage>{screen}</Stage>;
}
