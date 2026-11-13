// 동작 계열별 기술 연출 (moveFx.json). 원작 이펙트를 따라 그리지 않고 동작을 직접 디자인했다.
// 모두 전장 SVG(1280×520) 좌표. 재생 시간은 기술 이벤트 표시 시간(0.8초) 안에 끝난다.
import { motion } from 'framer-motion';
import type { TypeFx } from './effects';

type Pt = { x: number; y: number };

const glow = (fx: TypeFx, px = 8) => ({ filter: `drop-shadow(0 0 ${px}px ${fx.glow})` });

/** 별 모양 충격파 꼭짓점 (뾰족 10개) */
function burstPath(r: number) {
  return (
    Array.from({ length: 20 }, (_, i) => {
      const a = (Math.PI * i) / 10 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      return `${i ? 'L' : 'M'}${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)}`;
    }).join(' ') + 'Z'
  );
}

function Burst({ fx, at, delay = 0, r = 46 }: { fx: TypeFx; at: Pt; delay?: number; r?: number }) {
  return (
    <motion.path
      d={burstPath(r)}
      fill={fx.color}
      stroke="#fff"
      strokeWidth={2}
      style={{ ...glow(fx, 10), transformBox: 'fill-box', transformOrigin: 'center' }}
      initial={{ x: at.x, y: at.y, scale: 0.2, opacity: 0 }}
      animate={{ scale: [0.2, 1.3, 1.5], opacity: [0, 1, 0], rotate: 20 }}
      transition={{ duration: 0.35, delay }}
    />
  );
}

/** 물기: 위아래 이빨 줄이 닫히며 맞물림 */
const TEETH = 'M-66 0 L-50 32 L-33 0 L-17 32 L0 0 L17 32 L33 0 L50 32 L66 0 Z';
export function Bite({ fx, at }: { fx: TypeFx; at: Pt }) {
  const jaw = (top: boolean) => (
    <motion.path
      d={TEETH}
      fill="#F4F6FA"
      stroke={fx.glow}
      strokeWidth={3}
      style={glow(fx)}
      initial={{ x: at.x, y: at.y + (top ? -70 : 70), scaleY: top ? 1 : -1, opacity: 0 }}
      animate={{ y: [at.y + (top ? -70 : 70), at.y + (top ? -20 : 20), at.y + (top ? -20 : 20)], opacity: [0, 1, 1, 0] }}
      transition={{ duration: 0.55, times: [0, 0.4, 0.8, 1], ease: 'easeIn' }}
    />
  );
  return (
    <g>
      {jaw(true)}
      {jaw(false)}
      <Burst fx={fx} at={at} delay={0.22} r={34} />
    </g>
  );
}

/** 펀치·킥: 쓰는 쪽 방향에서 충격체가 빠르게 날아와 톱니 충격파 */
export function Punch({ fx, from, at }: { fx: TypeFx; from: Pt; at: Pt }) {
  const sx = at.x + (from.x - at.x) * 0.35;
  const sy = at.y + (from.y - at.y) * 0.35;
  return (
    <g>
      <motion.circle
        r={18}
        fill={fx.color}
        stroke="#fff"
        strokeWidth={3}
        style={glow(fx)}
        initial={{ cx: sx, cy: sy, opacity: 0 }}
        animate={{ cx: [sx, at.x], cy: [sy, at.y], opacity: [0, 1, 0] }}
        transition={{ duration: 0.18, ease: 'easeIn' }}
      />
      <Burst fx={fx} at={at} delay={0.16} r={58} />
      <motion.circle
        cx={at.x}
        cy={at.y}
        fill="none"
        stroke={fx.color}
        strokeWidth={4}
        initial={{ r: 10, opacity: 0 }}
        animate={{ r: [10, 85], opacity: [0.9, 0] }}
        transition={{ duration: 0.35, delay: 0.18 }}
      />
    </g>
  );
}

/** 베기: 대각선 궤적 세 줄이 차례로 그어짐 */
export function Slash({ fx, at }: { fx: TypeFx; at: Pt }) {
  return (
    <g style={glow(fx, 6)}>
      {[-24, 0, 24].map((dx, i) => (
        <motion.path
          key={dx}
          d={`M${at.x + dx - 55} ${at.y - 60} Q${at.x + dx + 5} ${at.y - 5} ${at.x + dx + 55} ${at.y + 60}`}
          fill="none"
          stroke={i === 1 ? '#fff' : fx.color}
          strokeWidth={i === 1 ? 7 : 5}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: [0, 1, 1], opacity: [1, 1, 0] }}
          transition={{ duration: 0.4, delay: i * 0.07, times: [0, 0.4, 1] }}
        />
      ))}
    </g>
  );
}

/** 광선: 쓰는 쪽 → 맞는 쪽으로 빛줄기가 뻗고, 가운데 흰 심 */
export function Beam({ fx, from, to }: { fx: TypeFx; from: Pt; to: Pt }) {
  const d = `M${from.x} ${from.y} L${to.x} ${to.y}`;
  const line = (w: number, color: string, delay: number) => (
    <motion.path
      d={d}
      stroke={color}
      strokeWidth={w}
      strokeLinecap="round"
      fill="none"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: [0, 1, 1], opacity: [1, 1, 0] }}
      transition={{ duration: 0.65, delay, times: [0, 0.3, 1] }}
    />
  );
  return (
    <g style={glow(fx, 12)}>
      {line(22, fx.glow, 0)}
      {line(12, fx.color, 0)}
      {line(4, '#fff', 0.03)}
      <Burst fx={fx} at={to} delay={0.2} r={50} />
    </g>
  );
}

