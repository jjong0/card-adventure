// 챕터 지도 (spec §8 화면 3): 왼쪽 갈림길 지도(아래 → 위), 오른쪽 선택한 노드 정보·파티·범례
import { useMemo, useState } from 'react';
import { HpBar } from '../../components/HpBar';
import { Sprite } from '../../components/Sprite';
import { bossTitle, givesBadge, nodeOpponent, type Opponent } from '../../core/encounter';
import { reachableNodes, type MapNode } from '../../core/map';
import { useAssetImage } from '../../lib/assetImage';
import { dex, trainers } from '../../lib/dex';
import { TYPE_LABEL } from '../../lib/labels';
import { currentHp, useGameStore } from '../../store/gameStore';
import { NODE_INFO, nodeImages } from './nodeInfo';

const W = 800;
const H = 648;
const PAD_Y = 56;

/** 노드 원 안에서 이미지가 차지하는 비율 */
const ICON_RATIO = 0.78;

function NodeIcon({ srcs, glyph, size }: { srcs: string[]; glyph: string; size: number }) {
  const src = useAssetImage(srcs);
  const [pixel, setPixel] = useState(true);
  // 자르지 않고 원 안에 온전히 넣는다. 작은 도트를 키울 때만 픽셀 그대로(pixelated),
  // 큰 일러스트를 줄일 때는 부드럽게 (pixelated로 줄이면 가장자리가 들쭉날쭉해진다)
  if (src) {
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        onLoad={(e) => setPixel(e.currentTarget.naturalWidth < size * ICON_RATIO)}
        className="object-contain"
        style={{ width: `${ICON_RATIO * 100}%`, height: `${ICON_RATIO * 100}%`, imageRendering: pixel ? 'pixelated' : 'auto' }}
      />
    );
  }
  return <span className="font-pixel font-bold" style={{ fontSize: size * 0.4 }}>{glyph}</span>;
}

interface Props {
  /** 선택한 노드로 이동한 뒤 (전투·상점·휴식 화면으로 넘어간다) */
  onEnter: (node: MapNode, opponent: Opponent | null) => void;
  onOpenBox: () => void;
  onOpenBag: () => void;
  onExit: () => void;
  /** 방금 일어난 일 안내 (패배 후 재시작, 도망 등). 노드를 고르기 전까지 정보 칸에 보인다 */
  notice?: string;
}

