// src/data/data.test.ts  (vitest) — 생성된 데이터끼리 서로 맞는지 검사
// 스크립트로 데이터를 다시 만든 뒤 깨진 참조를 바로 잡아내기 위한 테스트
import { describe, expect, it } from 'vitest';
import speciesList from './species.json';
import movesJson from './moves.json';
import trainersJson from './trainers.json';
import chaptersJson from './chapters.json';
import evolutionsJson from './evolutions.json';
import tmJson from './tmCompat.json';
import assets from './assets.json';
import type { ChapterData, Evolutions, Move, Species, TmData, Trainer } from '../core/types';

const species = Object.fromEntries((speciesList as Species[]).map((s) => [s.id, s]));
const moves = movesJson as unknown as Record<string, Move>;
const trainers = trainersJson as Trainer[];
const chapters = chaptersJson as ChapterData[];
const evolutions = evolutionsJson as Evolutions;
const tm = tmJson as TmData;
const byIndex = Object.fromEntries(trainers.map((t) => [t.index, t]));
const maxLevel = (t: Trainer) => Math.max(...t.party.map((p) => p.level));

describe('trainers.json', () => {
  it('모든 파티 포켓몬과 기술이 species·moves에 있음', () => {
    for (const t of trainers) {
      expect(t.party.length, `${t.index}`).toBeGreaterThan(0);
      for (const p of t.party) {
        expect(species[p.speciesId], `${t.index} ${p.speciesId}`).toBeDefined();
        for (const m of p.moves) expect(moves[m], `${t.index} move ${m}`).toBeDefined();
      }
    }
  });

  it('스토리 보스 22명이 챕터 1~22에 하나씩', () => {
    const story = trainers.filter((t) => t.battle === 'story' && t.chapter).map((t) => t.chapter);
    expect(story.sort((a, b) => a! - b!)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
  });

  it('일반 트레이너 직업은 모두 assets.json에 이미지 경로가 있음', () => {
    const classes = new Set(trainers.filter((t) => t.role === 'trainer').map((t) => t.class));
    for (const c of classes) expect(assets.trainerClasses, c).toHaveProperty(c);
  });
});

describe('chapters.json', () => {
  it('야생: 종이 존재하고 확률 합이 약 100%, 팩 레벨 = 야생 최고 레벨', () => {
    for (const c of chapters) {
      expect(c.wild.length).toBeGreaterThan(0);
      for (const w of c.wild) expect(species[w.speciesId]).toBeDefined();
      const sum = c.wild.reduce((a, w) => a + w.weight, 0);
      expect(Math.abs(sum - 100)).toBeLessThan(1); // 종별 반올림 오차
      expect(c.packLevel).toBe(Math.max(...c.wild.map((w) => w.maxLevel)));
    }
  });

  it('트레이너 풀: 일반 트레이너이고 파티 최고 레벨이 범위 안', () => {
    for (const c of chapters) {
      expect(c.trainers.length).toBeGreaterThan(0);
      for (const i of c.trainers) {
        const t = byIndex[i];
        expect(t.role).toBe('trainer');
        expect(maxLevel(t)).toBeGreaterThan(c.trainerLevel.above);
        expect(maxLevel(t)).toBeLessThanOrEqual(c.trainerLevel.upTo);
      }
    }
  });

  it('관장 에이스 레벨이 spec §2와 일치 (1장 13, 2장 17)', () => {
    expect(chapters.map((c) => [c.leader.key, c.leader.aceLevel])).toEqual([['falkner', 13], ['bugsy', 17]]);
  });

  it('라이벌은 플레이어 스타터에 상성 우위인 스타터 계열', () => {
    const line = { grass: ['155', '156', '157'], fire: ['158', '159', '160'], water: ['152', '153', '154'] };
    for (const c of chapters) {
      if (!c.rivals) continue;
      for (const [type, idx] of Object.entries(c.rivals) as [keyof typeof line, number][]) {
        expect(byIndex[idx].role).toBe('rival');
        expect(byIndex[idx].party.some((p) => line[type].includes(p.speciesId))).toBe(true);
      }
    }
  });
});

describe('evolutions.json', () => {
  it('진화 대상의 진화 전 단계가 키와 일치', () => {
    for (const [from, list] of Object.entries(evolutions)) {
      for (const e of list) expect(species[e.to].evolvesFrom, `${from} → ${e.to}`).toBe(from);
    }
  });
});

describe('tmCompat.json', () => {
  it('기술머신 100개의 기술이 moves에 있고, 호환표의 종·기술이 유효', () => {
    expect(tm.machines).toHaveLength(100);
    const tmMoves = new Set(tm.machines.map((m) => m.moveId));
    for (const m of tm.machines) expect(moves[m.moveId], m.id).toBeDefined();
    for (const [sid, list] of Object.entries(tm.compat)) {
      expect(species[sid]).toBeDefined();
      for (const m of list) expect(tmMoves.has(m)).toBe(true);
    }
  });
});
