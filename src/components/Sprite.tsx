// 포켓몬 스프라이트: URL 후보를 앞에서부터 시도하고, 모두 실패하면 이름 글자로 대체
import { useState } from 'react';
import { spriteCandidates } from '../lib/sprite';

interface Props {
  speciesId: string;
  name: string;
  back?: boolean;
  /** 원본 픽셀 배율 (도트가 뭉개지지 않게 pixelated로 확대) */
  scale?: number;
  /** 정지 이미지만 (목록·작은 아이콘용) */
  still?: boolean;
  className?: string;
}

export function Sprite({ speciesId, name, back = false, scale = 1, still = false, className = '' }: Props) {
  const all = spriteCandidates(speciesId, back);
  const urls = still ? all.slice(-1) : all;
  const [failed, setFailed] = useState({ key: '', count: 0 });
  const key = `${speciesId}-${back}-${still}`;
  const tried = failed.key === key ? failed.count : 0; // 종이 바뀌면 처음 후보부터 다시
  if (tried >= urls.length) {
    return (
      <div className={`flex items-center justify-center rounded-full border-2 border-dashed border-line font-pixel text-text-dim ${className}`} style={{ width: 64 * scale, height: 64 * scale }}>
        {name.slice(0, 1)}
      </div>
    );
  }
  return (
    <img
      src={urls[tried]}
      alt={name}
      draggable={false}
      onError={() => setFailed({ key, count: tried + 1 })}
      className={className}
      style={{ imageRendering: 'pixelated', zoom: scale }}
    />
  );
}
