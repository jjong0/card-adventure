// 지금은 전투 테스트 화면만 있다 (로드맵 4단계). 타이틀 화면은 7단계에서 만든다.
import { Stage } from '../components/Stage';
import { BattleTestScreen } from '../features/battle-test/BattleTestScreen';

export default function App() {
  return (
    <Stage>
      <BattleTestScreen />
    </Stage>
  );
}
