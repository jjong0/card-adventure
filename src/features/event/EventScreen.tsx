// 사건(?) 노드 (spec §3.2): 이야기와 선택지. 고르면 결과를 보여주고, 승부가 벌어지면 전투로
import { useState } from 'react';
import { fixJosa } from '../../core/battle';
import { choiceCost } from '../../core/events';
import { useGameStore, type EventResult } from '../../store/gameStore';

interface Props {
  onDone: () => void;
  onBattle: (kind: 'wild' | 'trainer') => void;
}

export function EventScreen({ onDone, onBattle }: Props) {
  const { currentEvent, chooseEvent, gold, chapter } = useGameStore();
  const [event] = useState(currentEvent);
  const [result, setResult] = useState<EventResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const btn = 'rounded-lg px-6 py-2.5 font-pixel text-[16px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

  if (!event) {
    return (
      <div className="flex h-full items-center justify-center">
        <button type="button" onClick={onDone} className={`${btn} bg-accent text-bg`}>지도로 돌아간다</button>
      </div>
    );
  }

  const choose = (i: number) => {
    const r = chooseEvent(i);
    if (typeof r === 'string') return setError(r);
    setError(null);
    setResult(r);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <div className="w-[640px] rounded-2xl border border-line bg-surface p-7 font-pixel">
        <p className="text-[13px] text-[#E8A3D9]">사건</p>
        <h2 className="mb-4 font-title text-[34px] leading-tight">{event.title}</h2>
        <p className="text-[16px] leading-8">{event.text}</p>

        {result ? (
          <div className="mt-6 space-y-3 border-t border-line pt-5">
            <p className="text-[16px] leading-8">{result.text}</p>
            {result.gains.length > 0 && (
              <ul className="space-y-1 text-[14px] text-accent">
                {result.gains.map((g) => <li key={g}>· {fixJosa(g)}</li>)}
              </ul>
            )}
            <div className="pt-2">
              {result.battle ? (
                <button type="button" autoFocus onClick={() => onBattle(result.battle!)} className={`${btn} bg-[#F2795A] text-bg`}>승부!</button>
              ) : (
                <button type="button" autoFocus onClick={onDone} className={`${btn} bg-accent text-bg`}>지도로 돌아간다</button>
              )}
            </div>
          </div>
        ) : (
          <ul className="mt-6 space-y-2">
            {event.choices.map((c, i) => {
              const cost = choiceCost(c, chapter);
              const short = cost > gold;
              return (
                <li key={c.label}>
                  <button
                    type="button"
                    disabled={short}
                    onClick={() => choose(i)}
                    className="flex w-full items-center justify-between rounded-lg border border-line bg-surface-2 px-4 py-3 text-left text-[16px] enabled:hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="font-bold">{c.label}</span>
                    {cost > 0 && <span className={`text-[14px] ${short ? 'text-[#F2795A]' : 'text-text-dim'}`}>{cost.toLocaleString()}G{short ? ' · 골드 부족' : ''}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {error && <p className="mt-3 text-[14px] text-[#F2795A]" role="status">{error}</p>}
      </div>
    </div>
  );
}
