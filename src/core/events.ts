// src/core/events.ts
// 사건(?) 노드 (docs/spec.md §3.2). 짧은 이야기와 선택지 2~3개, 고른 선택지의 결과는 확률로 정해진다.
// 문구는 직접 쓴 것이다(원작 대사를 쓰지 않는다). 결과 적용(골드·HP·도구·전투)은 스토어가 한다.
import { createRng } from './gacha';
import { nodeSeed } from './encounter';
import type { HeldItemTier } from './types';
import type { ChapterMap, MapNode } from './map';

export type EventEffect =
  /** 골드 (챕터 번호를 곱한다) */
  | { kind: 'gold'; perChapter: number }
  /** 파티 전원 최대 HP 비율만큼 회복 (쓰러진 포켓몬 포함) */
  | { kind: 'heal'; ratio: number }
  /** 파티 전원 최대 HP 비율만큼 데미지 (HP 1 아래로는 내려가지 않는다) */
  | { kind: 'hurt'; ratio: number }
  /** 지닌 도구 1개 (그 등급에서 무작위) */
  | { kind: 'heldItem'; tier: HeldItemTier }
  /** 가방 도구 (회복약 등) */
  | { kind: 'bagItem'; id: string; count: number }
  /** 파티 전원 레벨 +n (레벨 캡까지) */
  | { kind: 'levels'; amount: number }
  /** 승부가 벌어진다. 이기면 그 종류 노드와 같은 보상 */
  | { kind: 'battle'; battle: 'wild' | 'trainer' };

export interface EventOutcome {
  /** 확률 가중치 */
  weight: number;
  text: string;
  effects: EventEffect[];
}

export interface EventChoice {
  label: string;
  /** 고르는 데 드는 골드 (챕터 번호를 곱한다). 모자라면 고를 수 없다 */
  goldPerChapter?: number;
  outcomes: EventOutcome[];
}

export interface MapEvent {
  id: string;
  title: string;
  text: string;
  choices: EventChoice[];
}

const nothing = (text: string): EventOutcome[] => [{ weight: 1, text, effects: [] }];