/** 방사: 입자가 촘촘히 이어지는 줄기 (살짝 물결) */
export function Stream({ fx, shape, from, to }: { fx: TypeFx; shape: string; from: Pt; to: Pt }) {
  return (
    <g>
      {Array.from({ length: 14 }, (_, i) => {
        const wave = Math.sin(i * 1.3) * 14;
        return (
          <motion.path
            key={i}
            d={shape}
            fill={fx.color}
            stroke={fx.glow}
            strokeWidth={1.5}
            style={{ ...glow(fx), transformBox: 'fill-box', transformOrigin: 'center' }}
            initial={{ x: from.x, y: from.y, scale: 1, opacity: 0 }}
            animate={{ x: [from.x, to.x], y: [from.y, to.y + wave], scale: [1.2, 2.4], opacity: [0, 1, 0.9, 0] }}
            transition={{ duration: 0.38, delay: i * 0.025, ease: 'linear' }}
          />
        );
      })}
      <Burst fx={fx} at={to} delay={0.38} r={44} />
    </g>
  );
}

/** 낙하: 위에서 줄무늬와 함께 쏟아짐 */
export function Fall({ fx, shape, at }: { fx: TypeFx; shape: string; at: Pt }) {
  const xs = [-70, -35, 0, 35, 70];
  return (
    <g>
      {xs.map((dx, i) => (
        <g key={dx}>
          <motion.line
            x1={at.x + dx}
            x2={at.x + dx}
            stroke={fx.color}
            strokeWidth={3}
            strokeLinecap="round"
            style={glow(fx, 6)}
            initial={{ y1: -40, y2: -40, opacity: 0 }}
            animate={{ y1: [-40, at.y - 40], y2: [-40, at.y + 20], opacity: [0, 0.8, 0] }}
            transition={{ duration: 0.3, delay: (i % 3) * 0.08 + i * 0.03 }}
          />
          <motion.path
            d={shape}
            fill={fx.color}
            stroke={fx.glow}
            strokeWidth={1.5}
            style={{ ...glow(fx), transformBox: 'fill-box', transformOrigin: 'center' }}
            initial={{ x: at.x + dx, y: -40, scale: 2.4, opacity: 0 }}
            animate={{ y: [-40, at.y + 10], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.36, delay: (i % 3) * 0.08 + i * 0.03, ease: 'easeIn' }}
          />
        </g>
      ))}
      <Burst fx={fx} at={at} delay={0.38} r={55} />
    </g>
  );
}

/** 지진: 대상 발밑이 갈라지고 돌이 튐 (화면 흔들림은 BattleScreen) */
export function Quake({ fx, shape, at }: { fx: TypeFx; shape: string; at: Pt }) {
  const base = at.y + 62;
  const crack = `M${at.x - 120} ${base} L${at.x - 70} ${base - 8} L${at.x - 40} ${base + 6} L${at.x} ${base - 6} L${at.x + 35} ${base + 8} L${at.x + 80} ${base - 4} L${at.x + 125} ${base + 4}`;
  return (
    <g>
      <motion.path
        d={crack}
        fill="none"
        stroke={fx.glow}
        strokeWidth={6}
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: [0, 1, 1], opacity: [1, 1, 0] }}
        transition={{ duration: 0.75, times: [0, 0.35, 1] }}
      />
      {[-80, -40, 0, 40, 80].map((dx, i) => (
        <motion.path
          key={dx}
          d={shape}
          fill={fx.color}
          stroke={fx.glow}
          strokeWidth={1.5}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={{ x: at.x + dx, y: base, scale: 1.8, opacity: 0 }}
          animate={{ y: [base, base - 60 - (i % 2) * 30, base], opacity: [0, 1, 0], rotate: 90 }}
          transition={{ duration: 0.5, delay: 0.1 + (i % 3) * 0.06, ease: 'easeOut' }}
        />
      ))}
    </g>
  );
}

/** 소리: 음파 호 네 개가 대상 쪽으로 퍼져 나감 (자기 편 대상이면 제자리에서 퍼짐) */
export function Sound({ fx, from, to }: { fx: TypeFx; from: Pt; to: Pt }) {
  const self = from.x === to.x && from.y === to.y;
  const angle = self ? 0 : (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  const end = self ? { x: from.x + 90, y: from.y } : to;
  return (
    <g style={glow(fx, 8)}>
      {[0, 1, 2, 3].map((i) => (
        <motion.path
          key={i}
          d="M0 -45 Q30 0 0 45"
          fill="none"
          stroke={fx.color}
          strokeWidth={7}
          strokeLinecap="round"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={{ x: from.x, y: from.y, rotate: angle, scale: 0.7, opacity: 0 }}
          animate={{ x: [from.x, end.x], y: [from.y, end.y], scale: [0.7, 2], opacity: [0, 1, 0] }}
          transition={{ duration: 0.5, delay: i * 0.09, ease: 'easeOut' }}
        />
      ))}
    </g>
  );
}

/** 폭발: 화면 전체 섬광 + 쓰는 쪽에서 큰 폭발 */
export function Explode({ fx, at }: { fx: TypeFx; at: Pt }) {
  return (
    <g>
      <motion.rect x={0} y={0} width={1280} height={520} fill="#fff" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.85, 0] }} transition={{ duration: 0.45 }} />
      <motion.circle cx={at.x} cy={at.y} fill={fx.glow} initial={{ r: 0, opacity: 0 }} animate={{ r: [0, 240], opacity: [0.9, 0] }} transition={{ duration: 0.6 }} />
      <Burst fx={fx} at={at} r={110} />
    </g>
  );
}
