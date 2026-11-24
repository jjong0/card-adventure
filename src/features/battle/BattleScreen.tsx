// 전투 화면 (spec §8 화면 5): 전장 + 정보창 + 메시지 상자 + 명령 패널, 이벤트를 하나씩 재생
import { useEffect, useState } from 'react';
import type { BattleState } from '../../core/types';
import { useBattleStore } from '../../store/battleStore';
import { CommandPanel } from './CommandPanel';
import { Field } from './Field';
import { InfoCard } from './InfoCard';
import { MessageBox } from './MessageBox';
import { MoveEffect, ShakeLayer } from './MoveEffect';
import { eventDuration } from './playback';

interface Props {
  /** 도망쳤을 때. 없으면 도망칠 수 없다 (트레이너전) */
  onRun?: () => void;
  /** 승부가 난 뒤 버튼을 눌렀을 때 */
  onEnd: (state: BattleState) => void;
  /** 결과 창 버튼 문구 (이겼을 때 / 졌을 때) */
  endLabel: { win: string; lose: string };
  /** 가방 (없으면 전투 중 가방을 쓸 수 없다) */
  bag?: Record<string, number>;
  /** 배경 장소 (battleEnv). 없으면 풀밭 */
  env?: string;
}

export function BattleScreen({ onRun, onEnd, endLabel, bag, env }: Props) {
  const { state, shown, queue, current, act, next, skip } = useBattleStore();
  const [detail, setDetail] = useState<string | null>(null);
  const busy = queue.length > 0;

  // 이벤트 재생: 방금 보여준 이벤트의 표시 시간이 지나면 다음 이벤트
  useEffect(() => {
    if (!queue.length) return;
    const t = setTimeout(next, current ? eventDuration(current) : 0);
    return () => clearTimeout(t);
  }, [queue, current, next]);

  if (!state || !shown) return null;
  const ended = !busy && state.result !== 'ongoing';

  return (
    <div className="relative h-full w-full select-none">
      <ShakeLayer effect={shown.effect}>
        <Field state={state} shown={shown} env={env} />
        <MoveEffect effect={shown.effect} />
      </ShakeLayer>

      <div className="absolute left-10 top-8">
        <InfoCard side="enemy" mon={state.enemy.party[shown.enemy.activeIdx]} shown={shown.enemy} />
      </div>
      <div className="absolute right-10 top-[318px]">
        <InfoCard side="player" mon={state.player.party[shown.player.activeIdx]} shown={shown.player} />
      </div>

      <div className="absolute inset-x-0 bottom-0 grid h-[200px] grid-cols-[1fr_460px] gap-3 border-t-2 border-line bg-bg p-3">
        <MessageBox text={shown.message} detail={busy ? null : detail} busy={busy} onNext={next} onSkip={skip} />
        <CommandPanel state={state} shown={shown} busy={busy || ended} onRun={onRun} onAct={act} onHover={setDetail} bag={bag} />
      </div>

      {ended && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/70">
          <div className="w-[420px] rounded-2xl border border-line bg-surface p-8 text-center shadow-2xl">
            <p className={`font-title text-[44px] ${state.result === 'win' ? 'text-accent' : 'text-text-dim'}`}>
              {state.result === 'win' ? '승리!' : '패배…'}
            </p>
            <p className="mt-2 font-pixel text-[15px] text-text-dim">{state.turn - 1}턴 만에 승부가 났다.</p>
            <button
              type="button"
              onClick={() => onEnd(state)}
              autoFocus
              className="mt-6 rounded-lg bg-accent px-6 py-2.5 font-pixel text-[18px] font-bold text-bg hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {endLabel[state.result === 'win' ? 'win' : 'lose']}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
