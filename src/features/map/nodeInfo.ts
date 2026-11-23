// 노드 종류별 표시 정보: 이름, 색(spec §3.2), 이미지가 없을 때 쓰는 글자, 설명
import assets from '../../data/assets.json';
import type { MapNode, NodeKind } from '../../core/map';
import type { ChapterData } from '../../core/types';

export const NODE_INFO: Record<NodeKind, { label: string; color: string; glyph: string; desc: string; reward: string }> = {
  wild: { label: '야생 포켓몬', color: '#5CC98B', glyph: '풀', desc: '풀숲에서 야생 포켓몬 1마리와 싸운다. 도망칠 수 있다.', reward: '골드 조금 + 속성 팩 1개' },
  trainer: { label: '트레이너', color: '#4FA3F7', glyph: '트', desc: '이 지역의 트레이너와 승부한다.', reward: '골드 + 속성 팩 1개' },
  elite: { label: '엘리트', color: '#F2795A', glyph: '!', desc: '이 근방에서 가장 강한 트레이너다.', reward: '골드 많이 + R 이상 확정 팩' },
  shop: { label: '상점', color: '#F2C14E', glyph: '상', desc: '회복약, 진화의돌, 기술머신을 판다.', reward: '없음' },
  rest: { label: '휴식·강화', color: '#4FD1C5', glyph: '휴', desc: '파티를 회복하거나, 카드 1장을 강화한다.', reward: '회복 또는 레벨 +3 중 하나' },
  event: { label: '사건', color: '#E8A3D9', glyph: '?', desc: '무슨 일이 일어날지 모른다. 도구를 얻거나, 승부가 벌어지거나, 쉬어 갈 수도 있다.', reward: '고르는 선택지에 따라' },
  treasure: { label: '보상', color: '#E6D27A', glyph: '★', desc: '지닌 도구 3개 중 1개를 골라 가져간다.', reward: '지닌 도구 1개 확정' },
  leader: { label: '관장', color: '#B27CF2', glyph: '관', desc: '체육관 관장에게 도전한다.', reward: '배지 + SR 이상 확정 팩 + 기술머신' },
};

const badges = assets.badges as Record<string, string>;
const leaders = assets.leaders as Record<string, string>;

/**
 * 노드 이미지 후보 (assets.json). 앞에서부터 처음으로 있는 파일을 쓴다.
 * 노드 종류마다 공통 아이콘(트레이너 몬스터볼, 엘리트 하이퍼볼). 관장은 배지 → 관장 그림,
 * 라이벌은 라이벌 그림 → 엘리트 아이콘. 사천왕·챔피언·레드는 배지가 없어 인물 그림을 쓴다.
 */
export function nodeImages(node: MapNode, chapter: ChapterData): string[] {
  const key = chapter.leader.key;
  switch (node.kind) {
    case 'leader':
      return [badges[key], leaders[key]].filter(Boolean);
    case 'elite':
      return node.rival ? [assets.rival, assets.nodes.elite] : [assets.nodes.elite];
    case 'wild':
      return [assets.nodes.wild];
    case 'trainer':
      return [assets.nodes.trainer];
    case 'rest':
      return [assets.nodes.rest];
    case 'shop':
      return [assets.nodes.shop];
    case 'event':
      return [assets.nodes.event];
    case 'treasure':
      return [assets.nodes.treasure];
  }
}
