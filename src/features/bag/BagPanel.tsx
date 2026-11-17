// 가방: 회복약·진화의돌·기술머신을 골라 파티 포켓몬에게 쓴다 (지도 화면 위에 뜨는 창)
import { useState } from 'react';
import { HpBar } from '../../components/HpBar';
import { Sprite } from '../../components/Sprite';
import { fixJosa } from '../../core/battle';
import { HEAL_ITEMS } from '../../core/items';
import { dex, tmData } from '../../lib/dex';
import { currentHp, useGameStore } from '../../store/gameStore';

type Pick = { kind: 'item'; id: string; name: string } | { kind: 'tm'; moveId: string; name: string };

function itemName(id: string): string {
  const heal = HEAL_ITEMS.find((i) => i.id === id);
  if (heal) return heal.name;
  for (const list of Object.values(dex.evolutions)) for (const e of list) if (e.method === 'item' && e.item === id) return e.itemName;
  return id;
}

export function BagPanel({ onClose }: { onClose: () => void }) {
  const { bag, tms, partyCards, hp, applyItem, teach } = useGameStore();
  const [pick, setPick] = useState<Pick | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const items = Object.entries(bag).filter(([, n]) => n > 0);
  const party = partyCards();

  const apply = (uid: string, name: string) => {
    if (!pick) return;
    const error = pick.kind === 'item' ? applyItem(pick.id, uid) : teach(uid, pick.moveId);
    setNotice(error ?? fixJosa(pick.kind === 'item' ? `${name}에게 ${pick.name}을(를) 썼다.` : `${name}은(는) ${pick.name}을(를) 배웠다!`));
    if (pick.kind === 'item' && (useGameStore.getState().bag[pick.id] ?? 0) <= 0) setPick(null);
  };

  /** 이 포켓몬에게 쓸 수 있는지 미리 표시 (돌: 진화 가능, 기술머신: 배울 수 있음) */
  const hint = (speciesId: string, learned: string[]) => {
    if (!pick) return '';
    if (pick.kind === 'tm') return learned.includes(pick.moveId) ? '이미 배움' : tmData.compat[speciesId]?.includes(pick.moveId) ? '배울 수 있다' : '배울 수 없다';
    if (HEAL_ITEMS.some((i) => i.id === pick.id)) return '';
    return (dex.evolutions[speciesId] ?? []).some((e) => e.method === 'item' && e.item === pick.id) ? '진화할 수 있다' : '효과 없음';
  };

  const row = 'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[14px]';
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/80 p-10" role="dialog" aria-modal aria-label="가방">
      <div className="grid h-full w-full max-w-[980px] grid-cols-2 gap-5 rounded-2xl border border-line bg-surface p-5 font-pixel shadow-2xl">
        <div className="flex min-h-0 flex-col gap-2">
          <h2 className="font-title text-[26px]">가방</h2>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {items.map(([id, n]) => (
              <button key={id} type="button" onClick={() => { setPick({ kind: 'item', id, name: itemName(id) }); setNotice(null); }} className={`${row} ${pick?.kind === 'item' && pick.id === id ? 'border-accent bg-surface-2' : 'border-line hover:border-text-dim'}`}>
                <span className="font-bold">{itemName(id)}</span>
                <span className="text-text-dim">× {n}</span>
              </button>
            ))}
            {tms.map((moveId) => {
              const m = tmData.machines.find((x) => x.moveId === moveId);
              const name = dex.moves[moveId].name;
              return (
                <button key={moveId} type="button" onClick={() => { setPick({ kind: 'tm', moveId, name }); setNotice(null); }} className={`${row} ${pick?.kind === 'tm' && pick.moveId === moveId ? 'border-accent bg-surface-2' : 'border-line hover:border-text-dim'}`}>
                  <span className="font-bold">{m?.name ?? '기술머신'} {name}</span>
                  <span className="text-text-dim">기술머신</span>
                </button>
              );
            })}
            {!items.length && !tms.length && <p className="pt-10 text-center text-[14px] text-text-dim">가방이 비어 있다. 상점에서 도구를 살 수 있다.</p>}
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[14px] text-text-dim">{pick ? fixJosa(`${pick.name}을(를) 쓸 포켓몬을 고르세요`) : '왼쪽에서 도구를 고르세요'}</p>
            <button type="button" onClick={onClose} className="rounded-md px-2 text-[14px] text-text-dim hover:text-text">닫기 ✕</button>
          </div>
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {party.map((c) => {
              const sp = dex.species[c.speciesId];
              const max = currentHp(c, {});
              const now = currentHp(c, hp);
              return (
                <li key={c.uid}>
                  <button type="button" disabled={!pick} onClick={() => apply(c.uid, sp.name)} className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-left enabled:hover:border-accent disabled:cursor-default">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden">
                      <Sprite speciesId={c.speciesId} name={sp.name} still scale={1} className="max-w-none shrink-0" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between text-[13px]">
                        <span className="font-bold">{sp.name} <span className="font-normal text-text-dim">Lv{c.level}</span></span>
                        <span className="text-[12px] text-text-dim">{hint(c.speciesId, c.learnedMoves) || `${now}/${max}`}</span>
                      </div>
                      <HpBar hp={now} max={max} className="mt-1 h-1.5" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="min-h-5 text-[13px] text-accent" role="status">{notice ?? ''}</p>
        </div>
      </div>
    </div>
  );
}
