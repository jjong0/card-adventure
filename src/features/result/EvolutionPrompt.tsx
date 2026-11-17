// 진화 확인: 지금 레벨로 가능한 진화를 보여주고 고르게 한다. 갈래가 여럿이면 모두, 그만둘 수도 있다 (원작처럼)
import { useState } from 'react';
import { Sprite } from '../../components/Sprite';
import { fixJosa } from '../../core/battle';
import { levelEvolutions } from '../../core/progress';
import { dex } from '../../lib/dex';
import { useGameStore } from '../../store/gameStore';

export function EvolutionPrompt({ uid }: { uid: string }) {
  const { collection, evolveCard } = useGameStore();
  const card = collection.find((c) => c.uid === uid);
  const [declined, setDeclined] = useState(false);
  const [evolvedFrom, setEvolvedFrom] = useState<string | null>(null);
  if (!card) return null;
  const name = dex.species[card.speciesId].name;

  if (evolvedFrom) {
    return (
      <p className="rounded-lg bg-surface-2 px-3 py-2 font-pixel text-[14px] text-accent">
        {fixJosa(`축하합니다! ${evolvedFrom}은(는) ${name}(으)로 진화했다!`)}
      </p>
    );
  }
  const options = levelEvolutions(card, dex);
  if (!options.length || declined) return null;

  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2 font-pixel">
      <p className="text-[14px]">{fixJosa(`${name}이(가) 진화하려 한다!`)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {options.map((e) => (
          <button
            key={e.to}
            type="button"
            onClick={() => evolveCard(uid, e.to) && setEvolvedFrom(name)}
            className="flex items-center gap-1.5 rounded-lg bg-accent py-1 pl-1 pr-3 text-[13px] font-bold text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden">
              <Sprite speciesId={e.to} name={dex.species[e.to].name} still scale={0.8} className="max-w-none shrink-0" />
            </span>
            {fixJosa(`${dex.species[e.to].name}(으)로 진화`)}
          </button>
        ))}
        <button type="button" onClick={() => setDeclined(true)} className="rounded-lg px-3 py-1.5 text-[13px] text-text-dim ring-1 ring-line hover:text-text">
          그만둔다
        </button>
      </div>
    </div>
  );
}
