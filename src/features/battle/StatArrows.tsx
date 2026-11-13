// 랭크 변화 연출: 상승은 빨간 화살표가 위로, 하락은 파란 화살표가 아래로 지나간다
import { motion, useReducedMotion } from 'framer-motion';

export const STAT_COLOR = { up: '#FF5A4E', down: '#4F8FF7' } as const;

// 회전 transform은 framer-motion의 위치 애니메이션이 덮어써서, 아래 화살표는 모양을 따로 둔다
const ARROW_UP = 'M0 -22 L18 1 L7 1 L7 22 L-7 22 L-7 1 L-18 1 Z';
const ARROW_DOWN = 'M0 22 L18 -1 L7 -1 L7 -22 L-7 -22 L-7 -1 L-18 -1 Z';
const XS = [-72, -44, -15, 14, 43, 70];

export function StatArrows({ up }: { up: boolean }) {
  const reduce = useReducedMotion();
  const color = up ? STAT_COLOR.up : STAT_COLOR.down;
  const [from, to] = up ? [70, -110] : [-110, 70];
  return (
    <svg className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 overflow-visible" width={220} height={240} viewBox="-110 -200 220 240" aria-hidden>
      {XS.map((x, i) => (
        <motion.path
          key={x}
          d={up ? ARROW_UP : ARROW_DOWN}
          fill={color}
          stroke="#fff"
          strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          initial={{ x, y: reduce ? -40 : from, opacity: 0 }}
          animate={reduce ? { opacity: [0, 1, 0] } : { y: [from, to], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.5, delay: (i % 3) * 0.06 + (i % 2) * 0.04, ease: up ? 'easeOut' : 'easeIn' }}
        />
      ))}
    </svg>
  );
}