export const EVENTS: MapEvent[] = [
  {
    id: 'lost-traveler',
    title: '길 잃은 여행자',
    text: '지도를 거꾸로 든 여행자가 한숨을 쉬고 있다. 다음 마을로 가는 길을 모르는 모양이다.',
    choices: [
      {
        label: '길을 알려 준다',
        outcomes: [{ weight: 1, text: '여행자는 몇 번이나 고개를 숙이더니, 가방에서 도구 하나를 꺼내 건넸다.', effects: [{ kind: 'heldItem', tier: 'common' }] }],
      },
      { label: '못 본 척 지나간다', outcomes: nothing('괜히 마음이 무겁다. 아무 일도 없었다.') },
    ],
  },
  {
    id: 'rustling-grass',
    title: '흔들리는 풀숲',
    text: '바람도 없는데 풀숲 한쪽이 크게 흔들린다.',
    choices: [
      {
        label: '헤치고 들어간다',
        outcomes: [
          { weight: 3, text: '풀숲에서 포켓몬이 튀어나왔다!', effects: [{ kind: 'battle', battle: 'wild' }] },
          { weight: 2, text: '풀숲 안쪽에 누군가 떨어뜨린 도구가 있었다.', effects: [{ kind: 'heldItem', tier: 'common' }] },
        ],
      },
      { label: '돌아서 간다', outcomes: nothing('멀리 돌아가느라 시간이 걸렸지만 무사히 지나갔다.') },
    ],
  },
  {
    id: 'toll-thug',
    title: '통행료를 요구하는 남자',
    text: '검은 모자를 눌러쓴 남자가 다리 앞을 막아섰다. "여기를 지나가려면 통행료를 내야지."',
    choices: [
      { label: '승부로 비키게 한다', outcomes: [{ weight: 1, text: '남자가 혀를 차며 몬스터볼을 꺼냈다!', effects: [{ kind: 'battle', battle: 'trainer' }] }] },
      { label: '통행료를 낸다', goldPerChapter: 300, outcomes: nothing('남자는 돈을 세어 보더니 순순히 길을 비켜 주었다.') },
      { label: '뒷길로 빠져나간다', outcomes: [{ weight: 1, text: '가시덤불 사이로 빠져나오느라 파티가 조금 다쳤다.', effects: [{ kind: 'hurt', ratio: 0.15 }] }] },
    ],
  },
  {
    id: 'hot-spring',
    title: '산속 온천',
    text: '바위 틈에서 김이 피어오르는 작은 온천을 발견했다.',
    choices: [
      { label: '다 같이 쉬어 간다', outcomes: [{ weight: 1, text: '따뜻한 물에 몸을 담그자 피로가 풀렸다.', effects: [{ kind: 'heal', ratio: 0.5 }] }] },
      { label: '물을 병에 담아 간다', outcomes: [{ weight: 1, text: '온천물을 병 두 개에 가득 담았다. 상처에 바르면 잘 들을 것 같다.', effects: [{ kind: 'bagItem', id: 'super-potion', count: 2 }] }] },
    ],
  },
  {
    id: 'sparring',
    title: '수련하는 트레이너',
    text: '폭포 앞에서 수련하던 트레이너가 손짓한다. "같이 단련해 보지 않을래? 꽤 힘들 거야."',
    choices: [
      {
        label: '함께 단련한다',
        outcomes: [{ weight: 1, text: '혹독한 훈련이었다. 파티가 지쳤지만 한층 강해졌다.', effects: [{ kind: 'hurt', ratio: 0.3 }, { kind: 'levels', amount: 1 }] }],
      },
      { label: '사양한다', outcomes: nothing('트레이너는 아쉬운 얼굴로 다시 폭포를 향해 섰다.') },
    ],
  },
  {
    id: 'shiny-thing',
    title: '반짝이는 것',
    text: '길가 수풀 아래에서 무언가 반짝인다.',
    choices: [
      {
        label: '주워 본다',
        outcomes: [
          { weight: 3, text: '누군가 떨어뜨린 도구였다. 주인은 보이지 않는다.', effects: [{ kind: 'heldItem', tier: 'common' }] },
          { weight: 1, text: '꽤 값나가 보이는 도구였다!', effects: [{ kind: 'heldItem', tier: 'uncommon' }] },
        ],
      },
      { label: '그냥 둔다', outcomes: nothing('반짝임은 금세 수풀 속으로 사라졌다.') },
    ],
  },
  {
    id: 'peddler',
    title: '떠돌이 상인',
    text: '커다란 보따리를 멘 상인이 길가에 물건을 펼쳤다. "오늘만 이 값이에요."',
    choices: [
      { label: '하나 산다', goldPerChapter: 400, outcomes: [{ weight: 1, text: '상인이 보따리 깊숙한 곳에서 도구 하나를 골라 건넸다.', effects: [{ kind: 'heldItem', tier: 'uncommon' }] }] },
      { label: '구경만 한다', outcomes: nothing('상인은 어깨를 으쓱하고 보따리를 다시 쌌다.') },
    ],
  },
  {
    id: 'heavy-load',
    title: '무거운 짐',
    text: '커다란 짐을 진 할아버지가 언덕 아래에서 숨을 고르고 있다.',
    choices: [
      {
        label: '짐을 들어 드린다',
        outcomes: [{ weight: 1, text: '언덕 위 집까지 짐을 옮겨 드렸다. 할아버지가 용돈이라며 지폐를 쥐여 주었다.', effects: [{ kind: 'gold', perChapter: 300 }] }],
      },
      { label: '인사만 하고 간다', outcomes: nothing('할아버지는 손을 흔들어 주었다.') },
    ],
  },
];

export function choiceCost(choice: EventChoice, chapter: number): number {
  return (choice.goldPerChapter ?? 0) * chapter;
}

/**
 * 이 사건 노드에서 일어나는 사건. 챕터 안의 사건 노드끼리는 겹치지 않는다
 * (챕터 시드로 사건 목록을 섞고, 사건 노드를 아래층부터 차례로 배정).
 */
export function eventForNode(map: ChapterMap, node: MapNode, seed: number): MapEvent {
  const rng = createRng(nodeSeed(seed, map.chapter, { floor: 0, index: 0 }));
  const order = EVENTS.map((e) => ({ e, k: rng() })).sort((a, b) => a.k - b.k).map((x) => x.e);
  const eventNodes = map.floors.flat().filter((n) => n.kind === 'event');
  const i = Math.max(0, eventNodes.findIndex((n) => n.id === node.id));
  return order[i % order.length];
}

/** 선택지 결과 뽑기 */
export function resolveChoice(choice: EventChoice, rng: () => number): EventOutcome {
  const total = choice.outcomes.reduce((a, o) => a + o.weight, 0);
  let r = rng() * total;
  for (const o of choice.outcomes) {
    r -= o.weight;
    if (r < 0) return o;
  }
  return choice.outcomes[choice.outcomes.length - 1];
}
