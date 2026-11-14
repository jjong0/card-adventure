// 카드 상세 (spec §8 화면 8): 카드 정보 + 6스탯(개체값 포인트 배분) + 기술 장착
import { useState } from 'react';
import { CardView } from '../../components/CardView';
import { allocateIv, dupNeeded, effectiveIvs, equipMoves, IV_MAX, MAX_EQUIPPED_MOVES, MAX_PERFECT_STATS, STAT_KEYS, type AllocateError } from '../../core/card';
import { calcStats } from '../../core/battle';
import { MAX_PARTY, sellValue } from '../../core/collection';
import type { Card, Evolution, Stats } from '../../core/types';
import { dex } from '../../lib/dex';
import { CATEGORY_LABEL, TYPE_COLOR, TYPE_LABEL } from '../../lib/labels';
import { useGameStore } from '../../store/gameStore';

const STAT_LABEL: Record<keyof Stats, string> = { hp: 'HP', atk: '공격', def: '방어', spAtk: '특수공격', spDef: '특수방어', spd: '스피드' };
const ALLOC_ERROR: Record<AllocateError, string> = {
  'no-points': '남은 포인트가 없다.',
  'stat-maxed': '이미 31이다.',
  'perfect-limit': `31에 도달한 스탯은 ${MAX_PERFECT_STATS}개까지다.`,
  'nothing-to-remove': '이 스탯에 찍은 포인트가 없다.',
};
const SUBSTITUTE_REASON = { trade: '교환 진화', friendship: '친밀도 진화', other: '특수 조건', override: '조정값' } as const;

function evolutionText(e: Evolution) {
  const name = dex.species[e.to].name;
  if (e.method === 'item') return `${e.itemName}로 ${name}`;
  if (e.method === 'level') return `Lv${e.level}에 ${name}`;
  return `Lv${e.level}에 ${name} (${SUBSTITUTE_REASON[e.reason]} 대신)`;
}

