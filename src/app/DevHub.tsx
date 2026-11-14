// 개발용 임시 메뉴: 화면을 오가며 확인한다. 타이틀·지도가 생기면(로드맵 6~7단계) 실제 진행 흐름으로 바꾼다.
import { useState } from 'react';
import { BattleTestScreen } from '../features/battle-test/BattleTestScreen';
import { PackScreen } from '../features/pack/PackScreen';
import { StarterScreen } from '../features/pack/StarterScreen';
import { useGameStore } from '../store/gameStore';

type Tab = 'pack' | 'battle';
const TABS: { key: Tab; label: string }[] = [
  { key: 'pack', label: '팩 개봉' },
  { key: 'battle', label: '전투 테스트' },
];

export function DevHub() {
  const [tab, setTab] = useState<Tab>('pack');
  const { collection, gold, chapterData } = useGameStore();

  if (!collection.length) return <StarterScreen />;
  if (tab === 'battle') {
    return (
      <div className="relative h-full w-full">
        <BattleTestScreen />
        <button
          type="button"
          onClick={() => setTab('pack')}
          className="absolute bottom-[212px] left-3 rounded-md bg-surface/90 px-2.5 py-1 font-pixel text-[12px] text-text-dim ring-1 ring-line hover:text-text"
        >
          ← 메뉴
        </button>
      </div>
    );
  }
  const ch = chapterData();
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-6 border-b border-line bg-surface-2 px-6">
        <span className="font-title text-[20px] text-accent">카드 어드벤처</span>
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={t.key === tab ? 'page' : undefined}
              className={`rounded-md px-3 py-1 font-pixel text-[14px] ${t.key === tab ? 'bg-surface text-text ring-1 ring-line' : 'text-text-dim hover:text-text'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <span className="ml-auto font-pixel text-[13px] text-text-dim">
          {ch.chapter}장 {ch.place} · 관장 {ch.leader.name} · 보관함 {collection.length}계열 · {gold.toLocaleString()}G
        </span>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden">{tab === 'pack' && <PackScreen />}</main>
    </div>
  );
}
