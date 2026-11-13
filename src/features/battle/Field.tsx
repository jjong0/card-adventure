// 전장: 발판 위 스프라이트(상대 앞모습, 내 쪽 뒷모습)와 등장·공격·피격·기절 연출
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { Sprite } from '../../components/Sprite';
import type { BattleState, Side } from '../../core/types';
import type { Cue, Shown } from './playback';

const LAYOUT = {
  enemy: { platform: 'left-[760px] top-[200px] w-[360px] h-[72px]', sprite: 'left-[940px] top-[240px]', scale: 2.4, maxHeight: 220, dir: 1 },
  player: { platform: 'left-[150px] top-[410px] w-[440px] h-[86px]', sprite: 'left-[370px] top-[456px]', scale: 2.8, maxHeight: 280, dir: -1 },
} as const;

function BattleSprite({ side, state, shown }: { side: Side; state: BattleState; shown: Shown }) {
  const controls = useAnimationControls();
  const reduce = useReducedMotion();
  const view = shown[side];
  const mon = state[side].party[view.activeIdx];
  const cue: Cue | null = shown.cue?.side === side ? shown.cue : null;
  const { dir } = LAYOUT[side];

  useEffect(() => {
    if (!cue) {
      controls.set({ opacity: view.visible ? 1 : 0, x: 0, y: 0 });
      return;
    }
    if (reduce) {
      controls.set({ opacity: cue.kind === 'faint' ? 0 : 1, x: 0, y: 0 });
      return;
    }
    if (cue.kind === 'enter') {
      controls.set({ opacity: 0, x: 90 * dir, y: 0 });
      controls.start({ opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } });
    } else if (cue.kind === 'attack') {
      controls.start({ x: [0, -36 * dir, 0], y: [0, 18 * dir, 0], transition: { duration: 0.3 } });
    } else if (cue.kind === 'hit') {
      controls.start({ opacity: [1, 0.15, 1, 0.15, 1], transition: { duration: 0.5 } });
    } else {
      controls.start({ y: 70, opacity: 0, transition: { duration: 0.5, ease: 'easeIn' } });
    }
    // cue.key가 바뀔 때만 연출. visible은 cue가 없을 때의 초기 표시에만 쓴다
  }, [cue?.key, view.visible]);

  return (
    <div className={`absolute ${LAYOUT[side].sprite} -translate-x-1/2 -translate-y-full`}>
      <motion.div animate={controls} initial={{ opacity: 0 }} className="flex items-end justify-center">
        <Sprite speciesId={mon.card.speciesId} name={mon.name} back={side === 'player'} scale={LAYOUT[side].scale} maxHeight={LAYOUT[side].maxHeight} />
      </motion.div>
    </div>
  );
}

export function Field({ state, shown }: { state: BattleState; shown: Shown }) {
  return (
    <div
      className="absolute inset-x-0 top-0 h-[520px] overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #16223a 0%, #22355a 52%, #1d2c45 52%, #131d2e 100%)' }}
    >
      {(['enemy', 'player'] as const).map((side) => (
        <div
          key={side}
          className={`absolute rounded-[50%] ${LAYOUT[side].platform}`}
          style={{ background: 'radial-gradient(ellipse at center, #3a4b68 0%, #2c3a52 55%, rgba(44,58,82,0) 72%)' }}
        />
      ))}
      <BattleSprite side="enemy" state={state} shown={shown} />
      <BattleSprite side="player" state={state} shown={shown} />
    </div>
  );
}
