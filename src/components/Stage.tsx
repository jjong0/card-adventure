// 1280×720 기준 화면을 창 크기에 맞춰 비율 유지로 확대·축소 (spec §8 기준 해상도)
import { useLayoutEffect, useState, type ReactNode } from 'react';

export const STAGE_W = 1280;
export const STAGE_H = 720;

export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden bg-bg">
      <div className="relative shrink-0 overflow-hidden" style={{ width: STAGE_W * scale, height: STAGE_H * scale }}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
