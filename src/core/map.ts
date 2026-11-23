// src/core/map.ts
// 챕터 지도 생성 (docs/spec.md §3.1~3.2). 같은 세이브 시드 + 챕터면 항상 같은 지도.
//   - 일반 챕터 10층, 사천왕 구간(9~12장)은 5층에 상점 없음
//   - 1층 2~3개, 중간층 2~4개, 관장 전 층은 전부 휴식, 마지막 층은 관장 하나
//   - 각 노드는 다음 층 1~2개와 연결, 선은 교차하지 않음
//   - 보상(지닌 도구 3개 중 1개) 1개 3층 이상, 사건(?) 2~3개 2층 이상 (사천왕 구간은 사건 1개)
import { createRng, type Rng } from './gacha';

export type NodeKind = 'wild' | 'trainer' | 'elite' | 'shop' | 'rest' | 'leader' | 'event' | 'treasure';

export interface MapNode {
  id: string;        // `${floor}-${index}`
  floor: number;     // 1부터
  index: number;     // 층 안에서 왼쪽부터 0
  x: number;         // 가로 위치 0~1
  kind: NodeKind;
  /** 엘리트 노드 중 라이벌전 (챕터에 라이벌전이 있을 때 하나) */
  rival?: boolean;
  next: string[];    // 다음 층에서 갈 수 있는 노드 id
}

export interface ChapterMap {
  chapter: number;
  floors: MapNode[][];
}

export const ELITE_FOUR_CHAPTERS = [9, 10, 11, 12];
const ELITE_MIN_FLOOR = 4;
const SHOP_MIN_FLOOR = 3;
const TREASURE_MIN_FLOOR = 3;
const EVENT_MIN_FLOOR = 2;

const pick = <T>(rng: Rng, list: T[]): T => list[Math.floor(rng() * list.length)];
const intBetween = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

/**
 * 아래층 a개 → 위층 b개를 교차 없이 잇는 모든 방법.
 * (0,0)에서 (a-1,b-1)까지 오른쪽으로만 가는 경로의 각 칸이 선 하나다.
 * 아래 노드 하나가 위로 뻗는 선은 최대 2개.
 */
function nonCrossingLinks(a: number, b: number): [number, number][][] {
  const out: [number, number][][] = [];
  const walk = (i: number, j: number, deg: number, path: [number, number][]) => {
    if (i === a - 1 && j === b - 1) return void out.push(path);
    if (i + 1 < a) walk(i + 1, j, 1, [...path, [i + 1, j]]);
    if (i + 1 < a && j + 1 < b) walk(i + 1, j + 1, 1, [...path, [i + 1, j + 1]]);
    if (j + 1 < b && deg < 2) walk(i, j + 1, deg + 1, [...path, [i, j + 1]]);
  };
  walk(0, 0, 1, [[0, 0]]);
  return out;
}

export function generateMap(seed: number, chapter: number, opts: { hasRival?: boolean } = {}): ChapterMap {
  const rng = createRng((seed + chapter * 0x9e3779b1) >>> 0);
  const short = ELITE_FOUR_CHAPTERS.includes(chapter);
  const total = short ? 5 : 10;

  // ── 층별 노드 수와 위치 ──
  const counts = Array.from({ length: total }, (_, f) => {
    const floor = f + 1;
    if (floor === total) return 1;
    if (floor === 1 || floor === total - 1) return intBetween(rng, 2, 3);
    return intBetween(rng, 2, 4);
  });
  const floors: MapNode[][] = counts.map((n, f) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${f + 1}-${i}`,
      floor: f + 1,
      index: i,
      x: (i + 1) / (n + 1) + (n > 1 ? (rng() - 0.5) * 0.06 : 0),
      kind: 'wild' as NodeKind,
      next: [],
    })),
  );

  // ── 연결 ──
  for (let f = 0; f < total - 1; f++) {
    const lower = floors[f];
    const upper = floors[f + 1];
    if (upper.length === 1) {
      for (const n of lower) n.next = [upper[0].id];
      continue;
    }
    for (const [i, j] of pick(rng, nonCrossingLinks(lower.length, upper.length))) lower[i].next.push(upper[j].id);
  }

  // ── 종류 배정 ──
  for (const n of floors[total - 1]) n.kind = 'leader';
  for (const n of floors[total - 2]) n.kind = 'rest';
  const free = floors.slice(0, total - 2).flat();
  for (const n of free) n.kind = rng() < 0.5 ? 'wild' : 'trainer';
  // 1층에는 야생을 반드시 하나: 스타터 한 마리로도 첫 전투를 이기고 팩을 받을 길을 보장한다
  if (!floors[0].some((n) => n.kind === 'wild')) pick(rng, floors[0]).kind = 'wild';

  /** 조건에 맞는 아직 일반(야생·트레이너) 노드 하나를 골라 종류를 바꾼다. 이미 쓴 층은 피한다 */
  const usedFloors = new Set<number>();
  const assign = (kind: NodeKind, minFloor: number, maxFloor: number): MapNode | null => {
    const ok = free.filter((n) => n.floor >= minFloor && n.floor <= maxFloor && (n.kind === 'wild' || n.kind === 'trainer'));
    const fresh = ok.filter((n) => !usedFloors.has(n.floor));
    const list = fresh.length ? fresh : ok;
    if (!list.length) return null;
    const node = pick(rng, list);
    node.kind = kind;
    usedFloors.add(node.floor);
    return node;
  };

  const lastFree = total - 2;
  const elites = short ? 0 : 2;
  for (let i = 0; i < elites; i++) {
    const node = assign('elite', ELITE_MIN_FLOOR, lastFree);
    if (node && i === 0 && opts.hasRival) node.rival = true;
  }
  const shops = short ? 0 : intBetween(rng, 1, 2);
  for (let i = 0; i < shops; i++) assign('shop', SHOP_MIN_FLOOR, lastFree);
  // 중간 휴식 0~1개. 관장 전 휴식 층 바로 아래는 피해 휴식이 연달아 나오지 않게 한다
  if (!short && rng() < 0.5) assign('rest', ELITE_MIN_FLOOR, lastFree - 1);
  // 보상·사건은 나중에 추가해서 맨 뒤에 배정한다 (앞의 배치에 쓰는 난수 순서를 바꾸지 않는다)
  assign('treasure', TREASURE_MIN_FLOOR, lastFree);
  const events = short ? 1 : intBetween(rng, 2, 3);
  for (let i = 0; i < events; i++) assign('event', EVENT_MIN_FLOOR, lastFree);

  return { chapter, floors };
}

export function findNode(map: ChapterMap, id: string): MapNode | undefined {
  return map.floors.flat().find((n) => n.id === id);
}

/** 지금 갈 수 있는 노드 id. 출발 전(current = null)이면 1층 전부 */
export function reachableNodes(map: ChapterMap, current: string | null): string[] {
  if (current === null) return map.floors[0].map((n) => n.id);
  return findNode(map, current)?.next ?? [];
}
