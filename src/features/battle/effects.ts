// src/features/battle/effects.ts
// 기술 이펙트 계획: 동작 계열(moveFx.json)·분류로 연출 종류와 대상을 정한다.
// 그림은 lib/fxAssets.ts가 계열·타입·분류로 고른다. 원작 이펙트는 쓰지 않는다 (IP 원칙, spec §9)
import moveFx from '../../data/moveFx.json';
import { isSelfTarget } from '../../core/battle';
import type { ElementType, Move, Side } from '../../core/types';

/** 타입 색: 피격 반응의 번쩍임에 쓴다 */
export interface TypeFx {
  color: string;
  glow: string;
}

export const TYPE_FX: Record<ElementType, TypeFx> = {
  normal: { color: '#F4F6FA', glow: '#9AA8BC' },
  fighting: { color: '#FF9A6B', glow: '#F2795A' },
  flying: { color: '#DCE6FF', glow: '#7C8FD6' },
  poison: { color: '#C98BE6', glow: '#9550A0' },
  ground: { color: '#D9B56A', glow: '#B8954A' },
  rock: { color: '#C9B47A', glow: '#A08E45' },
  bug: { color: '#B8D84A', glow: '#7E9A24' },
  ghost: { color: '#A99AF0', glow: '#5E5297' },
  steel: { color: '#DDE6EF', glow: '#7E8FA0' },
  fire: { color: '#FFA24A', glow: '#E0662E' },
  water: { color: '#7CC0FF', glow: '#3E7FD9' },
  grass: { color: '#86DA6E', glow: '#4E9E3E' },
  electric: { color: '#FFE35A', glow: '#C9A214' },
  psychic: { color: '#FF8FBA', glow: '#D9507A' },
  ice: { color: '#B8F2F7', glow: '#4FA9B3' },
  dragon: { color: '#9C86FF', glow: '#5B3FD1' },
  dark: { color: '#B7A69E', glow: '#3A2E28' },
  fairy: { color: '#FFC0E4', glow: '#C86FA8' },
};

/** 동작 계열 (scripts/build-move-fx.mjs) */
export type FxFamily = 'bite' | 'punch' | 'slash' | 'beam' | 'stream' | 'fall' | 'quake' | 'sound' | 'explode';
const FAMILY = moveFx as Record<string, FxFamily>;
const FAMILIES = new Set<string>(['bite', 'punch', 'slash', 'beam', 'stream', 'fall', 'quake', 'sound', 'explode']);
export const isFamily = (kind: string): kind is FxFamily => FAMILIES.has(kind);

export interface EffectPlan {
  kind: 'impact' | 'projectile' | 'aura' | FxFamily;
  from: Side;
  to: Side;
  fx: TypeFx;
  /** 오라 방향: 능력치 상승 up, 하락 down, 그 외(상태이상 등) none */
  dir: 'up' | 'down' | 'none';
}

const other = (s: Side): Side => (s === 'player' ? 'enemy' : 'player');

/** 기술 → 연출 계획. 발버둥처럼 데이터에 없는 기술은 노말 물리로 본다 */
export function effectPlan(move: Move | undefined, user: Side): EffectPlan {
  if (!move) return { kind: 'impact', from: user, to: other(user), fx: TYPE_FX.normal, dir: 'none' };
  const fx = TYPE_FX[move.type];
  const family = FAMILY[move.id];
  if (family) {
    // 소리 계열 변화기(치료방울 등)는 자기 편 대상일 수 있다. 폭발은 쓰는 쪽에서 터진다
    const to = move.category === 'status' && isSelfTarget(move) ? user : other(user);
    return { kind: family, from: user, to, fx, dir: 'none' };
  }
  if (move.category === 'status') {
    const to = isSelfTarget(move) ? user : other(user);
    const sum = (move.meta?.statChanges ?? []).reduce((a, c) => a + c.change, 0);
    return { kind: 'aura', from: user, to, fx, dir: sum > 0 ? 'up' : sum < 0 ? 'down' : 'none' };
  }
  return { kind: move.category === 'physical' ? 'impact' : 'projectile', from: user, to: other(user), fx, dir: 'none' };
}
