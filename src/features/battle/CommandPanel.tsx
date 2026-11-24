// 명령 패널: 싸운다 / 가방 / 포켓몬 / 도망 → 기술 4개 또는 교체할 포켓몬
import { useState } from 'react';
import { HpBar } from '../../components/HpBar';
import { Sprite } from '../../components/Sprite';
import { bagItemProblem, fixJosa, typeEffectiveness } from '../../core/battle';
import { HEAL_ITEMS, PP_ITEMS } from '../../core/bagItems';
import { usableMoves } from '../../core/heldItems';
import type { BattleAction, BattleState } from '../../core/types';
import { dex } from '../../lib/dex';
import { CATEGORY_LABEL, effectivenessLabel, TYPE_COLOR, TYPE_LABEL } from '../../lib/labels';
import type { Shown } from './playback';

const MENU = [
  { key: 'fight', label: '싸운다', color: '#F2795A' },
  { key: 'bag', label: '가방', color: '#F2C14E' },
  { key: 'party', label: '포켓몬', color: '#5CC98B' },
  { key: 'run', label: '도망', color: '#4FA3F7' },
] as const;

interface Props {
  state: BattleState;
  shown: Shown;
  busy: boolean;
  /** 도망쳤을 때. 없으면 도망 버튼이 비활성 */
  onRun?: () => void;
  onAct: (a: BattleAction) => void;
  onHover: (detail: string | null) => void;
  /** 가방 (없으면 가방 버튼이 비활성, 테스트 전투 등) */
  bag?: Record<string, number>;
}

/** 전투에서 쓸 수 있는 약: 회복약 + PP 회복약 */
const BATTLE_ITEMS = [...HEAL_ITEMS.map((i) => ({ id: i.id, name: i.name, single: false })), ...PP_ITEMS.map((i) => ({ id: i.id, name: i.name, single: i.single }))];
type BattleItem = (typeof BATTLE_ITEMS)[number];

/** 기술에 커서를 올렸을 때 메시지 상자에 보여줄 정보 (spec §8 화면 5) */
function moveDetail(moveId: string, state: BattleState, shown: Shown) {
  const mv = dex.moves[moveId];
  if (!mv) return null;
  const foe = state.enemy.party[shown.enemy.activeIdx];
  const head = `${TYPE_LABEL[mv.type]} · ${CATEGORY_LABEL[mv.category]} · 위력 ${mv.power ?? '—'} · 명중 ${mv.accuracy ?? '—'}`;
  const eff = mv.category === 'status' ? '' : ` · ${foe.name}에게 ${effectivenessLabel(typeEffectiveness(mv.type, foe.types, dex))}`;
  return `${head}${eff}\n${mv.description}`;
}

