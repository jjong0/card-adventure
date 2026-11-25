// src/core/ai.ts
// 어려움·익스트림 상대 AI (docs/spec.md §5.3, §10). 쉬움(무작위)·보통(기대 데미지 최대)은 battle.ts.
//
// smart (어려움)
//   - 교체: 지금 포켓몬이 크게 맞고(남은 HP의 60% 이상) 거의 못 때리면(상대 HP의 1/3 미만), 더 잘 싸울 벤치 포켓몬으로
//   - 변화기: 버틸 만할 때 상태이상(잠듦·마비 > 맹독·화상 > 혼란), 안전할 때 능력 올리기, HP가 낮으면 회복기
//   - 선공기로 쓰러뜨릴 수 있으면 선공기
// expert (익스트림)
//   - smart + 스피드를 읽는다: 상대가 먼저 움직여 나를 쓰러뜨릴 수 있고 내가 먼저 쓰러뜨릴 수 없으면 버틸 포켓몬으로 교체
//   - 내가 먼저 움직여 쓰러뜨릴 수 있으면 망설이지 않는다. 쓰러질 상황에서는 변화기를 쓰지 않는다
// 교체는 연달아 하지 않는다 (지난 턴에 교체했으면 이번 턴은 싸운다).
import { expectedDamage, isSelfTarget, typeEffectiveness } from './battle';
import { usableMoves } from './heldItems';
import type { BattleAction, BattleMon, BattleState, Dex, Move } from './types';

type Smart = 'smart' | 'expert';

interface Best {
  moveId: string | null;
  damage: number;
}

/** 공격기 중 기대 데미지가 가장 큰 기술 (반동 기술은 쓰러뜨리지 못하면 절반) */
function bestAttack(user: BattleMon, target: BattleMon, dex: Dex): Best {
  let best: Best = { moveId: null, damage: 0 };
  for (const id of usableMoves(user, dex.moves)) {
    const mv = dex.moves[id];
    const raw = expectedDamage(user, target, mv, dex);
    const dmg = mv.effectId === 81 && raw < target.currentHp ? raw / 2 : raw;
    if (dmg > best.damage) best = { moveId: id, damage: dmg };
  }
  return best;
}

/** 이 상대 기준으로 한 턴에 받는 데미지 ÷ 남은 HP (1 이상이면 이번 턴에 쓰러질 수 있다) */
const threatTo = (me: BattleMon, foe: BattleMon, dex: Dex) => bestAttack(foe, me, dex).damage / Math.max(1, me.currentHp);
/** 한 턴에 주는 데미지 ÷ 상대 남은 HP */
const offenseOn = (me: BattleMon, foe: BattleMon, dex: Dex) => bestAttack(me, foe, dex).damage / Math.max(1, foe.currentHp);

