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
  /** 접촉 기술 (울퉁불퉁멧 반동 판정) */
  contact: boolean;
  effectChance: number | null;
  meta: MoveMeta | null;
  description: string;
  /** 'ko' 공식 | 'ko-unofficial' 직접 번역(overrides/move-desc-ko.json) | 'en' 영어 대체 */
  descriptionLang: 'ko' | 'ko-unofficial' | 'en' | null;
}

/**
 * evolutions.json: 진화 전 speciesId → 진화 목록 (scripts/build-evolutions.mjs, spec §4.6)
 * substitute = 교환·친밀도·기타 조건을 대체 레벨로 바꾼 진화
 */
export type Evolution =
  | { to: string; method: 'level'; level: number }
  | { to: string; method: 'item'; item: string; itemName: string }
  | { to: string; method: 'substitute'; level: number; reason: 'trade' | 'friendship' | 'other' | 'override' };
export type Evolutions = Record<string, Evolution[]>;

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
  facedBy: number[];                          // 이 포켓몬과 마주한 상대 파티 idx (경험치 분배용)
  item: string | null;                        // 지금 지닌 도구 (열매·기합의띠는 쓰면 null)
  choiceLock: string | null;                  // 구애 도구로 고정된 기술 (교체하면 풀림)
}

export type Side = 'player' | 'enemy';

export interface BattleSide {
  party: BattleMon[];
  activeIdx: number;
}

