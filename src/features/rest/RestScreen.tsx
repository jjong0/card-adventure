// 휴식·강화 (spec §8 화면 10): 파티 회복 또는 카드 1장 레벨 +3 중 하나. 회복 전후 HP 미리보기
import { useState } from 'react';
import { HpBar } from '../../components/HpBar';
import { Sprite } from '../../components/Sprite';
import type { LevelUpResult } from '../../core/progress';
import { dex } from '../../lib/dex';
import { currentHp, REST_LEVELS, useGameStore } from '../../store/gameStore';
import { EvolutionPrompt } from '../result/EvolutionPrompt';

export function RestScreen({ onDone }: { onDone: () => void }) {
  const { partyCards, hp, restHeal, restTrain } = useGameStore();
  const party = partyCards();
  const [mode, setMode] = useState<'choose' | 'train'>('choose');
  const [done, setDone] = useState<'heal' | LevelUpResult | null>(null);
  const hurt = party.some((c) => currentHp(c, hp) < currentHp(c, {}));
  const btn = 'rounded-lg px-5 py-2.5 font-pixel text-[16px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40';

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h2 className="font-title text-[38px] text-[#4FD1C5]">포켓몬센터</h2>
        <p className="font-pixel text-[15px] text-text-dim">회복과 강화 중 하나만 할 수 있다.</p>
      </div>

      {done ? (
        <div className="w-[560px] space-y-3 rounded-xl border border-line bg-surface p-5 text-center font-pixel">
          {done === 'heal' ? (
            <p className="text-[16px]">파티가 모두 회복되었다!</p>
          ) : (
            <>
              <p className="text-[16px]">
                {dex.species[done.card.speciesId].name} <span className="font-bold text-[#5CC98B]">Lv{done.fromLevel} → Lv{done.toLevel}</span>
              </p>
              {done.newMoves.length > 0 && <p className="text-[13px]">새 기술 <span className="text-accent">{done.newMoves.map((id) => dex.moves[id]?.name ?? id).join(', ')}</span></p>}
              <div className="text-left"><EvolutionPrompt uid={done.card.uid} /></div>
            </>
          )}
          <button type="button" onClick={onDone} autoFocus className={`${btn} bg-accent text-bg`}>지도로 돌아간다</button>
        </div>
      ) : (
        <>
          <ul className="grid w-[760px] grid-cols-2 gap-2">
            {party.map((c) => {
              const sp = dex.species[c.speciesId];
              const max = currentHp(c, {});
              const now = currentHp(c, hp);
              return (
                <li key={c.uid}>
                  <button
                    type="button"
                    disabled={mode !== 'train'}
                    onClick={() => setDone(restTrain(c.uid))}
                    className={`flex w-full items-center gap-3 rounded-xl border bg-surface px-3 py-2 text-left font-pixel disabled:cursor-default ${mode === 'train' ? 'border-accent hover:bg-surface-2' : 'border-line'}`}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden">
                      <Sprite speciesId={c.speciesId} name={sp.name} still scale={1.1} className="max-w-none shrink-0" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between text-[13px]">
                        <span className="font-bold">{sp.name} <span className="font-normal text-text-dim">Lv{c.level}{mode === 'train' ? ` → Lv${Math.min(100, c.level + REST_LEVELS)}` : ''}</span></span>
                        <span className="tabular-nums text-text-dim">
                          {now}{mode === 'choose' && now < max ? <span className="text-[#5CC98B]"> → {max}</span> : ''} / {max}
                        </span>
                      </div>
                      <HpBar hp={now} max={max} className="mt-1 h-2" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {mode === 'choose' ? (
            <div className="flex gap-3">
              <button type="button" onClick={() => { restHeal(); setDone('heal'); }} className={`${btn} bg-[#4FD1C5] text-bg`}>
                회복한다{hurt ? '' : ' (모두 가득 참)'}
              </button>
              <button type="button" onClick={() => setMode('train')} className={`${btn} bg-surface ring-1 ring-line hover:ring-accent`}>
                강화한다 (1장 레벨 +{REST_LEVELS})
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 font-pixel text-[14px] text-text-dim">
              강화할 포켓몬을 고르세요.
              <button type="button" onClick={() => setMode('choose')} className="rounded-md px-2 py-1 ring-1 ring-line hover:text-text">뒤로</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
