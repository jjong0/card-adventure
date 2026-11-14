// 스타터 팩 (spec §4.1): 스타터 27종 중 서로 다른 5장에서 1장을 고른다
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { CardView } from '../../components/CardView';
import { fixJosa } from '../../core/battle';
import { dex } from '../../lib/dex';
import { useGameStore } from '../../store/gameStore';

export function StarterScreen() {
  const { starterChoices, openStarterPack, chooseStarter } = useGameStore();
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (!starterChoices) openStarterPack();
  }, [starterChoices, openStarterPack]);

  if (!starterChoices) return null;
  const name = picked ? dex.species[starterChoices.find((c) => c.uid === picked)!.speciesId].name : null;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8">
      <div className="text-center">
        <h2 className="font-title text-[40px] text-accent">스타터 팩</h2>
        <p className="font-pixel text-[15px] text-text-dim">함께 모험을 떠날 포켓몬 한 마리를 고르세요.</p>
      </div>
      <div className="flex gap-5" role="radiogroup" aria-label="스타터">
        {starterChoices.map((card, i) => (
          <motion.button
            key={card.uid}
            type="button"
            role="radio"
            aria-checked={picked === card.uid}
            onClick={() => setPicked(card.uid)}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: picked === card.uid ? -10 : 0 }}
            transition={{ delay: picked ? 0 : i * 0.08 }}
            className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <CardView card={card} selected={picked === card.uid} />
          </motion.button>
        ))}
      </div>
      <button
        type="button"
        disabled={!picked}
        onClick={() => picked && chooseStarter(picked)}
        className="rounded-lg bg-accent px-8 py-3 font-pixel text-[18px] font-bold text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
      >
        {name ? fixJosa(`${name}을(를) 데려간다`) : '포켓몬을 고르세요'}
      </button>
    </div>
  );
}
