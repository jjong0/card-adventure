// 팩 개봉 화면 (spec §8 화면 6): 왼쪽 속성 18종 + 확률, 오른쪽 5장 공개
import { motion } from 'framer-motion';
import { useState } from 'react';
import { CardBack, CardView } from '../../components/CardView';
import { TypeBadge } from '../../components/TypeBadge';
import { RARITY_ORDER, RARITY_RATES } from '../../core/gacha';
import type { ElementType, Rarity } from '../../core/types';
import { dex } from '../../lib/dex';
import { RARITY_COLOR, TYPE_LABEL } from '../../lib/labels';
import { useGameStore, type PackOpening } from '../../store/gameStore';
import { ResultBadge } from './ResultBadge';

const TYPES = Object.keys(TYPE_LABEL) as ElementType[];
const MIN_OPTIONS: { label: string; value?: Rarity }[] = [
  { label: '일반', value: undefined },
  { label: '엘리트 (R 이상)', value: 'R' },
  { label: '관장 (SR 이상)', value: 'SR' },
];

/** minRarity 이상으로 다시 정규화한 등급 확률 (spec §4.1) */
function rates(min?: Rarity) {
  const allowed = RARITY_ORDER.slice(RARITY_ORDER.indexOf(min ?? 'N'));
  const total = allowed.reduce((a, r) => a + RARITY_RATES[r], 0);
  return allowed.map((r) => ({ r, p: (RARITY_RATES[r] / total) * 100 }));
}

export function PackScreen() {
  const { openTypePack, chapterData, gold } = useGameStore();
  const [type, setType] = useState<ElementType>('fire');
  const [min, setMin] = useState<Rarity | undefined>(undefined);
  const [opening, setOpening] = useState<PackOpening | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const allOpen = revealed.length > 0 && revealed.every(Boolean);

  const open = () => {
    setOpening(openTypePack(type, min));
    setRevealed(Array(5).fill(false));
  };
  const flip = (i: number) => setRevealed((r) => r.map((v, j) => (j === i ? true : v)));
  const flipAll = () => revealed.forEach((v, i) => !v && setTimeout(() => flip(i), i * 180));
  const skip = () => setRevealed(Array(5).fill(true));
  const btn = 'rounded-lg px-4 py-2 font-pixel text-[15px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40';

  return (
    <div className="grid h-full grid-cols-[380px_1fr] gap-6 px-8 py-5">
      <aside className="flex min-h-0 flex-col gap-3.5 rounded-2xl border border-line bg-surface p-5">
        <div>
          <h2 className="font-title text-[24px] leading-tight">속성 팩</h2>
          <p className="font-pixel text-[13px] text-text-dim">
            고른 속성의 포켓몬 5장을 모두 받는다. 카드 레벨 Lv{chapterData().packLevel} · 보유 {gold.toLocaleString()}G
          </p>
        </div>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="속성">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={t === type}
              onClick={() => setType(t)}
              className={`rounded-lg border-2 py-1 focus-visible:outline-2 focus-visible:outline-accent ${t === type ? 'border-accent bg-surface-2' : 'border-transparent hover:border-line'}`}
            >
              <TypeBadge type={t} size="md" />
            </button>
          ))}
        </div>
        <div>
          <p className="mb-1.5 font-pixel text-[12px] text-text-dim">팩 종류 (테스트용 · 지도가 생기면 노드가 정함)</p>
          <div className="flex gap-1.5">
            {MIN_OPTIONS.map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => setMin(o.value)}
                className={`flex-1 rounded-md border px-2 py-1 font-pixel text-[12px] ${min === o.value ? 'border-accent text-accent' : 'border-line text-text-dim hover:text-text'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <p className="mb-1 font-pixel text-[12px] text-text-dim">등급 확률</p>
          {rates(min).map(({ r, p }) => (
            <div key={r} className="flex items-center gap-2 font-pixel text-[13px]">
              <span className="w-7 font-bold" style={{ color: RARITY_COLOR[r] }}>{r}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg">
                <div className="h-full" style={{ width: `${p}%`, backgroundColor: RARITY_COLOR[r] }} />
              </div>
              <span className="w-12 text-right tabular-nums">{p.toFixed(p < 10 ? 1 : 0)}%</span>
            </div>
          ))}
        </div>
        <button type="button" onClick={open} disabled={!!opening && !allOpen} className={`${btn} mt-auto bg-accent py-2.5 text-[18px] text-bg`}>
          {TYPE_LABEL[type]} 팩 열기
        </button>
      </aside>

      <section className="flex flex-col items-center justify-center gap-6">
        {!opening ? (
          <p className="font-pixel text-[16px] text-text-dim">왼쪽에서 속성을 고르고 팩을 여세요.</p>
        ) : (
          <>
            <div className="flex gap-4" style={{ perspective: 900 }}>
              {opening.cards.map((card, i) => {
                const rarity = dex.species[card.speciesId].rarity;
                const shiny = rarity === 'SR' || rarity === 'UR';
                return (
                  <button key={card.uid} type="button" onClick={() => flip(i)} disabled={revealed[i]} className="rounded-xl focus-visible:outline-2 focus-visible:outline-accent" aria-label={revealed[i] ? dex.species[card.speciesId].name : `${i + 1}번째 카드 뒤집기`}>
                    {revealed[i] ? (
                      <motion.div
                        initial={{ rotateY: 90 }}
                        animate={{ rotateY: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="rounded-xl"
                        style={shiny ? { boxShadow: `0 0 24px ${RARITY_COLOR[rarity]}` } : undefined}
                      >
                        <CardView card={card} badge={<ResultBadge result={opening.results[i]} />} />
                      </motion.div>
                    ) : (
                      <CardBack className="cursor-pointer transition-transform hover:-translate-y-1" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
              {!allOpen ? (
                <>
                  <button type="button" onClick={flipAll} className={`${btn} bg-surface ring-1 ring-line hover:ring-accent`}>한 번에 열기</button>
                  <button type="button" onClick={skip} className={`${btn} text-text-dim hover:text-text`}>연출 건너뛰기 ≫</button>
                </>
              ) : (
                <p className="font-pixel text-[15px] text-text-dim">
                  {opening.gold > 0 ? `중복 카드가 ${opening.gold}G로 바뀌었다. ` : ''}카드는 보관함에 들어갔다.
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