/** 스피드 어림 (랭크·마비 반영, 구애스카프는 무시) */
function speed(mon: BattleMon) {
  const s = mon.stages.spd;
  let v = mon.stats.spd * (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
  if (mon.ailment === 'paralysis') v /= 2;
  return v;
}

function immune(target: BattleMon, mv: Move, dex: Dex): boolean {
  const a = mv.meta?.ailment;
  const t = target.types;
  if (mv.type === 'electric' && t.includes('ground')) return true;
  if (typeEffectiveness(mv.type, t, dex) === 0 && !isSelfTarget(mv)) return true;
  if (a === 'burn') return t.includes('fire');
  if (a === 'paralysis') return t.includes('electric');
  if (a === 'freeze') return t.includes('ice');
  if (a === 'poison') return t.includes('poison') || t.includes('steel');
  return false;
}

/** 교체할 벤치 포켓몬: (내가 줄 데미지 비율 − 받을 데미지 비율)이 가장 좋은 쪽 */
function bestBench(state: BattleState, dex: Dex): { idx: number; score: number; threat: number } | null {
  const side = state.enemy;
  const foe = state.player.party[state.player.activeIdx];
  let best: { idx: number; score: number; threat: number } | null = null;
  side.party.forEach((m, idx) => {
    if (idx === side.activeIdx || m.currentHp <= 0) return;
    const threat = threatTo(m, foe, dex);
    const score = offenseOn(m, foe, dex) - threat;
    if (!best || score > best.score) best = { idx, score, threat };
  });
  return best;
}

function switchChoice(state: BattleState, dex: Dex, level: Smart): BattleAction | null {
  if (state.enemySwitchTurn >= state.turn - 1 && state.enemySwitchTurn > 0) return null;
  const me = state.enemy.party[state.enemy.activeIdx];
  const foe = state.player.party[state.player.activeIdx];
  const threat = threatTo(me, foe, dex);
  const offense = offenseOn(me, foe, dex);
  const bench = bestBench(state, dex);
  if (!bench) return null;

  // 크게 맞는데 거의 못 때리는 매치업
  if (threat >= 0.6 && offense < 0.34 && bench.score > offense - threat + 0.3) return { kind: 'switch', toIdx: bench.idx };

  if (level === 'expert') {
    // 상대가 먼저 움직여 나를 쓰러뜨리는데, 나는 먼저 쓰러뜨릴 수 없다 → 버틸 포켓몬이 있으면 교체
    const outspeeds = speed(foe) > speed(me);
    const iWinRace = offense >= 1 && !outspeeds;
    if (threat >= 1 && outspeeds && !iWinRace && bench.threat < 0.5) return { kind: 'switch', toIdx: bench.idx };
  }
  return null;
}

/** 변화기의 가치 (데미지와 같은 단위: 상대 HP 기준 어림). 쓸 이유가 없으면 −1 */
function statusValue(me: BattleMon, foe: BattleMon, mv: Move, dex: Dex, threat: number, best: Best): number {
  const meta = mv.meta;
  if (!meta) return -1;
  const acc = (mv.accuracy ?? 100) / 100;
  // 회복기: HP 절반 아래이고 한 방에 쓰러지지 않을 때
  if (meta.category === 'heal' && isSelfTarget(mv)) {
    return me.currentHp < me.stats.hp * 0.5 && threat < 0.5 ? (me.stats.hp - me.currentHp) * 0.8 : -1;
  }
  // 상태이상: 상대가 멀쩡하고, 맞힐 수 있고, 내가 버틸 만할 때
  if (meta.ailment !== 'none' && !isSelfTarget(mv)) {
    if (threat >= 0.5 || immune(foe, mv, dex)) return -1;
    if (meta.ailment === 'confusion') return foe.confusedTurns > 0 ? -1 : foe.stats.hp * 0.15 * acc;
    if (foe.ailment !== 'none') return -1;
    const weight = meta.ailment === 'sleep' || meta.ailment === 'paralysis' ? 0.35 : meta.ailment === 'poison' || meta.ailment === 'burn' ? 0.25 : 0.1;
    return foe.stats.hp * weight * acc;
  }
  // 능력 올리기: HP가 넉넉하고 상대가 약하게 때릴 때, 아직 많이 안 올렸으면
  if (isSelfTarget(mv) && meta.statChanges.some((c) => c.change > 0)) {
    const ups = meta.statChanges.filter((c) => c.change > 0);
    if (me.currentHp < me.stats.hp * 0.7 || threat >= 0.3 || ups.every((c) => me.stages[c.stat] >= 2)) return -1;
    // 다음 턴부터 데미지가 늘어나는 값이라, 한 번도 안 올렸으면 지금 공격보다 낫게, +1이면 조금 낫게 본다
    const raised = Math.max(...ups.map((c) => me.stages[c.stat]));
    return Math.max(best.damage * (raised <= 0 ? 1.5 : 1.1), foe.stats.hp * 0.1);
  }
  return -1;
}

function pickMove(state: BattleState, dex: Dex, level: Smart): string {
  const me = state.enemy.party[state.enemy.activeIdx];
  const foe = state.player.party[state.player.activeIdx];
  const usable = usableMoves(me, dex.moves);
  if (!usable.length) return me.card.moves[0] ?? 'struggle';
  const threat = threatTo(me, foe, dex);
  const best = bestAttack(me, foe, dex);
  const outspeeds = speed(foe) > speed(me);
  // 익스트림: 상대가 먼저 움직여 나를 쓰러뜨릴 수 있으면 변화기는 의미가 없다
  const doomed = level === 'expert' && threat >= 1 && outspeeds;

  let pick = usable[0];
  let top = -Infinity;
  for (const id of usable) {
    const mv = dex.moves[id];
    let score: number;
    if (mv.category === 'status') {
      score = doomed ? -1 : statusValue(me, foe, mv, dex, threat, best);
    } else {
      const raw = expectedDamage(me, foe, mv, dex);
      const ko = raw >= foe.currentHp;
      if (raw === 0) score = -2;
      else if (ko) {
        // 쓰러뜨릴 수 있으면: 선공기 > (익스트림) 먼저 움직일 수 있는 기술 > 명중이 높은 기술
        const first = mv.priority > 0 || (level === 'expert' && !outspeeds);
        score = 10000 + (mv.priority > 0 ? 2000 : 0) + (first ? 500 : 0) + (mv.accuracy ?? 100);
      } else score = mv.effectId === 81 ? raw / 2 : raw;
    }
    if (score > top) {
      top = score;
      pick = id;
    }
  }
  return pick;
}

/** 어려움·익스트림 상대 행동 */
export function smartEnemyAction(state: BattleState, dex: Dex, level: Smart): BattleAction {
  return switchChoice(state, dex, level) ?? { kind: 'move', moveId: pickMove(state, dex, level) };
}
