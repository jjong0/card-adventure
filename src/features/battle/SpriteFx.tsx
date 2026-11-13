// 기술 이펙트 스프라이트 시트 재생 (가로로 이어 붙인 정사각형 프레임). 파일이 없으면 아무것도 그리지 않는다.
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { FxSprite } from '../../lib/fxAssets';

type Pt = { x: number; y: number };

/** src → 프레임 수 또는 불러오기 실패. 같은 그림을 다시 불러오지 않는다 */
const loaded = new Map<string, number | 'error'>();

function useFrames(sprite: FxSprite) {
  const [frames, setFrames] = useState(() => loaded.get(sprite.src));
  useEffect(() => {
    const known = loaded.get(sprite.src);
    if (known !== undefined) return setFrames(known);
    const img = new Image();
    img.onload = () => {
      const n = sprite.frames ?? Math.max(1, Math.round(img.naturalWidth / img.naturalHeight));
      loaded.set(sprite.src, n);
      setFrames(n);
    };
    img.onerror = () => {
      loaded.set(sprite.src, 'error');
      setFrames('error');
    };
    img.src = sprite.src;
  }, [sprite.src, sprite.frames]);
  return frames;
}

export function SpriteFx({ sprite, from, to }: { sprite: FxSprite; from: Pt; to: Pt }) {
  const frames = useFrames(sprite);
  if (frames === undefined || frames === 'error') return null;

  const duration = frames / sprite.fps;
  const strip = {
    backgroundImage: `url("${sprite.src}")`,
    backgroundSize: `${frames * 100}% 100%`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated' as const,
    // 0% → 100%를 frames개 위치로 끊어 한 장씩 보여준다. jump-none은 0%와 100%를 포함해 n개 위치를 만든다
    // (index.css @keyframes fx-strip)
    animation: frames > 1 ? `fx-strip ${duration}s steps(${frames}, jump-none) forwards` : undefined,
  };
  const fade = { opacity: [1, 1, 0] };
  const fadeT = { duration: duration + 0.08, times: [0, 0.9, 1] };
  const s = sprite.size;

  if (sprite.at === 'line') {
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
    return (
      <motion.div
        className="absolute"
        style={{ ...strip, left: from.x, top: from.y - s / 2, width: len, height: s, transform: `rotate(${angle}deg)`, transformOrigin: `0 ${s / 2}px` }}
        animate={fade}
        transition={fadeT}
      />
    );
  }

  const start = sprite.at === 'user' || sprite.at === 'travel' ? from : to;
  const end = sprite.at === 'travel' ? to : start;
  return (
    <motion.div
      className="absolute"
      style={{ ...strip, width: s, height: s, left: -s / 2, top: -s / 2 }}
      initial={{ x: start.x, y: start.y }}
      animate={{ x: [start.x, end.x], y: [start.y, end.y], ...fade }}
      transition={{ ...fadeT, ease: 'linear' }}
    />
  );
}
