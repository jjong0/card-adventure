// 전투 승리 정산: 골드, 카드별 경험치·레벨업·새 기술, 진화 확인 (spec §4.4~4.6, §5.2-5)
import { Sprite } from '../../components/Sprite';
import type { Opponent } from '../../core/encounter';
import { dex } from '../../lib/dex';
import type { BattleSettlement } from '../../store/gameStore';
import { EvolutionPrompt } from './EvolutionPrompt';

interface Props {
  opponent: Opponent;
  settlement: BattleSettlement;
  onNext: () => void;
}

export function BattleResultScreen({ opponent, settlement, onNext }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-8">
      <div className="text-center">
        <h2 className="font-title text-[40px] text-accent">승리!</h2>
        <p className="font-pixel text-[15px] text-text-dim">
          {opponent.name}에게 이겼다 · <span className="text-accent">+{settlement.gold.toLocaleString()}G</span>
        </p>
      </div>
      <ul className="max-h-[400px] w-[640px] space-y-2 overflow-y-auto pr-1">
        {settlement.growth.map(({ exp, result }) => {
          const { card, fromLevel, toLevel, newMoves } = result;
          return (
            <li key={card.uid} className="rounded-xl border border-line bg-surface p-3 font-pixel">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden">
                  <Sprite speciesId={card.speciesId} name={dex.species[card.speciesId].name} still scale={1.1} className="max-w-none shrink-0" />
                </div>
                <span className="text-[15px] font-bold">{dex.species[card.speciesId].name}</span>
                <span className="text-[13px] text-text-dim">경험치 +{exp}</span>
                {toLevel > fromLevel && <span className="ml-auto text-[14px] font-bold text-[#5CC98B]">Lv{fromLevel} → Lv{toLevel}</span>}
              </div>
              {newMoves.length > 0 && (
                <p className="mt-1.5 text-[13px]">
                  새 기술 <span className="text-accent">{newMoves.map((id) => dex.moves[id]?.name ?? id).join(', ')}</span>
                  <span className="text-text-dim"> (빈 칸이 있으면 자동 장착, 나머지는 카드 상세에서)</span>
                </p>
              )}
              {toLevel > fromLevel && <div className="mt-2"><EvolutionPrompt uid={card.uid} /></div>}
            </li>
          );
        })}
        {!settlement.growth.length && <li className="text-center font-pixel text-[14px] text-text-dim">경험치를 받은 포켓몬이 없다.</li>}
      </ul>
      <button type="button" onClick={onNext} autoFocus className="rounded-lg bg-accent px-8 py-2.5 font-pixel text-[17px] font-bold text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        보상 팩 고르기
      </button>
    </div>
  );
}
