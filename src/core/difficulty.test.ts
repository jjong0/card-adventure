// src/core/difficulty.test.ts  (vitest) — 난이도 보정 (spec §5.3)
import { describe, expect, it } from 'vitest';
import chaptersJson from '../data/chapters.json';
import trainersJson from '../data/trainers.json';
import { adjustGold, adjustOpponent, capFor, goldAfterLoss, leaderTrainer, levelCap, scaleRematch } from './difficulty';
import { createRng } from './gacha';
import type { Card, ChapterData, Trainer } from './types';

const trainers = trainersJson as Trainer[];
const chapters = chaptersJson as ChapterData[];
const story = (key: string) => trainers.find((t) => t.key === key && t.battle === 'story')!;
const rematch = (key: string) => trainers.find((t) => t.key === key && t.battle === 'rematch');
const IV10 = { hp: 10, atk: 10, def: 10, spAtk: 10, spDef: 10, spd: 10 };
const card = (level: number): Card => ({
  uid: `c${level}`, speciesId: '16', lineId: '16', level, exp: 0, star: 1, dupProgress: 0, ivBase: IV10,
  ivAlloc: { ...IV10, hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0 }, ivPoints: 0, learnedMoves: [], moves: [], heldItem: null,
});

describe('상대 보정', () => {
  it('레벨: 쉬움 −2, 보통·어려움 그대로, 익스트림 +1 (최소 Lv1)', () => {
    const rng = createRng(1);
    expect(adjustOpponent([card(10)], 'easy', rng)[0].level).toBe(8);
    expect(adjustOpponent([card(10)], 'normal', rng)[0].level).toBe(10);
    expect(adjustOpponent([card(10)], 'hard', rng)[0].level).toBe(10);
    expect(adjustOpponent([card(10)], 'extreme', rng)[0].level).toBe(11);
    expect(adjustOpponent([card(2)], 'easy', rng)[0].level).toBe(1);
  });

  it('개체값: 보통은 원래 값, 쉬움 0~15, 어려움·익스트림 31 (500번)', () => {
    const rng = createRng(2);
    expect(adjustOpponent([card(10)], 'normal', rng)[0].ivBase).toEqual(IV10);
    for (let i = 0; i < 500; i++) {
      for (const v of Object.values(adjustOpponent([card(10)], 'easy', rng)[0].ivBase)) expect(v >= 0 && v <= 15).toBe(true);
    }
    expect(new Set(Object.values(adjustOpponent([card(10)], 'hard', rng)[0].ivBase))).toEqual(new Set([31]));
    expect(new Set(Object.values(adjustOpponent([card(10)], 'extreme', rng)[0].ivBase))).toEqual(new Set([31]));
  });
});

describe('관장 파티', () => {
  it('재대결 파티 스케일: 에이스가 스토리 에이스 레벨이 되고 나머지는 비율대로', () => {
    const scaled = scaleRematch(rematch('falkner')!.party, 13);
    expect(Math.max(...scaled.map((p) => p.level))).toBe(13);
    // 원작 재대결 Lv50 / 에이스 Lv56 → round(50 × 13 / 56) = 12
    expect(scaled[0].level).toBe(Math.round((50 * 13) / 56));
  });

  it('파티 규칙: story는 원작, story+1은 재대결 에이스 1마리 추가, rematch는 재대결 6마리', () => {
    const s = story('falkner');
    const r = rematch('falkner');
    expect(leaderTrainer(s, r, 'story').party).toEqual(s.party);
    const plus = leaderTrainer(s, r, 'story+1').party;
    expect(plus).toHaveLength(s.party.length + 1);
    expect(plus.at(-1)!.speciesId).toBe(r!.party.reduce((a, b) => (b.level > a.level ? b : a)).speciesId);
    expect(plus.at(-1)!.level).toBe(13);
    const re = leaderTrainer(s, r, 'rematch').party;
    expect(re.map((p) => p.speciesId)).toEqual(r!.party.map((p) => p.speciesId));
  });

  it('재대결 파티가 없는 레드는 어느 난이도든 스토리 파티', () => {
    expect(rematch('red')).toBeUndefined();
    expect(leaderTrainer(story('red'), undefined, 'rematch').party).toEqual(story('red').party);
  });
});

describe('진행 보정', () => {
  it('레벨 캡: 지금은 모든 난이도가 없음(100). 규칙은 관장 에이스 + 레벨 보정', () => {
    for (const d of ['easy', 'normal', 'hard', 'extreme'] as const) expect(levelCap(chapters[0], d)).toBe(100);
    expect(capFor(chapters[0], { levelCap: 'leader-ace', levelOffset: 3 })).toBe(16); // 비상 에이스 13 + 3
    expect(capFor(chapters[0], { levelCap: 'leader-ace-2', levelOffset: 0 })).toBe(11);
  });

  it('골드: 배율 ×1.5 / ×1 / ×0.6 / ×0.6, 패배하면 어려움·익스트림은 전부 잃음', () => {
    expect([adjustGold(100, 'easy'), adjustGold(100, 'normal'), adjustGold(100, 'hard'), adjustGold(100, 'extreme')]).toEqual([150, 100, 60, 60]);
    expect([goldAfterLoss(1001, 'normal'), goldAfterLoss(1001, 'hard'), goldAfterLoss(1001, 'extreme')]).toEqual([1001, 0, 0]);
  });
});
