// src/store/autosave.ts
// 자동 저장 (spec §7): 진행 상태가 바뀌면 잠깐 모았다가 지금 슬롯에 저장한다.
// 노드 완료·상점 구매·카드 편성 변경이 모두 상태 변화라 여기서 한꺼번에 다룬다.
// 플레이 시간은 매초 바뀌므로 그것만으로는 저장하지 않고 30초마다, 그리고 창을 닫거나 숨길 때 저장한다.
import { useGameStore } from './gameStore';
import { writeSlot } from './saveRepository';

const DEBOUNCE_MS = 400;
const PLAYTIME_SAVE_MS = 30_000;
/** 바뀌어도 저장할 필요가 없는 값 */
const IGNORED = new Set(['playTimeSec', 'lastLost', 'slot']);

let timer: ReturnType<typeof setTimeout> | null = null;
let failed = false;

export function saveNow(): boolean {
  if (timer) clearTimeout(timer);
  timer = null;
  const s = useGameStore.getState();
  if (s.slot === null || s.gameOver) return true;
  const ok = writeSlot(s.slot, s.toSave());
  failed = !ok;
  return ok;
}

/** 마지막 저장이 실패했는지 (화면에 경고를 띄우는 용도) */
export const lastSaveFailed = () => failed;

/** 앱 시작 시 한 번 호출. 해제 함수를 돌려준다 */
export function startAutosave(): () => void {
  const unsubscribe = useGameStore.subscribe((s, prev) => {
    if (s.slot === null) return;
    const changed = (Object.keys(s) as (keyof typeof s)[]).some((k) => typeof s[k] !== 'function' && !IGNORED.has(k) && s[k] !== prev[k]);
    if (!changed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(saveNow, DEBOUNCE_MS);
  });
  const interval = setInterval(saveNow, PLAYTIME_SAVE_MS);
  const onHide = () => document.visibilityState === 'hidden' && saveNow();
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', onHide);
  return () => {
    unsubscribe();
    clearInterval(interval);
    window.removeEventListener('pagehide', saveNow);
    document.removeEventListener('visibilitychange', onHide);
  };
}
