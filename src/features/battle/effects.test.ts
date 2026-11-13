import { describe, expect, it } from 'vitest';
import moves from '../../data/moves.json';
import type { Move } from '../../core/types';
import { effectPlan, TYPE_FX } from './effects';

const bySlug = (slug: string) => Object.values(moves as unknown as Record<string, Move>).find((m) => m.slug === slug)!;

describe('기술 이펙트 계획', () => {
  it('물리기는 상대 위치에서 타격, 특수기는 상대에게 투사체', () => {
    expect(effectPlan(bySlug('tackle'), 'player')).toMatchObject({ kind: 'impact', from: 'player', to: 'enemy', fx: TYPE_FX.normal });
    expect(effectPlan(bySlug('ember'), 'enemy')).toMatchObject({ kind: 'projectile', from: 'enemy', to: 'player', fx: TYPE_FX.fire });
  });

  it('변화기: 자신 대상 상승은 자신에게 위로, 상대 하락은 상대에게 아래로, 상태이상은 방향 없음', () => {
    expect(effectPlan(bySlug('swords-dance'), 'player')).toMatchObject({ kind: 'aura', to: 'player', dir: 'up' });
    expect(effectPlan(bySlug('growl'), 'player')).toMatchObject({ kind: 'aura', to: 'enemy', dir: 'down' });
    expect(effectPlan(bySlug('thunder-wave'), 'player')).toMatchObject({ kind: 'aura', to: 'enemy', dir: 'none', fx: TYPE_FX.electric });
  });

  it('데이터에 없는 기술(발버둥)은 노말 물리', () => {
    expect(effectPlan(undefined, 'player')).toMatchObject({ kind: 'impact', to: 'enemy', fx: TYPE_FX.normal });
  });
});
