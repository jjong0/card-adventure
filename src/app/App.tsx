// 임시 화면: 프로젝트 구성 확인용 (spec §11 1단계). 타이틀 화면은 7단계에서 교체한다.
import { motion } from 'framer-motion';
import species from '../data/species.json';

export default function App() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-4">
      <motion.h1
        className="font-title text-5xl text-accent"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        카드 어드벤처
      </motion.h1>
      <p className="text-text-dim">데이터 로드: 포켓몬 {species.length}종</p>
      <p className="text-xs text-text-dim">
        비공식 팬 프로젝트이며 닌텐도·게임프리크·주식회사 포켓몬과 무관합니다.
      </p>
    </main>
  );
}
