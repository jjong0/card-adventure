// src/lib/labels.ts
// 타입·상태이상·능력치의 화면 표시용 한국어 이름과 색
import type { Ailment, ElementType, MoveCategory, Rarity } from '../core/types';

export const TYPE_LABEL: Record<ElementType, string> = {
  normal: '노말', fighting: '격투', flying: '비행', poison: '독', ground: '땅', rock: '바위',
  bug: '벌레', ghost: '고스트', steel: '강철', fire: '불꽃', water: '물', grass: '풀',
  electric: '전기', psychic: '에스퍼', ice: '얼음', dragon: '드래곤', dark: '악', fairy: '페어리',
};

/** 기술 버튼·타입 배지 배경색 (어두운 화면 위에서 흰 글자가 읽히는 명도로 맞춤) */
export const TYPE_COLOR: Record<ElementType, string> = {
  normal: '#8A8F7E', fighting: '#B5402F', flying: '#7C8FD6', poison: '#9550A0', ground: '#B8954A',
  rock: '#A08E45', bug: '#7E9A24', ghost: '#5E5297', steel: '#7E8FA0', fire: '#E0662E',
  water: '#3E7FD9', grass: '#4E9E3E', electric: '#C9A214', psychic: '#D9507A', ice: '#4FA9B3',
  dragon: '#5B3FD1', dark: '#5A4A40', fairy: '#C86FA8',
};

export const CATEGORY_LABEL: Record<MoveCategory, string> = { physical: '물리', special: '특수', status: '변화' };

/** 상태이상 배지 (맹독도 원작처럼 '독'으로 표시) */
export const AILMENT_BADGE: Record<Exclude<Ailment, 'none'>, { label: string; color: string }> = {
  paralysis: { label: '마비', color: '#C9A214' },
  sleep: { label: '잠듦', color: '#7E8FA0' },
  freeze: { label: '얼음', color: '#4FA9B3' },
  burn: { label: '화상', color: '#E0662E' },
  poison: { label: '독', color: '#9550A0' },
  toxic: { label: '독', color: '#9550A0' },
};

export const RARITY_COLOR: Record<Rarity, string> = { N: '#9AA4B2', R: '#4FA3F7', SR: '#B27CF2', UR: '#F2C14E' };

/** 상성 배율 → 기술 설명 문구 */
export function effectivenessLabel(mult: number): string {
  if (mult === 0) return '효과 없음';
  if (mult >= 4) return '효과 매우 굉장함 ×4';
  if (mult >= 2) return '효과 굉장함 ×2';
  if (mult <= 0.25) return '효과 매우 별로 ×¼';
  if (mult < 1) return '효과 별로 ×½';
  return '보통';
}