export function CommandPanel({ state, shown, busy, onRun, onAct, onHover, bag }: Props) {
  const [mode, setMode] = useState<'menu' | 'fight' | 'party' | 'bag' | 'bagTarget' | 'bagMove'>('menu');
  const [item, setItem] = useState<BattleItem | null>(null);
  const [targetIdx, setTargetIdx] = useState(0);
  // 남은 개수 = 가방 − 이번 전투에서 쓴 것 (가방은 전투가 끝나야 줄어든다)
  const left = (id: string) => (bag?.[id] ?? 0) - state.itemsUsed.filter((x) => x === id).length;
  const items = BATTLE_ITEMS.filter((i) => left(i.id) > 0);
  const bagBlocked = !bag ? '테스트 전투에서는 가방을 쓸 수 없습니다' : !state.itemsAllowed ? '이 승부에서는 가방을 쓸 수 없다' : null;
  const forcedSwitch = state.pendingSwitch && !busy;
  const view = forcedSwitch ? 'party' : mode;
  const me = state.player.party[shown.player.activeIdx];
  // 고를 수 있는 기술: PP가 남았고 구애 고정·돌격조끼에 막히지 않은 것. 하나도 없으면 아무 버튼이나 발버둥
  const usable = usableMoves(me, dex.moves);
  const allOut = usable.length === 0;

  const act = (a: BattleAction) => {
    onHover(null);
    setMode('menu');
    onAct(a);
  };
  const back = () => {
    onHover(null);
    setMode('menu');
  };
  const btn = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40';

  if (view === 'fight') {
    return (
      <div className="grid h-full grid-cols-[1fr_1fr_88px] grid-rows-2 gap-2.5">
        {me.card.moves.map((id, i) => {
          const mv = dex.moves[id];
          const pp = me.pp[id] ?? 0;
          return (
            <button
              key={id}
              type="button"
              disabled={busy || (!usable.includes(id) && !allOut)}
              onClick={() => act({ kind: 'move', moveId: id })}
              onMouseEnter={() => onHover(moveDetail(id, state, shown))}
              onFocus={() => onHover(moveDetail(id, state, shown))}
              onMouseLeave={() => onHover(null)}
              className={`${btn} flex flex-col justify-center rounded-lg px-4 text-left text-white shadow-[inset_0_-4px_0_rgba(0,0,0,0.25)] ${i === 1 || i === 3 ? 'col-start-2' : 'col-start-1'}`}
              style={{ backgroundColor: mv ? TYPE_COLOR[mv.type] : '#2C3A52' }}
            >
              <span className="font-pixel text-[20px] font-bold leading-tight">{mv?.name ?? id}</span>
              <span className="font-pixel text-[13px] opacity-90">
                {mv ? TYPE_LABEL[mv.type] : ''} · PP {pp}/{mv?.pp ?? 0}
              </span>
            </button>
          );
        })}
        <button type="button" onClick={back} className={`${btn} col-start-3 row-span-2 row-start-1 rounded-lg border-2 border-line bg-surface font-pixel text-[16px] text-text-dim hover:text-text`}>
          취소
        </button>
      </div>
    );
  }

  if (view === 'bag' || view === 'bagTarget' || view === 'bagMove') {
    const header = (text: string, onBack: () => void) => (
      <div className="flex items-center justify-between font-pixel text-[14px] text-text-dim">
        <span>{text}</span>
        <button type="button" onClick={onBack} className={`${btn} rounded px-2 hover:text-text`}>취소</button>
      </div>
    );
    if (view === 'bag') {
      return (
        <div className="flex h-full flex-col gap-2">
          {header('쓸 약을 고르세요', back)}
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto">
            {items.map((i) => (
              <button key={i.id} type="button" disabled={busy} onClick={() => { setItem(i); setMode('bagTarget'); }} className={`${btn} flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 font-pixel text-[15px] hover:border-accent`}>
                <span className="font-bold">{i.name}</span>
                <span className="text-text-dim">× {left(i.id)}</span>
              </button>
            ))}
            {!items.length && <p className="col-span-2 pt-6 text-center font-pixel text-[14px] text-text-dim">전투에서 쓸 수 있는 약이 없다.</p>}
          </div>
        </div>
      );
    }
    const target = state.player.party[targetIdx];
    if (view === 'bagMove' && item) {
      return (
        <div className="flex h-full flex-col gap-2">
          {header(`${target.name}: PP를 회복할 기술을 고르세요`, () => setMode('bagTarget'))}
          <div className="grid flex-1 grid-cols-2 gap-2">
            {target.card.moves.map((id) => {
              const max = dex.moves[id]?.pp ?? 0;
              const now = target.pp[id] ?? 0;
              return (
                <button key={id} type="button" disabled={busy || now >= max} onClick={() => { act({ kind: 'item', itemId: item.id, targetIdx, moveId: id }); setItem(null); }} className={`${btn} flex items-center justify-between rounded-lg border border-line bg-surface px-3 font-pixel text-[15px] hover:border-accent`}>
                  <span className="font-bold">{dex.moves[id]?.name ?? id}</span>
                  <span className={now === 0 ? 'text-[#F2795A]' : 'text-text-dim'}>{now}/{max}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    if (item) {
      return (
        <div className="flex h-full flex-col gap-2">
          {header(fixJosa(`${item.name}을(를) 쓸 포켓몬을 고르세요`), () => setMode('bag'))}
          <div className="grid flex-1 grid-cols-2 gap-2">
            {state.player.party.map((m, i) => {
              const hp = shown.player.mons[i].hp;
              // 기술 1개용 PP 약은 기술을 고르기 전이라, 덜 찬 기술이 하나라도 있는지로 판단
              const problem = item.single
                ? m.card.moves.some((id) => !bagItemProblem(m, item.id, dex.moves, id)) ? null : 'PP가 가득 차 있다.'
                : bagItemProblem(m, item.id, dex.moves);
              return (
                <button
                  key={m.card.uid}
                  type="button"
                  disabled={busy || !!problem}
                  title={problem ?? undefined}
                  onClick={() => {
                    if (item.single) {
                      setTargetIdx(i);
                      setMode('bagMove');
                    } else {
                      act({ kind: 'item', itemId: item.id, targetIdx: i });
                      setItem(null);
                    }
                  }}
                  className={`${btn} flex items-center gap-2 rounded-lg border border-line bg-surface px-2 text-left hover:border-accent`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden">
                    <Sprite speciesId={m.card.speciesId} name={m.name} still scale={1.1} className="max-w-none shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between font-pixel text-[13px]">
                      <span className="truncate font-bold">{m.name}</span>
                      <span className="text-text-dim">{problem ?? `${hp}/${m.stats.hp}`}</span>
                    </div>
                    <HpBar hp={hp} max={m.stats.hp} className="mt-1 h-1.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }
  }

  if (view === 'party') {
    return (
      <div className="flex h-full flex-col gap-2">
        <div className="flex items-center justify-between font-pixel text-[14px] text-text-dim">
          <span>{forcedSwitch ? '다음 포켓몬을 고르세요' : '교체할 포켓몬을 고르세요'}</span>
          {!forcedSwitch && (
            <button type="button" onClick={back} className={`${btn} rounded px-2 hover:text-text`}>
              취소
            </button>
          )}
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2">
          {state.player.party.map((m, i) => {
            const hp = shown.player.mons[i].hp;
            const active = i === shown.player.activeIdx && !forcedSwitch;
            return (
              <button
                key={m.card.uid}
                type="button"
                disabled={busy || hp <= 0 || active}
                onClick={() => act({ kind: 'switch', toIdx: i })}
                className={`${btn} flex items-center gap-2 rounded-lg border border-line bg-surface px-2 text-left hover:border-accent ${active ? 'ring-1 ring-accent' : ''}`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden">
                  {/* PNG는 96px 캔버스에 여백이 커서 확대 후 가운데만 (max-w-none: 기본 스타일의 img 최대 너비 100% 해제) */}
                  <Sprite speciesId={m.card.speciesId} name={m.name} still scale={1.1} className="max-w-none shrink-0" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between font-pixel text-[13px]">
                    <span className="truncate font-bold">{m.name}</span>
                    <span className="text-text-dim">Lv{m.card.level}</span>
                  </div>
                  <HpBar hp={hp} max={m.stats.hp} className="mt-1 h-1.5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-2.5">
      {MENU.map((m) => {
        const disabled = busy || (m.key === 'bag' && !!bagBlocked) || (m.key === 'run' && !onRun);
        const title = m.key === 'bag' ? bagBlocked ?? undefined : m.key === 'run' && !onRun ? '트레이너와의 승부에서는 도망칠 수 없습니다' : undefined;
        return (
          <button
            key={m.key}
            type="button"
            disabled={disabled}
            title={title}
            onClick={() => (m.key === 'run' ? onRun?.() : setMode(m.key))}
            className={`${btn} rounded-xl font-pixel text-[26px] font-bold text-bg shadow-[inset_0_-5px_0_rgba(0,0,0,0.22)] enabled:hover:brightness-110`}
            style={{ backgroundColor: m.color }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