export function CardDetail({ uid, onClose }: { uid: string; onClose: () => void }) {
  const { collection, party, updateCard, setParty, sell } = useGameStore();
  const card = collection.find((c) => c.uid === uid)!;
  const [error, setError] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [confirmSell, setConfirmSell] = useState(false);
  const sp = dex.species[card.speciesId];
  const inParty = party.includes(uid);

  const apply = (next: Card | string) => {
    if (typeof next === 'string') return setError(next);
    setError(null);
    updateCard(next);
  };

  const alloc = (k: keyof Stats, delta: 1 | -1) => {
    const r = allocateIv(card, k, delta);
    apply(typeof r === 'string' ? ALLOC_ERROR[r] : r);
  };

  const ivs = effectiveIvs(card);
  const stats = calcStats(sp.baseStats, ivs, card.level);
  const perfect = STAT_KEYS.filter((k) => ivs[k] >= IV_MAX).length;
  const need = dupNeeded(card);
  const evolutions = dex.evolutions[card.speciesId] ?? [];

  const equip = (moveId: string) => {
    const moves = [...card.moves];
    if (moves.includes(moveId)) return;
    if (slot !== null) moves[slot] = moveId;
    else if (moves.length < MAX_EQUIPPED_MOVES) moves.push(moveId);
    else return setError('장착 칸이 꽉 찼다. 바꿀 칸을 먼저 고르세요.');
    setSlot(null);
    const r = equipMoves(card, moves);
    apply(r === 'invalid' ? '장착할 수 없다.' : r);
  };
  const unequip = (i: number) => {
    if (card.moves.length <= 1) return setError('기술은 1개 이상 장착해야 한다.');
    setSlot(null);
    apply(equipMoves(card, card.moves.filter((_, j) => j !== i)) as Card);
  };

  const btn = 'rounded-lg px-3 py-2 font-pixel text-[14px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/80 p-6" role="dialog" aria-modal aria-label={`${sp.name} 카드 상세`}>
      <div className="grid h-full w-full grid-cols-[220px_1fr_330px] gap-5 rounded-2xl border border-line bg-surface p-5 shadow-2xl">
        {/* 왼쪽: 카드 정보와 행동 */}
        <div className="flex flex-col gap-3 font-pixel text-[13px]">
          <CardView card={card} className="mx-auto" />
          <dl className="space-y-1.5">
            <div>
              <dt className="text-text-dim">다음 ★까지</dt>
              <dd>{need === null ? '★5 달성 · 중복은 골드로 바뀐다' : `같은 계열 카드 ${need}장 더`}</dd>
            </div>
            <div>
              <dt className="text-text-dim">다음 진화</dt>
              <dd>{evolutions.length ? evolutions.map((e) => <p key={e.to}>{evolutionText(e)}</p>) : '없음'}</dd>
            </div>
            <div>
              <dt className="text-text-dim">지닌 도구</dt>
              <dd>{card.heldItem ?? '없음'}</dd>
            </div>
          </dl>
          <div className="mt-auto flex flex-col gap-2">
            {inParty ? (
              <button type="button" disabled={party.length <= 1} title={party.length <= 1 ? '파티에는 1마리 이상 있어야 한다' : undefined} onClick={() => setParty(party.filter((u) => u !== uid))} className={`${btn} bg-surface-2 ring-1 ring-line`}>
                파티에서 빼기
              </button>
            ) : (
              <button type="button" disabled={party.length >= MAX_PARTY} title={party.length >= MAX_PARTY ? '파티가 가득 찼다' : undefined} onClick={() => setParty([...party, uid])} className={`${btn} bg-[#5CC98B] text-bg`}>
                파티에 넣기
              </button>
            )}
            {confirmSell ? (
              <div className="flex gap-1.5">
                <button type="button" onClick={() => { sell(uid); onClose(); }} className={`${btn} flex-1 bg-[#F2795A] text-bg`}>{sellValue(card, dex)}G에 바꾸기</button>
                <button type="button" onClick={() => setConfirmSell(false)} className={`${btn} text-text-dim`}>취소</button>
              </div>
            ) : (
              <button type="button" disabled={inParty} title={inParty ? '파티에서 먼저 빼야 한다' : undefined} onClick={() => setConfirmSell(true)} className={`${btn} text-text-dim ring-1 ring-line hover:text-text`}>
                골드로 바꾸기
              </button>
            )}
          </div>
        </div>

        {/* 가운데: 6스탯과 개체값 포인트 */}
        <div className="flex min-h-0 flex-col">
          <div className="mb-3 flex items-baseline gap-4">
            <h2 className="font-title text-[30px] leading-none">{sp.name}</h2>
            <span className="font-pixel text-[14px] text-accent">남은 포인트 {card.ivPoints}</span>
            <span className="font-pixel text-[13px] text-text-dim">31 도달 {perfect} / {MAX_PERFECT_STATS}</span>
            <button type="button" onClick={onClose} className="ml-auto rounded-md px-2 font-pixel text-[14px] text-text-dim hover:text-text focus-visible:outline-2 focus-visible:outline-accent" aria-label="닫기">
              닫기 ✕
            </button>
          </div>
          <table className="w-full font-pixel text-[14px]">
            <thead className="text-[12px] text-text-dim">
              <tr>
                <th className="pb-2 text-left font-normal">스탯</th>
                <th className="pb-2 text-right font-normal">종족값</th>
                <th className="pb-2 pl-5 text-left font-normal">개체값 (기본 + 포인트)</th>
                <th className="pb-2 text-right font-normal">실수치</th>
              </tr>
            </thead>
            <tbody>
              {STAT_KEYS.map((k) => {
                const base = Math.min(IV_MAX, card.ivBase[k]);
                const added = ivs[k] - base;
                return (
                  <tr key={k} className="border-t border-line/60">
                    <td className="py-2">{STAT_LABEL[k]}</td>
                    <td className="py-2 text-right tabular-nums text-text-dim">{sp.baseStats[k]}</td>
                    <td className="py-2 pl-5">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => alloc(k, -1)} aria-label={`${STAT_LABEL[k]} 포인트 회수`} className="h-6 w-6 rounded bg-surface-2 ring-1 ring-line hover:ring-accent">−</button>
                        <div className="relative h-2.5 w-44 overflow-hidden rounded-full bg-bg" aria-label={`개체값 ${ivs[k]}`}>
                          <div className="absolute inset-y-0 left-0 bg-[#9AA8BC]" style={{ width: `${(base / IV_MAX) * 100}%` }} />
                          <div className="absolute inset-y-0 bg-accent" style={{ left: `${(base / IV_MAX) * 100}%`, width: `${(added / IV_MAX) * 100}%` }} />
                        </div>
                        <button type="button" onClick={() => alloc(k, 1)} aria-label={`${STAT_LABEL[k]} 포인트 찍기`} className="h-6 w-6 rounded bg-surface-2 ring-1 ring-line hover:ring-accent">+</button>
                        <span className={`w-16 tabular-nums ${ivs[k] >= IV_MAX ? 'text-accent' : ''}`}>
                          {ivs[k]}{added > 0 && <span className="text-[12px] text-accent"> +{added}</span>}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums">{stats[k]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 min-h-5 font-pixel text-[13px] text-[#F2795A]" role="status">{error ?? ''}</p>
          <p className="mt-auto font-pixel text-[12px] leading-5 text-text-dim">
            ★가 오를 때마다 포인트를 받는다(+8 / +10 / +12 / +16). 31에 도달할 수 있는 스탯은 {MAX_PERFECT_STATS}개까지이며, 찍은 포인트는 언제든 회수할 수 있다.
          </p>
        </div>

        {/* 오른쪽: 기술 */}
        <div className="flex min-h-0 flex-col gap-3 font-pixel">
          <p className="text-[13px] text-text-dim">장착 기술 · 칸을 고른 뒤 아래 기술을 누르면 바뀐다</p>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: MAX_EQUIPPED_MOVES }, (_, i) => {
              const id = card.moves[i];
              const mv = id ? dex.moves[id] : null;
              if (!mv) {
                return <div key={i} className="flex h-14 items-center justify-center rounded-lg border border-dashed border-line text-[12px] text-text-dim">빈 칸</div>;
              }
              return (
                <div key={id} className={`relative rounded-lg ${slot === i ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}>
                  <button type="button" onClick={() => setSlot(slot === i ? null : i)} className="flex h-14 w-full flex-col justify-center rounded-lg px-3 text-left text-white focus-visible:outline-2 focus-visible:outline-accent" style={{ backgroundColor: TYPE_COLOR[mv.type] }}>
                    <span className="text-[14px] font-bold leading-tight">{mv.name}</span>
                    <span className="text-[11px] opacity-90">{TYPE_LABEL[mv.type]} · 위력 {mv.power ?? '—'} · PP {mv.pp}</span>
                  </button>
                  <button type="button" onClick={() => unequip(i)} aria-label={`${mv.name} 빼기`} className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-bg text-[11px] text-text-dim ring-1 ring-line hover:text-text">✕</button>
                </div>
              );
            })}
          </div>
          <p className="text-[13px] text-text-dim">배운 기술 {card.learnedMoves.length}개</p>
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {card.learnedMoves.map((id) => {
              const mv = dex.moves[id];
              if (!mv) return null;
              const on = card.moves.includes(id);
              return (
                <li key={id}>
                  <button type="button" disabled={on} onClick={() => equip(id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-surface-2 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: TYPE_COLOR[mv.type] }} />
                    <span className="flex-1 truncate">{mv.name}</span>
                    <span className="text-[11px] text-text-dim">{CATEGORY_LABEL[mv.category]} · {mv.power ?? '—'}</span>
                    {on && <span className="text-[11px] text-accent">장착</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
