// 지금은 개발용 임시 메뉴(DevHub)만 있다. 타이틀 화면은 로드맵 7단계에서 만든다.
import { Stage } from '../components/Stage';
import { DevHub } from './DevHub';

export default function App() {
  return (
    <Stage>
      <DevHub />
    </Stage>
  );
}
