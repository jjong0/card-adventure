// 보상 노드 (spec §3.2): 지닌 도구 3개 중 1개를 골라 가방에 넣는다
import { useState } from 'react';
import { fixJosa } from '../../core/battle';
import type { HeldItemTier } from '../../core/types';
import { dex } from '../../lib/dex';
import { useGameStore } from '../../store/gameStore';

const TIER: Record<HeldItemTier, { label: string; color: string }> = {
  common: { label: '일반', color: '#9AA8BC' },
  uncommon: { label: '고급', color: '#4FA3F7' },
  rare: { label: '희귀', color: '#F2C14E' },
};

export function TreasureScreen({ onDone }: { onDone: () => void }) {
  const { treasureChoices, claimTreasure } = useGameStore();
  // 고르고 나면 가진 도구가 바뀌어 후보가 달라지므로 처음 목록을 붙잡아 둔다
  const [choices] = useState(treasureChoices);
  const [taken, setTaken] = useState<string | null>(null);
  const btn = 'rounded-lg px-6 py-2.5 font-pixel text-[16px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

  const take = (slug: string) => {
    if (claimTreasure(slug)) setTaken(slug);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h2 className="font-title text-[38px] text-[#E6D27A]">보상</h2>
        <p className="font-pixel text-[15px] text-text-dim">{taken ? fixJosa(`${dex.items[taken].name}을(를) 가방에 넣었다. 가방에서 포켓몬에게 지니게 할 수 있다.`) : '하나만 가져갈 수 있다.'}</p>
      </div>
      <ul className="grid w-[840px] grid-cols-3 gap-4">
        {choices.map((slug) => {
          const item = dex.items[slug];
          const tier = TIER[item.tier];
          const dim = taken !== null && taken !== slug;
          return (
            <li key={slug}>
              <button
                type="button"
                disabled={taken !== null}
                onClick={() => take(slug)}
                className={`flex h-[220px] w-full flex-col gap-3 rounded-xl border-2 bg-surface p-5 text-left font-pixel transition enabled:hover:-translate-y-1 enabled:hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${dim ? 'opacity-30' : ''}`}
                style={{ borderColor: taken === slug ? '#F2C14E' : tier.color }}
              >
                <span className="self-start rounded px-2 py-0.5 text-[12px] font-bold text-bg" style={{ backgroundColor: tier.color }}>{tier.label}</span>
                <span className="text-[20px] font-bold">{item.name}</span>
                <span className="text-[13px] leading-relaxed text-text-dim">{item.description}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={onDone} disabled={!taken} className={`${btn} bg-accent text-bg disabled:opacity-40`}>
        지도로 돌아간다
      </button>
    </div>
  );
}
