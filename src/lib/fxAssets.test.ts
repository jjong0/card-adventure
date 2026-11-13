import { describe, expect, it } from 'vitest';
import { fxKeys, resolveFx } from './fxAssets';

describe('기술 이펙트 그림 조회', () => {
  it('구체적인 키부터 찾는다', () => {
    expect(fxKeys({ slug: 'ice-beam', type: 'ice', category: 'special' }, 'beam')).toEqual([
      'move:ice-beam', 'beam.ice', 'beam', 'special.ice', 'special',
    ]);
    expect(fxKeys({ slug: 'tackle', type: 'normal', category: 'physical' }, undefined)).toEqual([
      'move:tackle', 'physical.normal', 'physical',
    ]);
  });

  it('계열 그림이 있으면 계열, 없으면 분류 그림 + 기본값', () => {
    expect(resolveFx({ slug: 'ice-beam', type: 'ice', category: 'special' }, 'beam')).toMatchObject({ src: '/assets/fx/beam.png', at: 'line', fps: 15 });
    expect(resolveFx({ slug: 'tackle', type: 'normal', category: 'physical' }, undefined)).toEqual({
      src: '/assets/fx/physical.png', at: 'target', fps: 15, size: 192,
    });
  });
});