export interface BattleState {
  turn: number;
  seed: number;
  /** 야생전: 등장 문구가 다르고, 경험치 배율이 1 */
  wild: boolean;
  /** 상대가 기술을 무작위로 고른다 (야생, 쉬움 난이도) */
  randomAi: boolean;
  /** 플레이어가 가방 약을 쓸 수 있다 (익스트림 관장전은 불가) */
  itemsAllowed: boolean;
  /** 이번 전투에서 쓴 약 id (누적). 전투가 끝나면 가방에서 뺀다 */
  itemsUsed: string[];
  player: BattleSide;
  enemy: BattleSide;
  log: string[];
  /** 마지막 battle()/createBattle() 호출에서 생긴 연출 이벤트 (호출마다 새로 채움, 누적 아님) */
  events: BattleEvent[];
  /** 쓰러뜨린 상대와, 그 시점에 살아 있던 함께 싸운 아군 파티 idx (전투 후 경험치 분배, 누적) */
  knockouts: { enemyIdx: number; participants: number[] }[];
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
  /** idx가 있으면 교체 대기 중인 포켓몬(가방 약), 없으면 출전 중인 포켓몬 */
  | { type: 'heal'; side: Side; from: number; to: number; idx?: number }
  | { type: 'status'; side: Side; ailment: Ailment }
  | { type: 'stage'; side: Side; stat: BattleStat; delta: number }
  | { type: 'faint'; side: Side }
  | { type: 'message'; text: string };

/** 전투 계산에 필요한 정적 데이터 묶음 */
export interface Dex {
  species: Record<string, Species>;
  moves: Record<string, Move>;
  typeChart: TypeChart;
  /** 진화의휘석 판정용 (없으면 진화 전으로 보지 않음) */
  evolutions?: Evolutions;
  /** 지닌 도구 이름 (전투 문구용, 없으면 slug) */
  items?: Record<string, { name: string }>;
}

/** 지닌 도구 등급: 보상 노드에서 나오는 확률이 다르다 */
export type HeldItemTier = 'common' | 'uncommon' | 'rare';

export type BattleAction =
  | { kind: 'move'; moveId: string }
  | { kind: 'switch'; toIdx: number }
  /** 가방 약 사용 (플레이어만). PP 회복약 중 기술 1개용은 moveId가 필요하다 */
  | { kind: 'item'; itemId: string; targetIdx: number; moveId?: string };

// ── 트레이너 · 챕터 · 기술머신 데이터 ─────────
/** trainers.json (scripts/build-trainers.mjs, 하트골드 원본) */
export interface TrainerMon {
  speciesId: string;
  level: number;
  iv: number;                         // 전 스탯 동일 (difficulty × 31 / 255)
  item: { slug: string; name: string } | null;
  moves: string[];                    // 비어 있으면 원작처럼 레벨업 기본 기술
}

export interface Trainer {
  index: number;                      // 원본 트레이너 번호
  key: string;
  class: string;                      // 직업 (assets.json trainerClasses 키)
  name: string;                       // 표시 이름 (일반 트레이너는 직업 이름)
  nameEn: string;
  role: 'gym' | 'elite4' | 'champion' | 'final' | 'rival' | 'trainer';
  battle: 'story' | 'rematch';
  chapter: number | null;             // 관장 등 스토리 보스만
  aiFlags: number;
  double: boolean;                    // 원작 더블배틀 (이 게임은 싱글로 진행)
  bagItems: { slug: string; name: string }[];
  party: TrainerMon[];
}

/** chapters.json (scripts/build-chapters.mjs + overrides/chapters.json) */
export interface ChapterData {
  chapter: number;
  place: string;
  /** 관장 주 타입. null = 여러 타입 (그린·레드) */
  type: ElementType | null;
  leader: { key: string; name: string; trainerIndex: number; aceLevel: number };
  areas: string[];                    // PokeAPI 지역 식별자
  wild: { speciesId: string; minLevel: number; maxLevel: number; weight: number }[]; // weight: %
  packLevel: number;
  trainerLevel: { above: number; upTo: number }; // 파티 최고 레벨 (above, upTo]
  trainers: number[];                 // 일반 트레이너 원본 번호
  /** 플레이어 스타터 타입 → 라이벌전 원본 번호. 이 챕터에 라이벌전이 없으면 null */
  rivals: Record<'grass' | 'fire' | 'water', number> | null;
  /** 관장을 이기면 받는 기술머신. 사천왕·챔피언·레드는 원작처럼 없음(null) */
  rewardTm: { id: string; name: string; moveId: string } | null;
}

/** tmCompat.json (scripts/build-tm-compat.mjs) */
export interface TmData {
  machines: { id: string; name: string; moveId: string }[]; // 하트골드 TM01~92, HM01~08
  compat: Record<string, string[]>;   // speciesId → 배울 수 있는 기술머신의 moveId
}

// ── 진행 · 저장 ─────────────────────────────
export type Difficulty = 'easy' | 'normal' | 'hard' | 'extreme';

/** 세이브 슬롯 1개 = JSON 1개 (localStorage + 파일 내보내기/불러오기). 검사·마이그레이션은 core/save.ts */
export interface SaveData {
  version: number;
  createdAt: string;
  updatedAt: string;
  difficulty: Difficulty;           // 시작 시 고정
  challenges: { nuzlocke: boolean; randomStarter: boolean };
  /** 세이브 고정 시드: 지도와 노드 상대를 정한다 */
  runSeed: number;
  /** 굴릴 때마다 바뀌는 시드: 팩·전투 난수 */
  seed: number;
  chapter: number;                  // 1~22
  /** 준비된 챕터를 모두 끝냄 */
  finished: boolean;
  /** 마지막으로 끝낸 노드. 진행 중이던 노드는 저장하지 않는다(다시 들어가게) */
  mapNodeId: string | null;
  visitedNodes: string[];
  gold: number;
  badges: string[];
  collection: Card[];               // 보관함 (계열당 1장)
  party: string[];                  // Card.uid 최대 6
  starterType: 'grass' | 'fire' | 'water';
  /** 스타터 팩에서 고를 5장 (고르기 전에 닫아도 같은 5장) */
  starterChoices: Card[] | null;
  /** 현재 HP (Card.uid → HP, 없는 카드는 가득) */
  hp: Record<string, number>;
  /** 남은 PP (Card.uid → 기술 id → PP, 없으면 가득). 이 필드가 생기기 전 세이브에는 없다 */
  pp?: Record<string, Record<string, number>>;
  bag: Record<string, number>;      // 아이템 slug → 개수
  tms: string[];                    // 보유 기술머신 (move id)
  /** 이기고 아직 열지 않은 보상 팩 (불러오면 팩 화면부터) */
  pendingReward: 'wild' | 'trainer' | 'elite' | 'leader' | null;
  /** 열지 않은 보상 팩의 카드 레벨 (없으면 챕터 기본값) */
  pendingRewardLevel?: number | null;
  /** 관장을 이기고 아직 다음 챕터로 넘어가지 않음 (불러오면 클리어 화면부터) */
  pendingClear: boolean;
  playTimeSec: number;
}
