// 게임 본편(Game). 주소에 ?test=battle을 붙이면 전투 연출 확인용 테스트 전투를 연다 (?moves=와 함께 쓴다).
import { Stage } from '../components/Stage';
import { BattleTestScreen } from '../features/battle-test/BattleTestScreen';
import { Game } from './Game';

const testBattle = new URLSearchParams(window.location.search).get('test') === 'battle';

export default function App() {
  return <Stage>{testBattle ? <BattleTestScreen /> : <Game />}</Stage>;
}
