// 상점 (spec §8 화면 9): 분류 탭, 상품 목록, 선택 상품 상세(배울 수 있는 파티 포켓몬), 구매
import { useMemo, useState } from 'react';
import { TypeBadge } from '../../components/TypeBadge';
import { HEAL_ITEMS, shopStock, type ShopItem } from '../../core/items';
import { dex, tmData } from '../../lib/dex';
import { CATEGORY_LABEL } from '../../lib/labels';
import { useGameStore } from '../../store/gameStore';

const TABS: { key: ShopItem['category']; label: string }[] = [
  { key: 'heal', label: '회복약' },
  { key: 'stone', label: '진화의돌' },
  { key: 'tm', label: '기술머신' },
];

function describe(item: ShopItem): string {
  if (item.category === 'heal') {
    const h = HEAL_ITEMS.find((i) => i.id === item.id)!.heal;
    return h === 'revive' ? '쓰러진 포켓몬을 HP 절반으로 되살린다.' : `포켓몬의 HP를 ${h} 회복한다.`;
  }
  if (item.category === 'stone') return '특정 포켓몬을 진화시키는 돌. 가방에서 포켓몬에게 쓴다.';
  return dex.moves[item.moveId!].description;
}

export function ShopScreen({ onDone }: { onDone: () => void }) {
  const { chapterData, gold, bag, tms, partyCards, buy } = useGameStore();
  const stock = useMemo(() => shopStock(chapterData(), tmData, dex, dex.evolutions), [chapterData]);
  const [tab, setTab] = useState<ShopItem['category']>('heal');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const list = stock.filter((i) => i.category === tab);
  const picked = list.find((i) => i.id === pickedId) ?? list[0];
  const owned = picked.category === 'tm' ? tms.includes(picked.moveId!) : false;
  const move = picked.moveId ? dex.moves[picked.moveId] : null;
  const party = partyCards();

  const purchase = () => {
    const r = buy(picked);
    setNotice(r === 'ok' ? `${picked.name}을(를) 샀다.` : r === 'no-gold' ? '골드가 부족하다.' : '이미 가지고 있다.');
  };

  return (
    <div className="flex h-full flex-col gap-4 px-10 py-6 font-pixel">
      <header className="flex items-center gap-4">
        <h2 className="font-title text-[32px] text-accent">프렌들리숍</h2>
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setPickedId(null); setNotice(null); }}
              aria-current={t.key === tab ? 'page' : undefined}
              className={`rounded-md px-3 py-1 text-[14px] ${t.key === tab ? 'bg-surface text-text ring-1 ring-line' : 'text-text-dim hover:text-text'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <span className="ml-auto text-[16px] text-accent">{gold.toLocaleString()}G</span>
        <button type="button" onClick={onDone} className="rounded-lg bg-surface px-4 py-1.5 text-[14px] ring-1 ring-line hover:ring-accent">나간다</button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_440px] gap-5">
        <ul className="space-y-1.5 overflow-y-auto pr-1">
          {list.map((i) => {
            const have = i.category === 'tm' ? (tms.includes(i.moveId!) ? '보유' : '') : bag[i.id] ? `${bag[i.id]}개` : '';
            return (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => { setPickedId(i.id); setNotice(null); }}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-[15px] ${i.id === picked.id ? 'border-accent bg-surface' : 'border-line bg-surface-2 hover:border-text-dim'}`}
                >
                  <span className="flex-1 font-bold">{i.name}</span>
                  <span className="text-[12px] text-text-dim">{have}</span>
                  <span className={`w-20 text-right tabular-nums ${gold < i.price ? 'text-[#F2795A]' : 'text-accent'}`}>{i.price.toLocaleString()}G</span>
                </button>
              </li>
            );
          })}
        </ul>

        <aside className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
          <h3 className="text-[20px] font-bold">{picked.name}</h3>
          {move && (
            <p className="flex items-center gap-2 text-[13px] text-text-dim">
              <TypeBadge type={move.type} /> {CATEGORY_LABEL[move.category]} · 위력 {move.power ?? '—'} · 명중 {move.accuracy ?? '—'} · PP {move.pp}
            </p>
          )}
          <p className="text-[14px] leading-6 text-text-dim">{describe(picked)}</p>
          {move && (
            <div>
              <p className="mb-1 text-[12px] text-text-dim">배울 수 있는 파티 포켓몬 (기술머신은 몇 번이든 쓸 수 있다)</p>
              <ul className="space-y-0.5 text-[13px]">
                {party.map((c) => {
                  const can = tmData.compat[c.speciesId]?.includes(move.id);
                  const known = c.learnedMoves.includes(move.id);
                  return (
                    <li key={c.uid} className={can ? '' : 'text-text-dim'}>
                      {can ? <span className="text-[#5CC98B]">✓</span> : '✕'} {dex.species[c.speciesId].name}
                      {known && ' (이미 배움)'}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <p className="mt-auto min-h-5 text-[13px] text-accent" role="status">{notice ?? ''}</p>
          <button
            type="button"
            onClick={purchase}
            disabled={owned || gold < picked.price}
            className="rounded-lg bg-accent py-2.5 text-[17px] font-bold text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
          >
            {owned ? '이미 가지고 있다' : gold < picked.price ? '골드가 부족하다' : `${picked.price.toLocaleString()}G에 산다`}
          </button>
        </aside>
      </div>
    </div>
  );
}