export function MapScreen({ onEnter, onOpenBox, onOpenBag, onExit, notice }: Props) {
  const { map, chapterData, mapNodeId, visitedNodes, runSeed, starterType, difficulty, gold, badges, hp, partyCards, moveTo } = useGameStore();
  const chapter = chapterData();
  // 마지막 노드 보상: 배지는 체육관 관장만, 기술머신은 주는 챕터만
  // 마지막 상대가 있는 곳: 체육관 / 포켓몬리그(사천왕·챔피언) / 레드는 장소 이름만
  const title = bossTitle(chapter.chapter);
  const venue = title === '관장' ? `${chapter.place} 체육관` : title ? `${chapter.place} 포켓몬리그` : chapter.place;
  const leaderDesc = title === '관장' ? '체육관 관장에게 도전한다.' : title ? `${title}에게 도전한다.` : '은빛산 정상에서 기다리는 트레이너에게 도전한다.';
  const leaderReward = [givesBadge(chapter.chapter) && '배지', 'SR 이상 확정 팩', chapter.rewardTm && '기술머신'].filter(Boolean).join(' + ');
  const m = map();
  const party = partyCards();
  const reachable = reachableNodes(m, mapNodeId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const nodes = m.floors.flat();
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const opponents = useMemo(
    () => new Map(nodes.map((n) => [n.id, nodeOpponent(n, { totalFloors: m.floors.length, chapter, trainers, starterType, difficulty, seed: runSeed }, dex)])),
    // nodes는 m에서 나오므로 m만 본다: 지도(시드·챕터)와 스타터 타입이 같으면 상대도 같다
    [m, chapter, starterType, difficulty, runSeed],
  );

  const step = (H - PAD_Y * 2) / (m.floors.length - 1);
  const pos = (n: MapNode) => ({ x: n.x * W, y: H - PAD_Y - (n.floor - 1) * step });
  const visited = new Set(visitedNodes);
  const canFight = party.some((c) => currentHp(c, hp) > 0);
  const selectedOpp = selected ? opponents.get(selected.id) ?? null : null;
  const needsFight = !!selectedOpp;

  const go = () => {
    if (!selected || !reachable.includes(selected.id)) return;
    if (moveTo(selected.id)) {
      setSelectedId(null);
      onEnter(selected, selectedOpp);
    }
  };

  const topBtn = 'rounded-md bg-surface px-3 py-1 font-pixel text-[13px] ring-1 ring-line hover:ring-accent focus-visible:outline-2 focus-visible:outline-accent';

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[56px] shrink-0 items-center gap-5 border-b border-line bg-surface-2 px-6 font-pixel">
        <span className="font-title text-[24px] text-accent">{chapter.chapter}장</span>
        <span className="text-[16px]">{venue}</span>
        <span className="text-[13px] text-text-dim">{bossTitle(chapter.chapter) || '최종 상대'} {chapter.leader.name} · {chapter.type ? `${TYPE_LABEL[chapter.type]} 타입` : '여러 타입'} · 에이스 Lv{chapter.leader.aceLevel}</span>
        <span className="ml-auto text-[14px] text-accent">{gold.toLocaleString()}G</span>
        <span className="text-[13px] text-text-dim">배지 {badges.length}</span>
        <button type="button" onClick={onOpenBox} className={topBtn}>보관함</button>
        <button type="button" onClick={onOpenBag} className={topBtn}>가방</button>
        <button type="button" onClick={onExit} className={topBtn} title="저장하고 타이틀로">타이틀로</button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_400px]">
        {/* 포켓기어 화면 같은 촘촘한 격자 (노드를 가리지 않는 바탕 무늬) */}
        <div
          className="relative flex items-center justify-center overflow-hidden"
          style={{
            backgroundColor: '#101A2A',
            backgroundImage: 'radial-gradient(ellipse at center, transparent 55%, rgba(15,23,36,0.85) 100%), linear-gradient(#1A2638 1px, transparent 1px), linear-gradient(90deg, #1A2638 1px, transparent 1px)',
            backgroundSize: '100% 100%, 20px 20px, 20px 20px',
          }}
        >
          <div className="relative" style={{ width: W, height: H }}>
            <svg width={W} height={H} className="absolute inset-0" aria-hidden>
              {nodes.flatMap((n) =>
                n.next.map((id) => {
                  const to = nodes.find((x) => x.id === id)!;
                  const a = pos(n);
                  const b = pos(to);
                  const walked = visited.has(n.id) && visited.has(id);
                  const open = n.id === mapNodeId && reachable.includes(id);
                  return (
                    <line
                      key={`${n.id}>${id}`}
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={walked ? '#F2C14E' : open ? '#E8EDF5' : '#2C3A52'}
                      strokeWidth={walked ? 4 : open ? 3 : 2}
                      strokeDasharray={walked || open ? undefined : '6 6'}
                    />
                  );
                }),
              )}
            </svg>
            {nodes.map((n) => {
              const info = NODE_INFO[n.kind];
              const p = pos(n);
              const size = n.kind === 'leader' ? 72 : 46;
              const isReach = reachable.includes(n.id);
              const isHere = n.id === mapNodeId;
              const done = visited.has(n.id) && !isHere;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelectedId(n.id)}
                  aria-label={`${n.floor}층 ${n.rival ? '라이벌' : info.label}${isReach ? ' (갈 수 있음)' : ''}`}
                  className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${isReach ? 'hover:scale-110' : ''} ${done ? 'opacity-45' : ''} ${!isReach && !isHere && !done ? 'opacity-75' : ''}`}
                  style={{
                    left: p.x, top: p.y, width: size, height: size, color: info.color,
                    border: `${n.kind === 'elite' ? 5 : 3}px solid ${info.color}`,
                    boxShadow: selectedId === n.id ? '0 0 0 3px #0F1724, 0 0 0 6px #F2C14E' : isReach ? `0 0 14px ${info.color}` : undefined,
                  }}
                >
                  <NodeIcon srcs={nodeImages(n, chapter)} glyph={n.rival ? '라' : info.glyph} size={size} />
                  {n.kind === 'elite' && <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#F2795A] font-pixel text-[13px] font-bold text-bg">!</span>}
                  {isHere && <span className="absolute -bottom-5 font-pixel text-[11px] text-accent">현재</span>}
                </button>
              );
            })}
            {mapNodeId === null && <p className="absolute bottom-1 left-1/2 -translate-x-1/2 font-pixel text-[12px] text-text-dim">출발 · 야생 포켓몬과의 승부로 시작한다</p>}
          </div>
        </div>

        <aside className="flex min-h-0 flex-col gap-3 border-l border-line bg-surface p-4 font-pixel">
          <section className="min-h-[196px] rounded-xl bg-surface-2 p-3.5">
            {selected ? (
              <>
                <p className="text-[12px] text-text-dim">{selected.floor}층</p>
                <h2 className="text-[20px] font-bold" style={{ color: NODE_INFO[selected.kind].color }}>
                  {selected.rival ? '라이벌' : selectedOpp && selected.kind !== 'wild' ? selectedOpp.name : NODE_INFO[selected.kind].label}
                </h2>
                <p className="mt-1 text-[13px] leading-5 text-text-dim">{selected.kind === 'leader' ? leaderDesc : NODE_INFO[selected.kind].desc}</p>
                {selectedOpp && selected.kind !== 'wild' && (
                  <p className="mt-1 text-[13px]">포켓몬 {selectedOpp.cards.length}마리 · 최고 Lv{Math.max(...selectedOpp.cards.map((c) => c.level))}</p>
                )}
                <p className="mt-1 text-[13px]"><span className="text-text-dim">보상 </span>{selected.kind === 'leader' ? leaderReward : NODE_INFO[selected.kind].reward}</p>
                <button
                  type="button"
                  onClick={go}
                  disabled={!reachable.includes(selected.id) || (needsFight && !canFight)}
                  className="mt-3 w-full rounded-lg bg-accent py-2 text-[16px] font-bold text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
                >
                  {!reachable.includes(selected.id) ? '지금은 갈 수 없다' : needsFight && !canFight ? '싸울 수 있는 포켓몬이 없다' : '여기로 간다'}
                </button>
              </>
            ) : (
              <div className="pt-10 text-center text-[14px] leading-6">
                {notice && <p className="mb-3 text-accent" role="status">{notice}</p>}
                <p className="text-text-dim">지도에서 노드를 고르세요.<br />빛나는 노드로 갈 수 있다.</p>
              </div>
            )}
          </section>

          <section aria-label="파티" className="min-h-0 flex-1 overflow-y-auto">
            <p className="mb-1.5 text-[12px] text-text-dim">파티</p>
            <ul className="space-y-1.5">
              {party.map((c) => {
                const sp = dex.species[c.speciesId];
                const max = currentHp(c, {});
                const now = currentHp(c, hp);
                return (
                  <li key={c.uid} className={`flex items-center gap-2 rounded-lg bg-surface-2 px-2 py-1 ${now <= 0 ? 'opacity-50' : ''}`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden">
                      <Sprite speciesId={c.speciesId} name={sp.name} still scale={0.95} className="max-w-none shrink-0" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between text-[12px]">
                        <span className="truncate font-bold">{sp.name} <span className="font-normal text-text-dim">Lv{c.level}</span></span>
                        <span className="tabular-nums text-text-dim">{now}/{max}</span>
                      </div>
                      <HpBar hp={now} max={max} className="mt-0.5 h-1.5" />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-label="범례" className="grid grid-cols-3 gap-x-2 gap-y-1 border-t border-line pt-2 text-[11px] text-text-dim">
            {Object.entries(NODE_INFO).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: v.color }} />
                {v.label}
              </span>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
