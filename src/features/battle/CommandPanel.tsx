// 명령 패널: 싸운다 / 가방 / 포켓몬 / 도망 → 기술 4개 또는 교체할 포켓몬
import { useState } from 'react';
import { HpBar } from '../../components/HpBar';
import { Sprite } from '../../components/Sprite';
import { typeEffectiveness } from '../../core/battle';
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
}

/** 기술에 커서를 올렸을 때 메시지 상자에 보여줄 정보 (spec §8 화면 5) */
function moveDetail(moveId: string, state: BattleState, shown: Shown) {
  const mv = dex.moves[moveId];
  if (!mv) return null;
  const foe = state.enemy.party[shown.enemy.activeIdx];
  const head = `${TYPE_LABEL[mv.type]} · ${CATEGORY_LABEL[mv.category]} · 위력 ${mv.power ?? '—'} · 명중 ${mv.accuracy ?? '—'}`;
  const eff = mv.category === 'status' ? '' : ` · ${foe.name}에게 ${effectivenessLabel(typeEffectiveness(mv.type, foe.types, dex))}`;
  return `${head}${eff}\n${mv.description}`;
}

export function CommandPanel({ state, shown, busy, onRun, onAct, onHover }: Props) {
  const [mode, setMode] = useState<'menu' | 'fight' | 'party'>('menu');
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
        const disabled = busy || m.key === 'bag' || (m.key === 'run' && !onRun);
        const title = m.key === 'bag' ? '아이템은 아직 쓸 수 없습니다' : m.key === 'run' && !onRun ? '트레이너와의 승부에서는 도망칠 수 없습니다' : undefined;
        return (
          <button
            key={m.key}
            type="button"
            disabled={disabled}
            title={title}
            onClick={() => (m.key === 'fight' || m.key === 'party' ? setMode(m.key) : m.key === 'run' ? onRun?.() : undefined)}
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
