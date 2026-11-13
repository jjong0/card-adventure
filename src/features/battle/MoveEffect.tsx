// 기술 이펙트 레이어: 동작 계열·타입·분류로 고른 스프라이트 시트를 전장 위에 재생 (effects.ts, lib/fxAssets.ts)
// 그림이 없으면 그리지 않는다. 동작 줄이기 설정이면 그리지도 흔들지도 않는다.
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import type { Side } from '../../core/types';
import { dex } from '../../lib/dex';
import { resolveFx } from '../../lib/fxAssets';
import { effectPlan, isFamily } from './effects';
import type { MoveFx } from './playback';
import { SpriteFx } from './SpriteFx';

/** 전장(1280×520) 안에서 각 스프라이트의 대략적인 중심 (Field.tsx 배치 기준) */
export const FX_CENTER: Record<Side, { x: number; y: number }> = {
  enemy: { x: 940, y: 170 },
  player: { x: 370, y: 370 },
};

export function MoveEffect({ effect }: { effect: MoveFx | null }) {
  const reduce = useReducedMotion();
  if (!effect || reduce) return null;
  const move = dex.moves[effect.moveId];
  if (!move) return null; // 발버둥
  const plan = effectPlan(move, effect.side);
  const sprite = resolveFx(move, isFamily(plan.kind) ? plan.kind : undefined);
  if (!sprite) return null;
  return (
    <div key={effect.key} className="pointer-events-none absolute left-0 top-0 h-[520px] w-[1280px] overflow-hidden" aria-hidden>
      <SpriteFx sprite={sprite} from={FX_CENTER[plan.from]} to={FX_CENTER[plan.to]} />
    </div>
  );
}

/** 지진·폭발 계열이면 전장을 흔든다 */
export function ShakeLayer({ effect, children }: { effect: MoveFx | null; children: ReactNode }) {
  const controls = useAnimationControls();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!effect || reduce) return;
    const kind = effectPlan(dex.moves[effect.moveId], effect.side).kind;
    if (kind === 'quake' || kind === 'explode') {
      controls.start({ x: [0, -14, 14, -10, 10, -5, 0], transition: { duration: 0.5, delay: kind === 'quake' ? 0.1 : 0 } });
    }
  }, [effect, reduce, controls]);
  return (
    <motion.div animate={controls} className="absolute inset-0">
      {children}
    </motion.div>
  );
}
