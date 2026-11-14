// 보관함 (spec §8 화면 7): 파티 6칸, 검색, 속성 필터, 정렬. 카드를 누르면 상세
import { useMemo, useState } from 'react';
import { CardView } from '../../components/CardView';
import { Sprite } from '../../components/Sprite';
import { MAX_PARTY, sortCards, type SortKey } from '../../core/collection';
import type { ElementType } from '../../core/types';
import { dex } from '../../lib/dex';
import { TYPE_LABEL } from '../../lib/labels';
import { useGameStore } from '../../store/gameStore';
import { CardDetail } from '../card-detail/CardDetail';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'matchup', label: '다음 관장 상성순' },
  { key: 'rarity', label: '등급순' },
  { key: 'level', label: '레벨순' },
  { key: 'acquired', label: '획득순' },
];
const TYPES = Object.keys(TYPE_LABEL) as ElementType[];

export function BoxScreen() {
  const { collection, party, chapterData } = useGameStore();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<ElementType | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('acquired');
  const [openUid, setOpenUid] = useState<string | null>(null);
  const leader = chapterData();

  const shown = useMemo(() => {
    const q = query.trim();
    const filtered = collection.filter((c) => {
      const sp = dex.species[c.speciesId];
      return (!q || sp.name.includes(q)) && (type === 'all' || sp.types.includes(type));
    });
    return sortCards(filtered, sort, dex, leader.type);
  }, [collection, query, type, sort, leader.type]);

  const byUid = new Map(collection.map((c) => [c.uid, c]));
  const field = 'rounded-lg border border-line bg-surface-2 px-3 py-1.5 font-pixel text-[13px] focus-visible:outline-2 focus-visible:outline-accent';

  return (
    <div className="relative flex h-full flex-col gap-3 px-8 py-4">
      <section aria-label="파티" className="flex items-center gap-3">
        <span className="w-14 font-pixel text-[13px] text-text-dim">파티</span>
        {Array.from({ length: MAX_PARTY }, (_, i) => {
          const card = byUid.get(party[i] ?? '');
          if (!card) {
            return <div key={i} className="h-14 w-[170px] rounded-lg border border-dashed border-line" aria-label="빈 칸" />;
          }
          const sp = dex.species[card.speciesId];
          return (
            <button
              key={card.uid}
              type="button"
              onClick={() => setOpenUid(card.uid)}
              className="flex h-14 w-[170px] items-center gap-2 rounded-lg border border-line bg-surface px-2 text-left hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden">
                <Sprite speciesId={card.speciesId} name={sp.name} still scale={1.1} className="max-w-none shrink-0" />
              </div>
              <div className="min-w-0 font-pixel">
                <p className="truncate text-[14px] font-bold">{sp.name}</p>
                <p className="text-[12px] text-text-dim">Lv{card.level} · ★{card.star}</p>
              </div>
            </button>
          );
        })}
      </section>

      <div className="flex items-center gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름 검색" aria-label="이름 검색" className={`${field} w-48`} />
        <select value={type} onChange={(e) => setType(e.target.value as ElementType | 'all')} aria-label="속성 필터" className={field}>
          <option value="all">모든 속성</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t]}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="정렬" className={field}>
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        {sort === 'matchup' && (
          <span className="font-pixel text-[12px] text-text-dim">
            {leader.leader.name}({TYPE_LABEL[leader.type]})에게 유리한 순
          </span>
        )}
        <span className="ml-auto font-pixel text-[13px] text-text-dim">{shown.length} / {collection.length}계열</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {shown.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,150px)] justify-between gap-y-3">
            {shown.map((c) => (
              <button key={c.uid} type="button" onClick={() => setOpenUid(c.uid)} className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <CardView
                  card={c}
                  badge={party.includes(c.uid) ? <span className="rounded-md bg-[#5CC98B] px-1.5 py-0.5 font-pixel text-[11px] font-bold text-bg">파티</span> : undefined}
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="pt-16 text-center font-pixel text-[15px] text-text-dim">조건에 맞는 카드가 없다. 검색어나 속성 필터를 바꿔 보세요.</p>
        )}
      </div>

      {openUid && byUid.has(openUid) && <CardDetail uid={openUid} onClose={() => setOpenUid(null)} />}
    </div>
  );
}
