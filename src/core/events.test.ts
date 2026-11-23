// src/core/events.test.ts (vitest) — 사건 노드
import { describe, expect, it } from 'vitest';
import { choiceCost, EVENTS, eventForNode, resolveChoice } from './events';
import { createRng } from './gacha';
import { HEAL_ITEMS } from './items';
import { generateMap } from './map';

describe('사건 데이터', () => {
  it('사건마다 선택지 2~3개, 결과가 하나 이상, 회복약 id가 맞다', () => {
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
    for (const e of EVENTS) {
      expect(e.choices.length >= 2 && e.choices.length <= 3, e.id).toBe(true);
      for (const c of e.choices) {
        expect(c.outcomes.length).toBeGreaterThan(0);
        for (const o of c.outcomes) {
          for (const fx of o.effects) if (fx.kind === 'bagItem') expect(HEAL_ITEMS.some((i) => i.id === fx.id)).toBe(true);
        }
      }
    }
  });

  it('골드가 드는 선택지는 챕터 번호를 곱한다', () => {
    const toll = EVENTS.find((e) => e.id === 'toll-thug')!.choices[1];
    expect(choiceCost(toll, 1)).toBe(300);
    expect(choiceCost(toll, 4)).toBe(1200);
  });
});

describe('사건 배정', () => {
  it('같은 챕터의 사건 노드끼리는 사건이 겹치지 않고, 같은 시드면 같다', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const map = generateMap(seed, 1);
      const nodes = map.floors.flat().filter((n) => n.kind === 'event');
      const ids = nodes.map((n) => eventForNode(map, n, seed).id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(nodes.map((n) => eventForNode(map, n, seed).id)).toEqual(ids);
    }
  });

  it('결과는 가중치대로 나온다 (흔들리는 풀숲: 전투 3 : 도구 2)', () => {
    const choice = EVENTS.find((e) => e.id === 'rustling-grass')!.choices[0];
    const rng = createRng(3);
    let battle = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) if (resolveChoice(choice, rng).effects.some((fx) => fx.kind === 'battle')) battle++;
    expect(battle / n).toBeGreaterThan(0.57);
    expect(battle / n).toBeLessThan(0.63);
  });
});
