// 카드 한 장: 등급색 테두리·줄, 스프라이트, 이름, 레벨, ★, 타입. 팩 개봉용 뒷면 포함
import type { Card } from '../core/types';
import { dex } from '../lib/dex';
import { RARITY_COLOR } from '../lib/labels';
import { Sprite } from './Sprite';
import { TypeBadge } from './TypeBadge';

export function Stars({ star, className = '' }: { star: number; className?: string }) {
  return (
    <span className={`tracking-[0.12em] text-accent ${className}`} aria-label={`★${star}`}>
      {'★'.repeat(star)}
      <span className="text-line">{'★'.repeat(5 - star)}</span>
    </span>
  );
}

interface Props {
  card: Card;
  /** 카드 아래쪽에 붙는 배지 (NEW, ★상승 등) */
  badge?: React.ReactNode;
  selected?: boolean;
  className?: string;
}

export function CardView({ card, badge, selected = false, className = '' }: Props) {
  const sp = dex.species[card.speciesId];
  const color = RARITY_COLOR[sp.rarity];
  return (
    <div
      className={`relative flex h-[210px] w-[150px] flex-col overflow-hidden rounded-xl border-2 bg-surface ${selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''} ${className}`}
      style={{ borderColor: color, boxShadow: `inset 0 4px 0 ${color}` }}
    >
      <div className="flex items-center justify-between px-2.5 pt-2 font-pixel text-[11px]">
        <span style={{ color }}>{sp.rarity}</span>
        <span className="text-text-dim">Lv{card.level}</span>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        {/* 정지 PNG는 96px 캔버스에 여백이 커서 키운 뒤 가운데만 보인다 */}
        <Sprite speciesId={card.speciesId} name={sp.name} still scale={1.25} className="max-w-none shrink-0" />
      </div>
      <div className="px-2.5 pb-2.5">
        <p className="truncate font-pixel text-[15px] font-bold">{sp.name}</p>
        <Stars star={card.star} className="text-[11px]" />
        <div className="mt-1 flex gap-1">
          {sp.types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
      </div>
      {badge && <div className="absolute right-1.5 top-7">{badge}</div>}
    </div>
  );
}

/** 카드 뒷면 (팩 개봉 전) */
export function CardBack({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex h-[210px] w-[150px] items-center justify-center rounded-xl border-2 border-line bg-surface-2 ${className}`}
      style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(242,193,78,0.07) 0 10px, transparent 10px 20px)' }}
    >
      <span className="font-title text-[28px] text-accent/70">?</span>
    </div>
  );
}
