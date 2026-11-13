// src/features/battle/effects.ts
// 기술 이펙트 설계: 타입 → 색·모양, 동작 계열(moveFx.json) → 움직임. 이미지 없이 SVG로 그린다(IP 원칙, spec §9).
// 계열이 없는 기술은 분류로 정한다 — 물리: 맞는 쪽 타격 / 특수: 투사체 / 변화: 대상 주위 오라
import moveFx from '../../data/moveFx.json';
import { isSelfTarget } from '../../core/battle';
import type { ElementType, Move, Side } from '../../core/types';

export type FxShape = 'flame' | 'drop' | 'bolt' | 'leaf' | 'shard' | 'star' | 'rock' | 'orb' | 'wind';

/** SVG path (원점 중심, 약 20px) */
export const SHAPE_PATH: Record<FxShape, string> = {
  flame: 'M0 -10 C6 -4 7 3 0 9 C-7 3 -6 -4 0 -10Z',
  drop: 'M0 -9 C5 -2 6 4 0 8 C-6 4 -5 -2 0 -9Z',
  bolt: 'M-3 -11 L4 -2 L0 -1 L4 11 L-4 1 L0 0Z',
  leaf: 'M0 -10 C7 -5 7 5 0 10 C-7 5 -7 -5 0 -10Z',
  shard: 'M0 -11 L5 0 L0 11 L-5 0Z',
  star: 'M0 -10 L2.5 -2.5 L10 0 L2.5 2.5 L0 10 L-2.5 2.5 L-10 0 L-2.5 -2.5Z',
  rock: 'M-7 -4 L-2 -8 L6 -5 L8 3 L1 8 L-6 5Z',
  orb: 'M0 -7 A7 7 0 1 1 0 7 A7 7 0 1 1 0 -7Z',
  wind: 'M-10 2 Q0 -9 10 2 Q0 -3 -10 2Z',
};

/** 돌려도 어색하지 않은 모양. 불꽃·물방울·번개·바람은 방향이 있어 돌리지 않는다 */
export const SPINS: Record<FxShape, boolean> = {
  flame: false, drop: false, bolt: false, wind: false, leaf: true, shard: true, star: true, rock: true, orb: false,
};

export interface TypeFx {
  shape: FxShape;
  color: string;
  /** 바깥 빛 (어두운 배경에서 모양이 묻히지 않게) */
  glow: string;
}

export const TYPE_FX: Record<ElementType, TypeFx> = {
  normal: { shape: 'star', color: '#F4F6FA', glow: '#9AA8BC' },
  fighting: { shape: 'star', color: '#FF9A6B', glow: '#F2795A' },
  flying: { shape: 'wind', color: '#DCE6FF', glow: '#7C8FD6' },
  poison: { shape: 'orb', color: '#C98BE6', glow: '#9550A0' },
  ground: { shape: 'rock', color: '#D9B56A', glow: '#B8954A' },
  rock: { shape: 'rock', color: '#C9B47A', glow: '#A08E45' },
  bug: { shape: 'leaf', color: '#B8D84A', glow: '#7E9A24' },
  ghost: { shape: 'orb', color: '#A99AF0', glow: '#5E5297' },
  steel: { shape: 'shard', color: '#DDE6EF', glow: '#7E8FA0' },
  fire: { shape: 'flame', color: '#FFA24A', glow: '#E0662E' },
  water: { shape: 'drop', color: '#7CC0FF', glow: '#3E7FD9' },
  grass: { shape: 'leaf', color: '#86DA6E', glow: '#4E9E3E' },
  electric: { shape: 'bolt', color: '#FFE35A', glow: '#C9A214' },
  psychic: { shape: 'star', color: '#FF8FBA', glow: '#D9507A' },
  ice: { shape: 'shard', color: '#B8F2F7', glow: '#4FA9B3' },
  dragon: { shape: 'orb', color: '#9C86FF', glow: '#5B3FD1' },
  dark: { shape: 'orb', color: '#B7A69E', glow: '#3A2E28' },
  fairy: { shape: 'star', color: '#FFC0E4', glow: '#C86FA8' },
};

/** 동작 계열 (scripts/build-move-fx.mjs) */
export type FxFamily = 'bite' | 'punch' | 'slash' | 'beam' | 'stream' | 'fall' | 'quake' | 'sound' | 'explode';
const FAMILY = moveFx as Record<string, FxFamily>;

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
