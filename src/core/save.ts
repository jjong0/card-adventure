// src/core/save.ts
// 세이브 데이터 검사·마이그레이션·요약 (docs/spec.md §7). 저장소 접근은 store/saveRepository.ts.
import { DIFFICULTIES, DIFFICULTY } from './difficulty';
import type { Card, SaveData } from './types';

export const SAVE_VERSION = 1;
export const SLOT_COUNT = 3;

export type LoadError = 'not-json' | 'not-a-save' | 'newer-version' | 'broken';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isNumRecord = (v: unknown) => isObj(v) && Object.values(v).every(isNum);

const STAT_KEYS = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'spd'];
const isStats = (v: unknown) => isObj(v) && STAT_KEYS.every((k) => isNum(v[k]));

function isCard(v: unknown): v is Card {
  return (
    isObj(v) &&
    typeof v.uid === 'string' &&
    typeof v.speciesId === 'string' &&
    typeof v.lineId === 'string' &&
    isNum(v.level) &&
    isNum(v.exp) &&
    [1, 2, 3, 4, 5].includes(v.star as number) &&
    isNum(v.dupProgress) &&
    isStats(v.ivBase) &&
    isStats(v.ivAlloc) &&
    isNum(v.ivPoints) &&
    isStrArr(v.learnedMoves) &&
    isStrArr(v.moves) &&
    (v.heldItem === null || typeof v.heldItem === 'string')
  );
}

/** 이전 버전 세이브를 현재 형식으로. 버전이 생기면 여기에 단계별로 추가한다 */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  // v1이 첫 버전이라 아직 바꿀 것이 없다
  return raw;
}

/** 저장된 JSON 문자열(또는 파싱된 값)을 검사해 SaveData로. 불러오기·파일 가져오기 공용 */
export function parseSave(input: string | unknown): SaveData | LoadError {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return 'not-json';
    }
  }
  if (!isObj(raw) || !isNum(raw.version) || !Array.isArray(raw.collection)) return 'not-a-save';
  if (raw.version > SAVE_VERSION) return 'newer-version';
  const s = migrate(raw);

  const ok =
    typeof s.createdAt === 'string' &&
    typeof s.updatedAt === 'string' &&
    DIFFICULTIES.includes(s.difficulty as SaveData['difficulty']) &&
    isObj(s.challenges) &&
    typeof s.challenges.nuzlocke === 'boolean' &&
    typeof s.challenges.randomStarter === 'boolean' &&
    isNum(s.runSeed) &&
    isNum(s.seed) &&
    isNum(s.chapter) &&
    typeof s.finished === 'boolean' &&
    (s.mapNodeId === null || typeof s.mapNodeId === 'string') &&
    isStrArr(s.visitedNodes) &&
    isNum(s.gold) &&
    isStrArr(s.badges) &&
    Array.isArray(s.collection) &&
    s.collection.every(isCard) &&
    isStrArr(s.party) &&
    ['grass', 'fire', 'water'].includes(s.starterType as string) &&
    (s.starterChoices === null || (Array.isArray(s.starterChoices) && s.starterChoices.every(isCard))) &&
    isNumRecord(s.hp) &&
    (s.pp === undefined || (isObj(s.pp) && Object.values(s.pp).every(isNumRecord))) &&
    isNumRecord(s.bag) &&
    isStrArr(s.tms) &&
    (s.pendingReward === null || ['wild', 'trainer', 'elite', 'leader'].includes(s.pendingReward as string)) &&
    (s.pendingRewardLevel === undefined || s.pendingRewardLevel === null || isNum(s.pendingRewardLevel)) &&
    typeof s.pendingClear === 'boolean' &&
    isNum(s.playTimeSec);
  if (!ok) return 'broken';

  // 파티는 보관함에 있는 카드만
  const owned = new Set((s.collection as Card[]).map((c) => c.uid));
  if (!(s.party as string[]).every((u) => owned.has(u))) return 'broken';
  return s as unknown as SaveData;
}

export const LOAD_ERROR_TEXT: Record<LoadError, string> = {
  'not-json': '세이브 파일이 아니다 (JSON 형식이 아님).',
  'not-a-save': '이 게임의 세이브 파일이 아니다.',
  'newer-version': '더 새 버전에서 만든 세이브라 불러올 수 없다.',
  broken: '세이브 파일이 손상되었다.',
};

// ── 타이틀 화면 슬롯 표시 ───────────────────────
export interface SlotSummary {
  difficulty: string;
  chapter: number;
  badges: number;
  lines: number;
  playTime: string;
  updatedAt: string;
  challenges: string[];
}

export function formatPlayTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}시간 ${m}분` : `${m}분`;
}

export function summarize(save: SaveData): SlotSummary {
  return {
    difficulty: DIFFICULTY[save.difficulty].label,
    chapter: save.chapter,
    badges: save.badges.length,
    lines: save.collection.length,
    playTime: formatPlayTime(save.playTimeSec),
    updatedAt: save.updatedAt,
    challenges: [save.challenges.nuzlocke && '너즐록', save.challenges.randomStarter && '랜덤 스타터'].filter((x): x is string => !!x),
  };
}

/** 세이브 파일 이름: card-adventure-slot1-2026-11-20.json */
export function exportFileName(slot: number, save: SaveData): string {
  return `card-adventure-slot${slot}-${save.updatedAt.slice(0, 10)}.json`;
}
