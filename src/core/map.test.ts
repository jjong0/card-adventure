// src/core/map.test.ts  (vitest) — 지도 생성 규칙 (spec §3.1~3.2), 시드 300개로 검증
import { describe, expect, it } from 'vitest';
import { findNode, generateMap, reachableNodes, type ChapterMap } from './map';

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 1);
const each = (chapter: number, f: (m: ChapterMap) => void, hasRival = false) => SEEDS.forEach((s) => f(generateMap(s, chapter, { hasRival })));

describe('지도 구조', () => {
  it('일반 챕터 10층: 1층 야생 하나, 2층 3~4개, 중간 2~4개, 9층 전부 휴식, 10층 관장 하나', () => {
    each(1, (m) => {
      expect(m.floors).toHaveLength(10);
      expect(m.floors[0].map((n) => n.kind)).toEqual(['wild']);
      expect([3, 4]).toContain(m.floors[1].length);
      for (const fl of m.floors.slice(1, 8)) expect(fl.length >= 2 && fl.length <= 4).toBe(true);
      expect(m.floors[8].every((n) => n.kind === 'rest')).toBe(true);
      expect(m.floors[9].map((n) => n.kind)).toEqual(['leader']);
    });
  });

  it('각 노드는 다음 층 1~2개와 연결되고(1층 출발 노드는 2층 전부와), 모든 노드에 들어오는 길이 있다', () => {
    each(1, (m) => {
      m.floors.slice(0, -1).forEach((fl, f) => {
        const incoming = new Set(fl.flatMap((n) => n.next));
        if (f === 0) expect(fl[0].next).toEqual(m.floors[1].map((n) => n.id));
        else for (const n of fl) expect(n.next.length >= 1 && n.next.length <= 2).toBe(true);
        for (const up of m.floors[f + 1]) expect(incoming.has(up.id)).toBe(true);
      });
    });
  });

  it('선이 교차하지 않는다', () => {
    each(1, (m) => {
      for (const fl of m.floors.slice(0, -1)) {
        const links = fl.flatMap((n) => n.next.map((id) => [n.index, findNode(m, id)!.index] as const));
        for (const [a1, b1] of links) for (const [a2, b2] of links) if (a1 < a2) expect(b1).toBeLessThanOrEqual(b2);
      }
    });
  });
});

describe('노드 배치', () => {
  it('엘리트는 4층 이상, 상점은 3층 이상 1~2개, 중간 휴식은 최대 1개', () => {
    each(1, (m) => {
      const all = m.floors.flat();
      for (const n of all.filter((x) => x.kind === 'elite')) expect(n.floor).toBeGreaterThanOrEqual(4);
      const shops = all.filter((x) => x.kind === 'shop');
      expect(shops.length >= 1 && shops.length <= 2).toBe(true);
      for (const n of shops) expect(n.floor).toBeGreaterThanOrEqual(3);
      expect(all.filter((x) => x.kind === 'rest' && x.floor < 9).length).toBeLessThanOrEqual(1);
    });
  });

  it('보상은 3층 이상 1개, 사건은 2층 이상 2~3개 (사천왕 구간은 사건 1개)', () => {
    each(1, (m) => {
      const all = m.floors.flat();
      const treasures = all.filter((x) => x.kind === 'treasure');
      expect(treasures).toHaveLength(1);
      expect(treasures[0].floor).toBeGreaterThanOrEqual(3);
      const events = all.filter((x) => x.kind === 'event');
      expect(events.length >= 2 && events.length <= 3).toBe(true);
      for (const n of events) expect(n.floor).toBeGreaterThanOrEqual(2);
    });
    each(9, (m) => expect(m.floors.flat().filter((n) => n.kind === 'event')).toHaveLength(1));
  });

  it('라이벌전이 있는 챕터는 엘리트 노드 하나가 라이벌', () => {
    each(1, (m) => expect(m.floors.flat().filter((n) => n.rival).length).toBe(1), true);
    each(1, (m) => expect(m.floors.flat().filter((n) => n.rival).length).toBe(0), false);
  });

  it('사천왕 구간(9~12장)은 5층, 상점·엘리트 없음', () => {
    each(9, (m) => {
      expect(m.floors).toHaveLength(5);
      const kinds = m.floors.flat().map((n) => n.kind);
      expect(kinds).not.toContain('shop');
      expect(kinds).not.toContain('elite');
      expect(m.floors[3].every((n) => n.kind === 'rest')).toBe(true);
    });
  });
});

describe('진행', () => {
  it('같은 시드 + 챕터 = 같은 지도, 챕터가 다르면 다른 지도', () => {
    expect(generateMap(42, 1)).toEqual(generateMap(42, 1));
    expect(generateMap(42, 1)).not.toEqual(generateMap(42, 2));
  });

  it('출발 전에는 1층 전부, 이후에는 연결된 노드만 갈 수 있다', () => {
    const m = generateMap(42, 1);
    expect(reachableNodes(m, null)).toEqual(m.floors[0].map((n) => n.id));
    expect(reachableNodes(m, m.floors[0][0].id)).toEqual(m.floors[0][0].next);
    expect(reachableNodes(m, m.floors[9][0].id)).toEqual([]);
  });
});
