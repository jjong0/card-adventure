// src/lib/assetImage.ts
// 사용자 수집 이미지(public/assets) 불러오기. 후보를 앞에서부터 확인해 처음으로 있는 파일을 쓰고,
// 하나도 없으면 null → 화면은 기본 표시로 대체한다 (spec §9.1). 같은 경로는 한 번만 시도한다.
import { useEffect, useState } from 'react';

type Status = 'loading' | 'ok' | 'error';
const cache = new Map<string, Status>();
const pending = new Map<string, Promise<Status>>();

function check(src: string): Promise<Status> {
  const known = cache.get(src);
  if (known && known !== 'loading') return Promise.resolve(known);
  let p = pending.get(src);
  if (!p) {
    p = new Promise<Status>((resolve) => {
      const img = new Image();
      img.onload = () => resolve('ok');
      img.onerror = () => resolve('error');
      img.src = src;
    }).then((s) => {
      cache.set(src, s);
      pending.delete(src);
      return s;
    });
    pending.set(src, p);
  }
  return p;
}

const firstKnown = (srcs: string[]) => {
  for (const s of srcs) {
    const st = cache.get(s);
    if (st === 'ok') return s;
    if (st !== 'error') return undefined; // 아직 모름
  }
  return null;
};

/** 후보 중 처음으로 있는 이미지 경로. 확인 중이면 undefined, 하나도 없으면 null */
export function useAssetImage(srcs: (string | undefined)[]): string | null | undefined {
  const list = srcs.filter((s): s is string => !!s);
  const key = list.join('|');
  const [found, setFound] = useState<string | null | undefined>(() => firstKnown(list));
  useEffect(() => {
    let alive = true;
    setFound(firstKnown(list));
    (async () => {
      for (const s of list) {
        if ((await check(s)) === 'ok') return alive && setFound(s);
      }
      if (alive) setFound(null);
    })();
    return () => {
      alive = false;
    };
    // key가 같으면 같은 후보 목록이다
  }, [key]);
  return found;
}
