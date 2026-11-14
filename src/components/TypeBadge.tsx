// 타입 배지: 타입 색 배경 + 한국어 이름
import type { ElementType } from '../core/types';
import { TYPE_COLOR, TYPE_LABEL } from '../lib/labels';

export function TypeBadge({ type, size = 'sm' }: { type: ElementType; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`inline-block rounded font-pixel font-bold leading-none text-white ${size === 'md' ? 'px-2 py-1 text-[13px]' : 'px-1.5 py-0.5 text-[11px]'}`}
      style={{ backgroundColor: TYPE_COLOR[type] }}
    >
      {TYPE_LABEL[type]}
    </span>
  );
}
