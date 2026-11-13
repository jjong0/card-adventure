// 전투 정보창: 카드 조각 모양 (등급색 줄 + 등급 칩 + ★). 남은 파티는 작은 카드로 표시
import expTable from '../../data/expTable.json';
import { HpBar } from '../../components/HpBar';
import { expForLevel, MAX_LEVEL } from '../../core/progress';
import type { BattleMon, Side } from '../../core/types';
import { dex } from '../../lib/dex';
import { AILMENT_BADGE, RARITY_COLOR } from '../../lib/labels';
import type { ShownSide } from './playback';

function expRatio(mon: BattleMon) {
  const { level, exp, speciesId } = mon.card;
  if (level >= MAX_LEVEL) return 1;
  const growth = dex.species[speciesId].growthRate;
  const from = expForLevel(expTable, growth, level);
  const to = expForLevel(expTable, growth, level + 1);
  return Math.max(0, Math.min(1, (Math.max(exp, from) - from) / (to - from)));
}

interface Props {
  side: Side;
  mon: BattleMon;
  shown: ShownSide;
}

export function InfoCard({ side, mon, shown }: Props) {
  const isPlayer = side === 'player';
  const now = shown.mons[shown.activeIdx];
  const rarity = dex.species[mon.card.speciesId].rarity;
  const badge = now.ailment !== 'none' ? AILMENT_BADGE[now.ailment] : null;

  return (
    <div
      className="relative w-[380px] overflow-hidden rounded-xl border border-line bg-surface/95 py-3 pl-6 pr-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      style={{ boxShadow: `inset 6px 0 0 ${RARITY_COLOR[rarity]}` }}
    >
      <div className="flex items-baseline gap-2 font-pixel">
        <span className="text-[22px] font-bold leading-none">{mon.name}</span>
        <span className="text-[15px] text-text-dim">Lv{mon.card.level}</span>
        {badge && (
          <span className="rounded px-1.5 py-0.5 text-[12px] font-bold text-bg" style={{ backgroundColor: badge.color }}>
            {badge.label}
          </span>
        )}
        <span
          className="ml-auto rounded-sm border px-1.5 text-[11px] leading-4"
          style={{ borderColor: RARITY_COLOR[rarity], color: RARITY_COLOR[rarity] }}
          title="카드 등급"
        >
          {rarity}
        </span>
      </div>

      {isPlayer && (
        <div className="mt-1 text-[13px] tracking-[0.15em] text-accent" aria-label={`★${mon.card.star}`}>
          {'★'.repeat(mon.card.star)}
          <span className="text-line">{'★'.repeat(5 - mon.card.star)}</span>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <span className="font-pixel text-[12px] font-bold text-text-dim">HP</span>
        <HpBar hp={now.hp} max={mon.stats.hp} className="flex-1" />
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        {/* 남은 파티: 쓰러진 카드는 비운다 */}
        <div className="flex gap-1" aria-label={`남은 포켓몬 ${shown.mons.filter((m) => m.hp > 0).length}마리`}>
          {shown.mons.map((m, i) => (
            <span key={i} className={`h-3.5 w-2.5 rounded-[2px] border ${m.hp > 0 ? 'border-accent bg-accent/80' : 'border-line bg-transparent'}`} />
          ))}
        </div>
        {isPlayer && (
          <span className="font-pixel text-[15px] tabular-nums">
            {now.hp} / {mon.stats.hp}
          </span>
        )}
      </div>

      {isPlayer && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2" aria-label="경험치">
          <div className="h-full bg-[#4FA3F7]" style={{ width: `${expRatio(mon) * 100}%` }} />
        </div>
      )}
    </div>
  );
}
