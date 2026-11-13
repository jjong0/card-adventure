// src/lib/fxAssets.ts
// 기술 이펙트 스프라이트 시트 조회 (src/data/assets.json의 fx). 그림은 사용자가 public/assets/fx/에 넣는다.
import assets from '../data/assets.json';
import type { Move } from '../core/types';

export interface FxSprite {
  src: string;
  /** target: 대상 위 / user: 쓰는 쪽 위 / travel: 쓰는 쪽 → 대상으로 날아감 / line: 쓰는 쪽에서 대상까지 늘임 */
  at: 'target' | 'user' | 'travel' | 'line';
  /** 비우면 이미지 가로÷세로 (정사각형 프레임) */
  frames?: number;
  fps: number;
  /** 화면에 그릴 한 변 길이(px). line이면 두께 */
  size: number;
}

const DEFAULTS = { fps: 15, size: 192 };
const table = assets.fx as unknown as Record<string, Partial<FxSprite> | string>;

/** 구체적인 키부터: move:기술 → 계열.타입 → 계열 → 분류.타입 → 분류 */
export function fxKeys(move: Pick<Move, 'slug' | 'type' | 'category'>, family: string | undefined): string[] {
  const keys = [`move:${move.slug}`];
  if (family) keys.push(`${family}.${move.type}`, family);
  keys.push(`${move.category}.${move.type}`, move.category);
  return keys;
}

export function resolveFx(move: Pick<Move, 'slug' | 'type' | 'category'>, family: string | undefined): FxSprite | null {
  for (const key of fxKeys(move, family)) {
    const e = table[key];
    if (e && typeof e === 'object' && e.src) return { ...DEFAULTS, at: 'target', ...e } as FxSprite;
  }
  return null;
}
