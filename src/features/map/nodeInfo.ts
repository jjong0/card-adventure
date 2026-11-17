// 노드 종류별 표시 정보: 이름, 색(spec §3.2), 이미지가 없을 때 쓰는 글자, 설명
import assets from '../../data/assets.json';
import type { Opponent } from '../../core/encounter';
import type { MapNode, NodeKind } from '../../core/map';
import type { ChapterData } from '../../core/types';

export const NODE_INFO: Record<NodeKind, { label: string; color: string; glyph: string; desc: string; reward: string }> = {
  wild: { label: '야생 포켓몬', color: '#5CC98B', glyph: '풀', desc: '풀숲에서 야생 포켓몬 1마리와 싸운다. 도망칠 수 있다.', reward: '골드 조금 + 속성 팩 1개' },
  trainer: { label: '트레이너', color: '#4FA3F7', glyph: '트', desc: '이 지역의 트레이너와 승부한다.', reward: '골드 + 속성 팩 1개' },
  elite: { label: '엘리트', color: '#F2795A', glyph: '!', desc: '이 근방에서 가장 강한 트레이너다.', reward: '골드 많이 + R 이상 확정 팩' },
  shop: { label: '상점', color: '#F2C14E', glyph: '상', desc: '회복약, 진화의돌, 기술머신을 판다.', reward: '없음' },
  rest: { label: '휴식·강화', color: '#4FD1C5', glyph: '휴', desc: '파티를 회복하거나, 카드 1장을 강화한다.', reward: '회복 또는 레벨 +3 중 하나' },
  leader: { label: '관장', color: '#B27CF2', glyph: '관', desc: '체육관 관장에게 도전한다.', reward: '배지 + SR 이상 확정 팩 + 기술머신' },
};

const trainerClasses = assets.trainerClasses as Record<string, string>;
const leaders = assets.leaders as Record<string, string>;

/** 노드 이미지 경로 (assets.json). 트레이너는 배정된 직업, 엘리트 기본은 엘리트트레이너, 라이벌·관장은 전용 */
export function nodeImage(node: MapNode, opponent: Opponent | null, chapter: ChapterData): string | undefined {
  switch (node.kind) {
    case 'wild':
      return assets.nodes.wild;
    case 'rest':
      return assets.nodes.rest;
    case 'shop':
      return assets.nodes.shop;
    case 'leader':
      return leaders[chapter.leader.key];
    case 'elite':
      return node.rival ? assets.rival : (opponent?.trainerClass && trainerClasses[opponent.trainerClass]) || assets.eliteDefault;
    case 'trainer':
      return opponent?.trainerClass ? trainerClasses[opponent.trainerClass] : undefined;
  }
}
