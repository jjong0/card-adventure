// src/core/types.ts
// 정적 데이터는 src/data/*.json (scripts/build-data.mjs로 생성)

export type ElementType =
  | 'normal' | 'fighting' | 'flying' | 'poison' | 'ground' | 'rock'
  | 'bug' | 'ghost' | 'steel' | 'fire' | 'water' | 'grass'
  | 'electric' | 'psychic' | 'ice' | 'dragon' | 'dark' | 'fairy';

export type Rarity = 'N' | 'R' | 'SR' | 'UR';

/** 원작 6스탯 */
export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  spd: number;
}

export type BattleStat = Exclude<keyof Stats, 'hp'> | 'accuracy' | 'evasion';

/** 종족 (species.json) */
export interface Species {
  id: string;
  name: string;
  slug: string;
  generation: number;
  types: ElementType[];
  weight: number;           // kg (안다리걸기·헤비봄버 등 계산용)
  baseStats: Stats;
  bst: number;
  baseExp: number;          // 쓰러뜨렸을 때 기초 경험치
  growthRate: string;       // expTable.json 키 (medium-slow 등)
  rarity: Rarity;
  evolvesFrom: string | null;
  sprite: string;
}

/** typeChart.json: typeChart[공격][방어] = 0 | 0.5 | 1 | 2 */
export type TypeChart = Record<ElementType, Record<ElementType, number>>;

export type MoveCategory = 'physical' | 'special' | 'status';

export type MetaCategory =
  | 'damage' | 'ailment' | 'net-good-stats' | 'heal' | 'damage-ailment' | 'swagger'
  | 'damage-lower' | 'damage-raise' | 'damage-heal' | 'ohko'
  | 'whole-field-effect' | 'field-effect' | 'force-switch' | 'unique';

export interface MoveMeta {
  category: MetaCategory;
  ailment: string;          // 'none' | 'paralysis' | 'sleep' | 'freeze' | 'burn' | 'poison' | 'confusion' ...
  ailmentChance: number;    // % (0 = 상태기술이면 100% 적용)
  minHits: number | null;   // 연속기
  maxHits: number | null;
  minTurns: number | null;
  maxTurns: number | null;
  drain: number;            // % 흡수 (음수 = 반동)
  healing: number;          // % 최대 HP 회복
  critRate: number;         // 급소 랭크 보정
  flinchChance: number;     // % 풀죽음
  statChance: number;       // % 능력치 변화 (0 = 항상)
  statChanges: { stat: BattleStat; change: number }[];
}

/** 기술 (moves.json) */
export interface Move {
  id: string;
  name: string;
  slug: string;
  type: ElementType;
  category: MoveCategory;
  power: number | null;
  variablePower: boolean;   // true면 effectId로 위력 계산 (자이로볼, 지구던지기 등)
  accuracy: number | null;  // null = 반드시 명중
  pp: number;
  priority: number;
  target: string;
  effectId: number | null;
  effectChance: number | null;
  meta: MoveMeta | null;
  description: string;
  /** 'ko' 공식 | 'ko-unofficial' 직접 번역(overrides/move-desc-ko.json) | 'en' 영어 대체 */
  descriptionLang: 'ko' | 'ko-unofficial' | 'en' | null;
}

/** learnsets.json: speciesId → 레벨업 기술 (level 0 = 진화 시 습득) */
export type Learnsets = Record<string, { moveId: string; level: number; fallback?: boolean }[]>;

/**
 * 카드 = 보유 포켓몬 1마리. 같은 진화 계열(lineId)은 보관함에 1장만 존재하고
 * 중복은 자동으로 합쳐져 ★등급이 오른다 (docs/spec.md §4).
 */
export interface Card {
  uid: string;
  speciesId: string;      // 현재 종 (진화하면 바뀜)
  lineId: string;         // 진화 계열의 최초 종 id (합치기 기준)
  level: number;
  exp: number;
  star: 1 | 2 | 3 | 4 | 5;
  dupProgress: number;    // 현재 ★에서 다음 ★까지 모은 중복 수
  ivBase: Stats;          // 획득 시 랜덤 개체값 (0~31)
  ivAlloc: Stats;         // 사용자가 포인트로 올린 값
  ivPoints: number;       // 아직 안 찍은 포인트
  learnedMoves: string[]; // 배운 기술 전체 (레벨업·기술머신·합친 카드)
  moves: string[];        // 장착한 기술 최대 4개 (learnedMoves의 부분집합)
  heldItem: string | null;
}

