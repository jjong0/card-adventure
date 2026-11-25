// 새 게임 (spec §8 화면 2): 난이도 4개(§5.3 표 내용), 너즐록·랜덤 스타터, "시작 후 변경 불가" 경고
import { useState } from 'react';
import { fixJosa } from '../../core/battle';
import { DIFFICULTIES, DIFFICULTY } from '../../core/difficulty';
import type { Difficulty } from '../../core/types';
import type { Challenges } from '../../store/gameStore';

const AI_LABEL = { random: '무작위 기술', basic: '가장 센 기술', smart: '교체·변화기를 씀', expert: '한 수 앞을 읽음' } as const;

const COLOR: Record<Difficulty, string> = { easy: '#5CC98B', normal: '#4FA3F7', hard: '#F2795A', extreme: '#B27CF2' };
const BLURB: Record<Difficulty, string> = {
  easy: '카드 모으기를 즐기고 싶을 때',
  normal: '원작 그대로의 레벨과 파티',
  hard: '관장이 한 마리 더, 레벨 캡이 있다',
  extreme: '관장이 재대결 파티로 나온다',
};

function rows(d: Difficulty): [string, string][] {
  const r = DIFFICULTY[d];
  return [
    ['상대 레벨', r.levelOffset === 0 ? '원작' : `원작 ${r.levelOffset > 0 ? '+' : '−'}${Math.abs(r.levelOffset)}`],
    ['상대 개체값', r.ivs === 'original' ? '원작' : r.ivs[0] === r.ivs[1] ? `${r.ivs[0]}` : `${r.ivs[0]}~${r.ivs[1]}`],
    ['트레이너 AI', AI_LABEL[r.ai]],
    ['관장 파티', r.leaderParty === 'story' ? '원작' : r.leaderParty === 'story+1' ? '원작 + 재대결 1마리' : '재대결 6마리'],
    ['레벨 캡', r.levelCap === 'none' ? '없음' : r.levelCap === 'leader-ace' ? '관장 에이스 Lv' : '관장 에이스 Lv −2'],
    ['골드 보상', `×${r.goldRate}`],
    ['휴식 회복', r.restHeal === 1 ? '전부' : `HP ${r.restHeal * 100}%`],
    ['패배하면', r.lossGold === 0 ? '챕터 재시작' : r.lossGold === 1 ? '+ 골드 전부 잃음' : '+ 골드 절반 잃음'],
  ];
}

interface Props {
  slot: number;
  onStart: (difficulty: Difficulty, challenges: Challenges) => void;
  onBack: () => void;
}

export function NewGameScreen({ slot, onStart, onBack }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [challenges, setChallenges] = useState<Challenges>({ nuzlocke: false, randomStarter: false });
  const toggle = (k: keyof Challenges) => setChallenges((c) => ({ ...c, [k]: !c[k] }));

  return (
    <div className="flex h-full flex-col gap-5 px-12 py-8 font-pixel">
      <header className="flex items-baseline gap-4">
        <h2 className="font-title text-[36px] text-accent">새 게임</h2>
        <span className="text-[14px] text-text-dim">슬롯 {slot}</span>
        <button type="button" onClick={onBack} className="ml-auto rounded-lg px-3 py-1.5 text-[14px] text-text-dim ring-1 ring-line hover:text-text">뒤로</button>
      </header>

      <div className="grid grid-cols-4 gap-4" role="radiogroup" aria-label="난이도">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={difficulty === d}
            onClick={() => setDifficulty(d)}
            className={`flex flex-col rounded-2xl border-2 bg-surface p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${difficulty === d ? '' : 'border-line opacity-80 hover:opacity-100'}`}
            style={difficulty === d ? { borderColor: COLOR[d], boxShadow: `0 0 18px ${COLOR[d]}55` } : undefined}
          >
            <span className="font-title text-[28px]" style={{ color: COLOR[d] }}>{DIFFICULTY[d].label}</span>
            <span className="text-[12px] text-text-dim">{BLURB[d]}</span>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
              {rows(d).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-text-dim">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        <label className="flex cursor-pointer items-start gap-2 text-[14px]">
          <input type="checkbox" checked={challenges.nuzlocke} onChange={() => toggle('nuzlocke')} className="mt-1 h-4 w-4 accent-[#F2C14E]" />
          <span>
            너즐록
            <span className="block text-[12px] text-text-dim">기절한 카드는 보관함에서 영구히 사라진다</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-[14px]">
          <input type="checkbox" checked={challenges.randomStarter} onChange={() => toggle('randomStarter')} className="mt-1 h-4 w-4 accent-[#F2C14E]" />
          <span>
            랜덤 스타터
            <span className="block text-[12px] text-text-dim">스타터 팩 5장 중 무작위 1장을 받는다</span>
          </span>
        </label>
      </div>

      <div className="mt-auto flex items-center justify-between rounded-xl border border-[#F2795A]/50 bg-surface px-5 py-3">
        <p className="text-[14px] text-[#F2795A]">난이도와 챌린지는 시작한 뒤에 바꿀 수 없다.</p>
        <button
          type="button"
          onClick={() => onStart(difficulty, challenges)}
          autoFocus
          className="rounded-lg bg-accent px-8 py-2.5 text-[17px] font-bold text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {fixJosa(`${DIFFICULTY[difficulty].label}(으)로 시작한다`)}
        </button>
      </div>
    </div>
  );
}
