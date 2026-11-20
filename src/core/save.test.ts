// src/core/save.test.ts  (vitest) — 세이브 검사·요약 (spec §7)
import { describe, expect, it } from 'vitest';
import { exportFileName, formatPlayTime, parseSave, SAVE_VERSION, summarize } from './save';
import type { Card, SaveData } from './types';

const IV = { hp: 10, atk: 10, def: 10, spAtk: 10, spDef: 10, spd: 10 };
const card: Card = {
  uid: 'c1', speciesId: '4', lineId: '4', level: 6, exp: 0, star: 2, dupProgress: 1, ivBase: IV, ivAlloc: { ...IV, atk: 3 },
  ivPoints: 5, learnedMoves: ['10'], moves: ['10'], heldItem: null,
};
const save: SaveData = {
  version: SAVE_VERSION, createdAt: '2026-11-20T01:00:00.000Z', updatedAt: '2026-11-20T02:00:00.000Z',
  difficulty: 'hard', challenges: { nuzlocke: true, randomStarter: false }, runSeed: 1, seed: 2, chapter: 2, finished: false,
  mapNodeId: '3-1', visitedNodes: ['1-0', '2-1', '3-1'], gold: 1200, badges: ['falkner'], collection: [card], party: ['c1'],
  starterType: 'fire', starterChoices: null, hp: { c1: 10 }, bag: { potion: 2 }, tms: ['355'], pendingReward: null,
  pendingClear: false, playTimeSec: 3725,
};

describe('세이브 검사', () => {
  it('정상 세이브는 그대로, 문자열(JSON)도 받는다', () => {
    expect(parseSave(save)).toEqual(save);
    expect(parseSave(JSON.stringify(save))).toEqual(save);
  });

  it('JSON이 아니면 not-json, 다른 JSON이면 not-a-save, 새 버전이면 newer-version', () => {
    expect(parseSave('{oops')).toBe('not-json');
    expect(parseSave('{"hello":1}')).toBe('not-a-save');
    expect(parseSave({ ...save, version: SAVE_VERSION + 1 })).toBe('newer-version');
  });

  it('필드가 빠지거나 형식이 틀리면, 또는 파티에 없는 카드가 있으면 broken', () => {
    const { gold: _gold, ...noGold } = save;
    expect(parseSave(noGold)).toBe('broken');
    expect(parseSave({ ...save, difficulty: 'nightmare' })).toBe('broken');
    expect(parseSave({ ...save, collection: [{ ...card, star: 9 }] })).toBe('broken');
    expect(parseSave({ ...save, party: ['ghost'] })).toBe('broken');
    expect(parseSave({ ...save, hp: { c1: 'full' } })).toBe('broken');
  });
});

describe('슬롯 요약', () => {
  it('난이도·챕터·배지·계열 수·플레이 시간·챌린지', () => {
    expect(summarize(save)).toEqual({
      difficulty: '어려움', chapter: 2, badges: 1, lines: 1, playTime: '1시간 2분', updatedAt: save.updatedAt, challenges: ['너즐록'],
    });
    expect(formatPlayTime(59)).toBe('0분');
    expect(exportFileName(2, save)).toBe('card-adventure-slot2-2026-11-20.json');
  });
});
