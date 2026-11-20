// src/store/saveRepository.ts
// 세이브 저장소 접근은 이 파일 한 곳에서만 한다 (spec §7). 나중에 클라우드(Supabase)로 바꿀 때 여기만 고친다.
// localStorage는 사생활 보호 모드·용량 초과 등으로 실패할 수 있어 모든 접근을 try/catch로 감싼다.
import { exportFileName, parseSave, SLOT_COUNT, type LoadError } from '../core/save';
import type { SaveData } from '../core/types';

const key = (slot: number) => `card-adventure:slot:${slot}`;

export type SlotState =
  | { slot: number; kind: 'empty' }
  | { slot: number; kind: 'save'; save: SaveData }
  | { slot: number; kind: 'error'; error: LoadError };

export function readSlot(slot: number): SlotState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key(slot));
  } catch {
    return { slot, kind: 'empty' };
  }
  if (raw === null) return { slot, kind: 'empty' };
  const save = parseSave(raw);
  return typeof save === 'string' ? { slot, kind: 'error', error: save } : { slot, kind: 'save', save };
}

export function listSlots(): SlotState[] {
  return Array.from({ length: SLOT_COUNT }, (_, i) => readSlot(i + 1));
}

/** 저장. 실패하면(용량 초과, 저장소 차단) false */
export function writeSlot(slot: number, save: SaveData): boolean {
  try {
    localStorage.setItem(key(slot), JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function deleteSlot(slot: number): void {
  try {
    localStorage.removeItem(key(slot));
  } catch {
    // 저장소를 쓸 수 없으면 지울 것도 없다
  }
}

/** 세이브 파일 내려받기 (JSON) */
export function downloadSave(slot: number, save: SaveData): void {
  const blob = new Blob([JSON.stringify(save, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(slot, save);
  a.click();
  URL.revokeObjectURL(url);
}

/** 고른 세이브 파일 읽어 검사 */
export async function readSaveFile(file: File): Promise<SaveData | LoadError> {
  try {
    return parseSave(await file.text());
  } catch {
    return 'not-json';
  }
}

/**
 * 브라우저가 저장소를 임의로 지우지 않게 요청 (spec §7). Safari는 오래 방문하지 않으면 지울 수 있다.
 * 결과는 표시용이고, 거부돼도 게임은 그대로 돌아간다.
 */
export async function requestPersist(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
