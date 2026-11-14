// 팩 결과 배지: NEW / ★2 → ★3 / ★3까지 1/2 / +100G (spec §4.2)
import { STAR_DUP_COST } from '../../core/card';
import type { AddResult } from '../../core/gacha';

export function ResultBadge({ result }: { result: AddResult }) {
  const base = 'rounded-md px-1.5 py-0.5 font-pixel text-[11px] font-bold shadow';
  switch (result.kind) {
    case 'new':
      return <span className={`${base} bg-accent text-bg`}>NEW</span>;
    case 'star-up':
      return <span className={`${base} bg-[#F2795A] text-bg`}>★{result.from} → ★{result.to}</span>;
    case 'gold':
      return <span className={`${base} bg-surface-2 text-accent ring-1 ring-accent`}>+{result.gold}G</span>;
    case 'progress': {
      const c = result.card;
      return (
        <span className={`${base} bg-surface-2 text-text ring-1 ring-line`}>
          ★{c.star + 1}까지 {c.dupProgress}/{STAR_DUP_COST[c.star - 1]}
        </span>
      );
    }
  }
}
