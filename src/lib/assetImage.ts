// src/lib/assetImage.ts
// 사용자 수집 이미지(public/assets) 불러오기. 파일이 없으면 'error' → 화면은 기본 표시로 대체한다 (spec §9.1).
// 같은 경로는 한 번만 시도한다.
import { useEffect, useState } from 'react';

type Status = 'loading' | 'ok' | 'error';
const cache = new Map<string, Status>();

export function useAssetImage(src: string | undefined): Status {
  const [status, setStatus] = useState<Status>(() => (src ? cache.get(src) ?? 'loading' : 'error'));
  useEffect(() => {
    if (!src) return setStatus('error');
    const known = cache.get(src);
    if (known && known !== 'loading') return setStatus(known);
    setStatus('loading');
    const img = new Image();
    const done = (s: Status) => () => {
      cache.set(src, s);
      setStatus(s);
    };
    img.onload = done('ok');
    img.onerror = done('error');
    img.src = src;
  }, [src]);
  return status;
}