export type PackKind = 'type' | 'starter';

export interface PackDef {
  kind: PackKind;
  cardsPerPack: number;           // 5
  typeFilter?: ElementType;       // 속성 팩
  minRarity?: Rarity;             // 엘리트 R 이상, 관장 SR 이상
  level: number;                  // 나오는 카드 레벨 (챕터 기준)
}

// ── 전투 ───────────────────────────────────
export type Ailment = 'none' | 'paralysis' | 'sleep' | 'freeze' | 'burn' | 'poison' | 'toxic';

export interface BattleMon {
  card: Card;
  name: string;
  types: ElementType[];
  weight: number;
  stats: Stats;                               // 레벨/개체값 반영 실능력치
  currentHp: number;
  pp: Record<string, number>;
  ailment: Ailment;
  sleepTurns: number;                         // 잠듦 남은 턴
  toxicCounter: number;                       // 맹독 누적 (n/16)
  confusedTurns: number;                      // 혼란 남은 턴
  flinched: boolean;                          // 이번 턴 풀죽음
  stages: Record<BattleStat, number>;         // 랭크 -6~+6
  lastHit: { damage: number; category: MoveCategory } | null; // 이번 턴 받은 공격 (카운터류)
}

export type Side = 'player' | 'enemy';

export interface BattleSide {
  party: BattleMon[];
  activeIdx: number;
}

export interface BattleState {
  turn: number;
  seed: number;
  player: BattleSide;
  enemy: BattleSide;
  log: string[];
  /** 마지막 battle()/createBattle() 호출에서 생긴 연출 이벤트 (호출마다 새로 채움, 누적 아님) */
  events: BattleEvent[];
  /** 플레이어 포켓몬이 쓰러져 교체를 골라야 하는 상태 */
  pendingSwitch: boolean;
  result: 'ongoing' | 'win' | 'lose';
}

/**
 * UI가 하나씩 재생하는 전투 연출 단위. 발생 순서대로 들어있고,
 * message 이벤트의 text를 이어 붙이면 이번 호출에서 늘어난 log와 같다.
 * status의 ailment 'none'은 상태이상이 풀렸다는 뜻.
 */
export type BattleEvent =
  | { type: 'switchIn'; side: Side; idx: number }
  | { type: 'move'; side: Side; moveId: string }
  | { type: 'damage'; side: Side; from: number; to: number; effectiveness: number; crit: boolean }
  | { type: 'heal'; side: Side; from: number; to: number }
  | { type: 'status'; side: Side; ailment: Ailment }
  | { type: 'stage'; side: Side; stat: BattleStat; delta: number }
  | { type: 'faint'; side: Side }
  | { type: 'message'; text: string };

/** 전투 계산에 필요한 정적 데이터 묶음 */
export interface Dex {
  species: Record<string, Species>;
  moves: Record<string, Move>;
  typeChart: TypeChart;
}

export type BattleAction =
  | { kind: 'move'; moveId: string }
  | { kind: 'switch'; toIdx: number };

// ── 진행 · 저장 ─────────────────────────────
export type Difficulty = 'easy' | 'normal' | 'hard' | 'extreme';

/** 세이브 슬롯 1개 = JSON 1개 (localStorage + 파일 내보내기/불러오기) */
export interface SaveData {
  version: number;
  createdAt: string;
  difficulty: Difficulty;           // 시작 시 고정
  challenges: { nuzlocke: boolean; randomStarter: boolean };
  seed: number;
  chapter: number;                  // 1~22
  mapNodeId: string | null;         // 현재 지도 위치
  visitedNodes: string[];
  gold: number;
  badges: string[];
  collection: Card[];               // 보관함 (계열당 1장)
  party: string[];                  // Card.uid 최대 6
  bag: Record<string, number>;      // 아이템 slug → 개수
  tms: string[];                    // 보유 기술머신 (move id)
  playTimeSec: number;
}
