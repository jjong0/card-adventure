// 기술 이펙트 레이어: 전장 위 SVG. 타입별 모양·색으로 타격 / 투사체 / 오라를 그린다 (effects.ts)
// 입자 배치는 각도·순서로 정해 무작위를 쓰지 않는다. 동작 줄이기 설정이면 그리지 않는다.
import { motion, useReducedMotion } from 'framer-motion';
import type { Side } from '../../core/types';
import { dex } from '../../lib/dex';
import { effectPlan, SHAPE_PATH, SPINS, type TypeFx } from './effects';
import type { MoveFx } from './playback';

/** 전장(1280×520) 안에서 각 스프라이트의 대략적인 중심 (Field.tsx 배치 기준) */
const CENTER: Record<Side, { x: number; y: number }> = {
  enemy: { x: 940, y: 170 },
  player: { x: 370, y: 370 },
};

interface PartProps {
  fx: TypeFx;
  x: number[];
  y: number[];
  delay?: number;
  duration?: number;
  scale?: number[];
  rotate?: number;
}

function Part({ fx, x, y, delay = 0, duration = 0.45, scale = [1.5, 2.2], rotate = 0 }: PartProps) {
  return (
    <motion.path
      d={SHAPE_PATH[fx.shape]}
      fill={fx.color}
      stroke={fx.glow}
      strokeWidth={1.5}
      style={{ transformBox: 'fill-box', transformOrigin: 'center', filter: `drop-shadow(0 0 8px ${fx.glow})` }}
      initial={{ x: x[0], y: y[0], opacity: 0, scale: scale[0], rotate: 0 }}
      animate={{ x, y, opacity: [0, 1, 1, 0], scale, rotate: SPINS[fx.shape] ? rotate : 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
    />
  );
}

/** 맞는 쪽에서 터지는 타격: 섬광 + 사방으로 튀는 입자 8개 */
function Impact({ fx, at, delay = 0, radius = 95, count = 8 }: { fx: TypeFx; at: { x: number; y: number }; delay?: number; radius?: number; count?: number }) {
  return (
    <g>
      <motion.circle
        cx={at.x}
        cy={at.y}
        fill={fx.glow}
        initial={{ r: 0, opacity: 0 }}
        animate={{ r: [0, radius * 0.7], opacity: [0.75, 0] }}
        transition={{ duration: 0.35, delay }}
      />
      {Array.from({ length: count }, (_, i) => {
        const a = (Math.PI * 2 * i) / count + 0.3;
        return (
          <Part key={i} fx={fx} delay={delay + 0.03} x={[at.x, at.x + Math.cos(a) * radius]} y={[at.y, at.y + Math.sin(a) * radius]} rotate={(i % 2 ? 1 : -1) * 120} />
        );
      })}
    </g>
  );
}

/** 쓰는 쪽 → 맞는 쪽 투사체 6개(살짝 포물선), 도착하면 작은 타격 */
function Projectile({ fx, from, to }: { fx: TypeFx; from: { x: number; y: number }; to: { x: number; y: number } }) {
  const midY = Math.min(from.y, to.y) - 50;
  return (
    <g>
      {Array.from({ length: 7 }, (_, i) => (
        <Part key={i} fx={fx} delay={i * 0.04} duration={0.42} x={[from.x, (from.x + to.x) / 2, to.x]} y={[from.y, midY + (i % 3) * 14, to.y]} scale={[1.6, 2.3, 1.8]} rotate={i * 40} />
      ))}
      <Impact fx={fx} at={to} delay={0.42} radius={60} count={6} />
    </g>
  );
}

/** 대상 주위 오라: 발밑 빛 + 입자가 위(상승)·아래(하락)로, 방향 없으면 고리가 퍼짐 */
function Aura({ fx, at, dir }: { fx: TypeFx; at: { x: number; y: number }; dir: 'up' | 'down' | 'none' }) {
  const offsets = [-60, -36, -12, 12, 36, 60];
  return (
    <g>
      <motion.ellipse
        cx={at.x}
        cy={at.y + 62}
        rx={95}
        ry={20}
        fill={fx.glow}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.55, 0] }}
        transition={{ duration: 0.8 }}
      />
      {dir === 'none'
        ? [0, 0.25].map((d) => (
            <motion.circle
              key={d}
              cx={at.x}
              cy={at.y}
              fill="none"
              stroke={fx.color}
              strokeWidth={5}
              initial={{ r: 20, opacity: 0 }}
              animate={{ r: [20, 90], opacity: [0.9, 0] }}
              transition={{ duration: 0.5, delay: d }}
            />
          ))
        : offsets.map((dx, i) => {
            const low = at.y + 55;
            const high = at.y - 75;
            return (
              <Part key={i} fx={fx} delay={(i % 3) * 0.1} duration={0.55} x={[at.x + dx, at.x + dx]} y={dir === 'up' ? [low, high] : [high, low]} scale={[1.5, 1.5]} />
            );
          })}
    </g>
  );
}

export function MoveEffect({ effect }: { effect: MoveFx | null }) {
  const reduce = useReducedMotion();
  if (!effect || reduce) return null;
  const plan = effectPlan(dex.moves[effect.moveId], effect.side);
  const from = CENTER[plan.from];
  const to = CENTER[plan.to];
  return (
    <svg key={effect.key} className="pointer-events-none absolute left-0 top-0" width={1280} height={520} aria-hidden>
      {plan.kind === 'impact' && <Impact fx={plan.fx} at={to} delay={0.15} />}
      {plan.kind === 'projectile' && <Projectile fx={plan.fx} from={from} to={to} />}
      {plan.kind === 'aura' && <Aura fx={plan.fx} at={to} dir={plan.dir} />}
    </svg>
  );
}
