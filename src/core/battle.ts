// src/core/battle.ts
// 순수 전투 엔진: battle(state, action, dex) → 새 state
// 데미지 공식·랭크·급소·상태이상은 5세대 이후 원작 기준 (날씨·특성·도구·필드는 미구현)
import { effectiveIvs } from './card';
import { createRng } from './gacha';
import type {
  BattleAction, BattleEvent, BattleMon, BattleSide, BattleStat, BattleState, Card, Dex,
  ElementType, Move, MoveCategory, Side, Stats,
} from './types';

type Rng = () => number;

// ════════════════════════════════════════════
// 로그 조사 처리: "갸라도스은(는)" → "갸라도스는"
// ════════════════════════════════════════════

function jongseong(ch: string): number | null {
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return null; // 한글 음절 아님
  return code % 28; // 0 = 받침 없음, 8 = ㄹ
}

export function fixJosa(text: string): string {
  return text.replace(/(.)(은\(는\)|이\(가\)|을\(를\)|\(으\)로)/g, (_, prev: string, josa: string) => {
    const j = jongseong(prev);
    if (j === null) return prev + josa; // 영문·숫자 등은 그대로
    const has = j !== 0;
    switch (josa) {
      case '은(는)': return prev + (has ? '은' : '는');
      case '이(가)': return prev + (has ? '이' : '가');
      case '을(를)': return prev + (has ? '을' : '를');
      default: return prev + (has && j !== 8 ? '으로' : '로');
    }
  });
}

function finalize(state: BattleState): BattleState {
  state.log = state.log.map(fixJosa);
  state.events = state.events.map((e) => (e.type === 'message' ? { ...e, text: fixJosa(e.text) } : e));
  return state;
}

// ════════════════════════════════════════════
// 기록: 로그(누적)와 연출용 이벤트(이번 호출분)를 같은 순서로 쌓는다
// ════════════════════════════════════════════

interface Recorder {
  say(text: string): void;
  emit(e: BattleEvent): void;
  sideOf(mon: BattleMon): Side;
}

function recorder(state: BattleState): Recorder {
  return {
    say(text) {
      state.log.push(text);
      state.events.push({ type: 'message', text });
    },
    emit(e) {
      state.events.push(e);
    },
    sideOf(mon) {
      return state.player.party.includes(mon) ? 'player' : 'enemy';
    },
  };
}

/** HP 감소 + damage 이벤트. 실제로 깎인 양을 돌려준다 */
function hurt(rec: Recorder, mon: BattleMon, amount: number, effectiveness = 1, crit = false): number {
  const from = mon.currentHp;
  const to = Math.max(0, from - amount);
  mon.currentHp = to;
  rec.emit({ type: 'damage', side: rec.sideOf(mon), from, to, effectiveness, crit });
  return from - to;
}

/** HP 회복 + heal 이벤트 (변화가 없으면 이벤트 없음) */
function heal(rec: Recorder, mon: BattleMon, amount: number) {
  const from = mon.currentHp;
  const to = Math.min(mon.stats.hp, from + amount);
  mon.currentHp = to;
  if (to !== from) rec.emit({ type: 'heal', side: rec.sideOf(mon), from, to });
}

// ════════════════════════════════════════════
// 능력치
// ════════════════════════════════════════════

/** 실능력치 (노력치 0, 성격 보정 없음) */
export function calcStats(base: Stats, ivs: Stats, level: number): Stats {
  const other = (b: number, iv: number) => Math.floor(((2 * b + iv) * level) / 100) + 5;
  return {
    hp: base.hp === 1 ? 1 : Math.floor(((2 * base.hp + ivs.hp) * level) / 100) + level + 10, // 껍질몬 HP 1 고정
    atk: other(base.atk, ivs.atk),
    def: other(base.def, ivs.def),
    spAtk: other(base.spAtk, ivs.spAtk),
    spDef: other(base.spDef, ivs.spDef),
    spd: other(base.spd, ivs.spd),
  };
}

const ZERO_STAGES: Record<BattleStat, number> = {
  atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0, accuracy: 0, evasion: 0,
};

export function createBattleMon(card: Card, dex: Dex): BattleMon {
  const sp = dex.species[card.speciesId];
  const stats = calcStats(sp.baseStats, effectiveIvs(card), card.level);
  return {
    card,
    name: sp.name,
    types: sp.types,
    weight: sp.weight,
    stats,
    currentHp: stats.hp,
    pp: Object.fromEntries(card.moves.map((id) => [id, dex.moves[id]?.pp ?? 0])),
    ailment: 'none',
    sleepTurns: 0,
    toxicCounter: 0,
    confusedTurns: 0,
    flinched: false,
    stages: { ...ZERO_STAGES },
    lastHit: null,
    facedBy: [],
  };
}

/** 지금 마주한 두 포켓몬을 서로의 facedBy에 기록 (경험치 분배용, 쓰러진 쪽은 제외) */
function markFaced(state: BattleState) {
  const p = active(state.player);
  const e = active(state.enemy);
  if (p.currentHp <= 0 || e.currentHp <= 0) return;
  if (!e.facedBy.includes(state.player.activeIdx)) e.facedBy.push(state.player.activeIdx);
  if (!p.facedBy.includes(state.enemy.activeIdx)) p.facedBy.push(state.enemy.activeIdx);
}

export function createBattle(playerCards: Card[], enemyCards: Card[], dex: Dex, seed: number): BattleState {
  const player = playerCards.map((c) => createBattleMon(c, dex));
  const enemy = enemyCards.map((c) => createBattleMon(c, dex));
  const state: BattleState = {
    turn: 1,
    seed,
    player: { party: player, activeIdx: 0 },
    enemy: { party: enemy, activeIdx: 0 },
    log: [],
    events: [],
    knockouts: [],
    pendingSwitch: false,
    result: 'ongoing',
  };
  markFaced(state);
  const rec = recorder(state);
  rec.emit({ type: 'switchIn', side: 'enemy', idx: 0 });
  rec.say(`상대가 ${enemy[0].name}을(를) 내보냈다!`);
  rec.emit({ type: 'switchIn', side: 'player', idx: 0 });
  rec.say(`가랏! ${player[0].name}!`);
  return finalize(state);
}

/** 랭크 배율: 능력치 2/2 기준, 명중·회피 3/3 기준 */
function stageMult(stage: number, base = 2) {
  return stage >= 0 ? (base + stage) / base : base / (base - stage);
}

function effectiveSpeed(mon: BattleMon) {
  let spd = Math.floor(mon.stats.spd * stageMult(mon.stages.spd));
  if (mon.ailment === 'paralysis') spd = Math.floor(spd / 2); // 7세대~: 1/2
  return spd;
}

// ════════════════════════════════════════════
// 데미지 공식
// ════════════════════════════════════════════

/** 원작 보정 반올림: 0.5는 내림 */
function pokeRound(x: number) {
  return x % 1 > 0.5 ? Math.ceil(x) : Math.floor(x);
}

export function typeEffectiveness(moveType: ElementType, defTypes: ElementType[], dex: Dex) {
  return defTypes.reduce((m, t) => m * (dex.typeChart[moveType]?.[t] ?? 1), 1);
}

export interface DamageInput {
  level: number;
  power: number;
  attack: number;      // 랭크 반영 후
  defense: number;     // 랭크 반영 후
  stab: boolean;
  effectiveness: number;
  crit: boolean;
  burned: boolean;     // 화상 + 물리기
  randomRoll: number;  // 85~100
}

/**
 * 데미지 = ((2×Lv/5+2) × 위력 × A/D / 50 + 2) × 급소 × 난수 × 자속 × 상성 × 화상
 * 적용 순서와 내림/반올림은 원작과 동일
 */
export function calcDamage(i: DamageInput): number {
  if (i.effectiveness === 0) return 0;
  let d = Math.floor(Math.floor((Math.floor((2 * i.level) / 5 + 2) * i.power * i.attack) / i.defense) / 50) + 2;
  if (i.crit) d = pokeRound(d * 1.5);
  d = Math.floor((d * i.randomRoll) / 100);
  if (i.stab) d = pokeRound(d * 1.5);
  d = Math.floor(d * i.effectiveness);
  if (i.burned) d = pokeRound(d * 0.5);
  return Math.max(1, d);
}

/** 급소 확률: 랭크 0 1/24, 1 1/8, 2 1/2, 3+ 확정 */
const CRIT_CHANCE = [1 / 24, 1 / 8, 1 / 2, 1];

// ════════════════════════════════════════════
// 위력 가변 기술 (effectId 기준)
// ════════════════════════════════════════════

const EFFECT = {
  OHKO: 39,
  LEVEL_DAMAGE: 88,       // 지구던지기, 나이트헤드
  HALF_HP: 41,            // 분노의앞니, 자연의분노
  COUNTER: 90,
  MIRROR_COAT: 145,
  METAL_BURST: 228,
  FLAIL: 100,             // 바둥바둥, 기사회생
  PRESENT: 123,
  ENDEAVOR: 190,
  GYRO_BALL: 220,
  ELECTRO_BALL: 294,
  WEIGHT_TARGET: 197,     // 안다리걸기, 풀묶기
  WEIGHT_RATIO: 292,      // 헤비봄버, 히트스탬프
  CRUSH_GRIP: 238,        // 묵사발
  FINAL_GAMBIT: 321,
  TOXIC: 34,              // 맹독 (meta.ailment는 poison으로 들어옴)
} as const;

type VariableResult =
  | { kind: 'power'; power: number }
  | { kind: 'fixed'; damage: number }   // 상성 무효만 적용, 나머지 보정 없음
  | { kind: 'heal'; amount: number }
  | { kind: 'fail'; reason: string };

function variablePower(move: Move, user: BattleMon, target: BattleMon, rng: Rng): VariableResult {
  switch (move.effectId) {
    case EFFECT.LEVEL_DAMAGE:
      return { kind: 'fixed', damage: user.card.level };
    case EFFECT.HALF_HP:
      return { kind: 'fixed', damage: Math.max(1, Math.floor(target.currentHp / 2)) };
    case EFFECT.ENDEAVOR:
      return target.currentHp > user.currentHp
        ? { kind: 'fixed', damage: target.currentHp - user.currentHp }
        : { kind: 'fail', reason: '하지만 실패했다!' };
    case EFFECT.FINAL_GAMBIT:
      return { kind: 'fixed', damage: user.currentHp };
    case EFFECT.COUNTER:
    case EFFECT.MIRROR_COAT:
    case EFFECT.METAL_BURST: {
      const need: MoveCategory | null =
        move.effectId === EFFECT.COUNTER ? 'physical' : move.effectId === EFFECT.MIRROR_COAT ? 'special' : null;
      const hit = user.lastHit;
      if (!hit || hit.damage === 0 || (need && hit.category !== need)) return { kind: 'fail', reason: '하지만 실패했다!' };
      return { kind: 'fixed', damage: Math.floor(hit.damage * (need ? 2 : 1.5)) };
    }
    case EFFECT.FLAIL: {
      const p = Math.floor((48 * user.currentHp) / user.stats.hp);
      return { kind: 'power', power: p <= 1 ? 200 : p <= 4 ? 150 : p <= 9 ? 100 : p <= 16 ? 80 : p <= 32 ? 40 : 20 };
    }
    case EFFECT.GYRO_BALL:
      return { kind: 'power', power: Math.min(150, Math.floor((25 * effectiveSpeed(target)) / Math.max(1, effectiveSpeed(user))) + 1) };
    case EFFECT.ELECTRO_BALL: {
      const r = effectiveSpeed(user) / Math.max(1, effectiveSpeed(target));
      return { kind: 'power', power: r >= 4 ? 150 : r >= 3 ? 120 : r >= 2 ? 80 : r >= 1 ? 60 : 40 };
    }
    case EFFECT.WEIGHT_TARGET: {
      const w = target.weight;
      return { kind: 'power', power: w >= 200 ? 120 : w >= 100 ? 100 : w >= 50 ? 80 : w >= 25 ? 60 : w >= 10 ? 40 : 20 };
    }
    case EFFECT.WEIGHT_RATIO: {
      const r = user.weight / target.weight;
      return { kind: 'power', power: r >= 5 ? 120 : r >= 4 ? 100 : r >= 3 ? 80 : r >= 2 ? 60 : 40 };
    }
    case EFFECT.CRUSH_GRIP:
      return { kind: 'power', power: Math.max(1, Math.floor((120 * target.currentHp) / target.stats.hp)) };
    case EFFECT.PRESENT: {
      const r = rng();
      if (r < 0.4) return { kind: 'power', power: 40 };
      if (r < 0.7) return { kind: 'power', power: 80 };
      if (r < 0.8) return { kind: 'power', power: 120 };
      return { kind: 'heal', amount: Math.floor(target.stats.hp / 4) };
    }
    default:
      // 참기, 집단구타, 토해내기, 자연의은혜, 내던지기: 아이템/누적 시스템 필요
      return { kind: 'fail', reason: '(아직 구현되지 않은 기술이다)' };
  }
}

// ════════════════════════════════════════════
// 상태이상
// ════════════════════════════════════════════

const STAT_LABEL: Record<BattleStat, string> = {
  atk: '공격', def: '방어', spAtk: '특수공격', spDef: '특수방어', spd: '스피드', accuracy: '명중률', evasion: '회피율',
};
const AILMENT_LABEL = {
  paralysis: '마비되어 기술이 나오기 어려워졌다!',
  sleep: '잠들어 버렸다!',
  freeze: '얼어붙었다!',
  burn: '화상을 입었다!',
  poison: '독에 걸렸다!',
  toxic: '맹독을 입었다!',
} as const;

type MajorAilment = keyof typeof AILMENT_LABEL;

function immuneToAilment(mon: BattleMon, a: MajorAilment) {
  const t = mon.types;
  if (a === 'burn') return t.includes('fire');
  if (a === 'paralysis') return t.includes('electric');
  if (a === 'freeze') return t.includes('ice');
  if (a === 'poison' || a === 'toxic') return t.includes('poison') || t.includes('steel');
  return false;
}

/** 성공하면 true */
function inflictAilment(target: BattleMon, a: MajorAilment, rng: Rng, rec: Recorder, silentFail: boolean): boolean {
  if (target.currentHp <= 0) return false;
  if (target.ailment !== 'none' || immuneToAilment(target, a)) {
    if (!silentFail) rec.say(`하지만 ${target.name}에게는 효과가 없는 것 같다...`);
    return false;
  }
  target.ailment = a;
  if (a === 'sleep') target.sleepTurns = 1 + Math.floor(rng() * 3); // 1~3턴
  if (a === 'toxic') target.toxicCounter = 0;
  rec.emit({ type: 'status', side: rec.sideOf(target), ailment: a });
  rec.say(`${target.name}은(는) ${AILMENT_LABEL[a]}`);
  return true;
}

function inflictConfusion(target: BattleMon, rng: Rng, rec: Recorder, silentFail: boolean) {
  if (target.currentHp <= 0) return;
  if (target.confusedTurns > 0) {
    if (!silentFail) rec.say(`${target.name}은(는) 이미 혼란에 빠져 있다!`);
    return;
  }
  target.confusedTurns = 2 + Math.floor(rng() * 4); // 2~5턴
  rec.say(`${target.name}은(는) 혼란에 빠졌다!`);
}

function changeStage(mon: BattleMon, stat: BattleStat, delta: number, rec: Recorder) {
  if (mon.currentHp <= 0) return;
  const before = mon.stages[stat];
  const after = Math.max(-6, Math.min(6, before + delta));
  if (after === before) {
    rec.say(`${mon.name}의 ${STAT_LABEL[stat]}은(는) 더 이상 ${delta > 0 ? '올라가지' : '떨어지지'} 않는다!`);
    return;
  }
  mon.stages[stat] = after;
  rec.emit({ type: 'stage', side: rec.sideOf(mon), stat, delta: after - before });
  const amount = Math.abs(after - before);
  const word = delta > 0
    ? amount >= 3 ? '극적으로 올라갔다!' : amount === 2 ? '크게 올라갔다!' : '올라갔다!'
    : amount >= 3 ? '매우 크게 떨어졌다!' : amount === 2 ? '크게 떨어졌다!' : '떨어졌다!';
  rec.say(`${mon.name}의 ${STAT_LABEL[stat]}이(가) ${word}`);
}

/** 행동 전 체크: 행동 가능하면 true */
function canAct(mon: BattleMon, move: Move, rng: Rng, rec: Recorder): boolean {
  if (mon.ailment === 'sleep') {
    if (mon.sleepTurns > 0) {
      mon.sleepTurns--;
      rec.say(`${mon.name}은(는) 쿨쿨 잠들어 있다.`);
      return false;
    }
    mon.ailment = 'none';
    rec.emit({ type: 'status', side: rec.sideOf(mon), ailment: 'none' });
    rec.say(`${mon.name}은(는) 잠에서 깨어났다!`);
  }
  if (mon.ailment === 'freeze') {
    const thawingMove = move.type === 'fire' && move.category !== 'status';
    if (thawingMove || rng() < 0.2) {
      mon.ailment = 'none';
      rec.emit({ type: 'status', side: rec.sideOf(mon), ailment: 'none' });
      rec.say(`${mon.name}의 얼음이 녹았다!`);
    } else {
      rec.say(`${mon.name}은(는) 얼어버려서 움직일 수 없다!`);
      return false;
    }
  }
  if (mon.flinched) {
    rec.say(`${mon.name}은(는) 풀이 죽어 기술을 쓸 수 없었다!`);
    return false;
  }
  if (mon.confusedTurns > 0) {
    mon.confusedTurns--;
    if (mon.confusedTurns === 0) {
      rec.say(`${mon.name}의 혼란이 풀렸다!`);
    } else {
      rec.say(`${mon.name}은(는) 혼란에 빠져 있다!`);
      if (rng() < 1 / 3) {
        const dmg = calcDamage({
          level: mon.card.level, power: 40,
          attack: Math.floor(mon.stats.atk * stageMult(mon.stages.atk)),
          defense: Math.floor(mon.stats.def * stageMult(mon.stages.def)),
          stab: false, effectiveness: 1, crit: false, burned: false,
          randomRoll: 85 + Math.floor(rng() * 16),
        });
        hurt(rec, mon, dmg);
        rec.say('영문도 모른 채 자신을 공격했다!');
        return false;
      }
    }
  }
  if (mon.ailment === 'paralysis' && rng() < 0.25) {
    rec.say(`${mon.name}은(는) 몸이 저려서 움직일 수 없다!`);
    return false;
  }
  return true;
}

// ════════════════════════════════════════════
// 기술 실행
// ════════════════════════════════════════════

/** PP가 모두 떨어졌을 때 쓰는 발버둥 (타입 없음, 위력 50, 최대 HP 1/4 반동) */
const STRUGGLE: Move = {
  id: 'struggle', name: '발버둥', slug: 'struggle', type: 'normal', category: 'physical',
  power: 50, variablePower: false, accuracy: null, pp: 1, priority: 0, target: 'selected-pokemon',
  effectId: null, effectChance: null, meta: null, description: '', descriptionLang: 'ko',
};

const SELF_TARGETS = new Set(['user', 'users-field', 'user-or-ally', 'user-and-allies', 'all-allies']);
const UNSUPPORTED_STATUS = new Set(['unique', 'field-effect', 'whole-field-effect', 'force-switch']);

function accuracyCheck(move: Move, user: BattleMon, target: BattleMon, rng: Rng): boolean {
  if (move.accuracy === null) return true;
  if (move.meta?.category === 'ohko') {
    if (user.card.level < target.card.level) return false;
    return rng() * 100 < move.accuracy + (user.card.level - target.card.level);
  }
  const stage = Math.max(-6, Math.min(6, user.stages.accuracy - target.stages.evasion));
  return rng() * 100 < move.accuracy * stageMult(stage, 3);
}

function applyMoveAilment(move: Move, target: BattleMon, rng: Rng, rec: Recorder, fromDamage: boolean) {
  const meta = move.meta;
  if (!meta || meta.ailment === 'none') return;
  const chance = meta.ailmentChance || 100; // 0 = 확정
  if (rng() * 100 >= chance) return;
  const silent = fromDamage; // 추가효과 실패는 메시지 없음
  if (meta.ailment === 'confusion') return inflictConfusion(target, rng, rec, silent);
  if (meta.ailment === 'poison' && move.effectId === EFFECT.TOXIC) return void inflictAilment(target, 'toxic', rng, rec, silent);
  if (meta.ailment in AILMENT_LABEL) return void inflictAilment(target, meta.ailment as MajorAilment, rng, rec, silent);
  if (!fromDamage) rec.say('(아직 구현되지 않은 효과다)');
}

function applyStatChanges(move: Move, user: BattleMon, target: BattleMon, rng: Rng, rec: Recorder, fromDamage: boolean) {
  const meta = move.meta;
  if (!meta?.statChanges.length) return;
  const chance = meta.statChance || 100;
  if (rng() * 100 >= chance) return;
  // 데미지기: 'damage-raise'는 자신의 능력 변화(인파이트·오버히트의 하락 포함), 그 외는 상대
  // 변화기: target 필드 기준
  const who = fromDamage
    ? meta.category === 'damage-raise' ? user : target
    : SELF_TARGETS.has(move.target) ? user : target;
  for (const { stat, change } of meta.statChanges) changeStage(who, stat, change, rec);
}

function useMove(state: BattleState, side: Side, moveId: string, dex: Dex, rng: Rng, rec: Recorder) {
  const userSide = state[side];
  const targetSide = state[side === 'player' ? 'enemy' : 'player'];
  const user = userSide.party[userSide.activeIdx];
  const target = targetSide.party[targetSide.activeIdx];

  const hasPp = Object.values(user.pp).some((p) => p > 0);
  const move = hasPp ? dex.moves[moveId] : STRUGGLE;
  if (!move) return;
  if (hasPp && (user.pp[moveId] ?? 0) <= 0) {
    rec.say(`${move.name}의 PP가 없다!`);
    return;
  }

  if (!canAct(user, move, rng, rec)) return;
  if (hasPp) user.pp[moveId]--;
  if (!hasPp) rec.say(`${user.name}은(는) 쓸 수 있는 기술이 없다!`);
  rec.emit({ type: 'move', side, moveId: move.id });
  rec.say(`${user.name}의 ${move.name}!`);

  const selfTarget = SELF_TARGETS.has(move.target);

  // ── 변화기 ──
  if (move.category === 'status') {
    const meta = move.meta;
    if (!meta || UNSUPPORTED_STATUS.has(meta.category)) {
      rec.say('(아직 구현되지 않은 효과다)');
      return;
    }
    if (!selfTarget && target.currentHp <= 0) return void rec.say('하지만 실패했다!');
    if (!selfTarget && !accuracyCheck(move, user, target, rng)) return void rec.say(`${target.name}에게는 맞지 않았다!`);
    // 전기 변화기(전기자석파 등)는 땅 타입에 무효
    if (!selfTarget && move.type === 'electric' && target.types.includes('ground')) {
      return void rec.say(`${target.name}에게는 효과가 없는 것 같다...`);
    }
    if (meta.category === 'heal') {
      const who = selfTarget ? user : target;
      if (who.currentHp >= who.stats.hp) return void rec.say(`${who.name}의 체력은 가득 차 있다!`);
      heal(rec, who, Math.floor((who.stats.hp * meta.healing) / 100));
      rec.say(`${who.name}의 체력이 회복되었다!`);
      return;
    }
    if (meta.category === 'swagger') {
      applyStatChanges(move, user, target, rng, rec, false);
      inflictConfusion(target, rng, rec, false);
      return;
    }
    applyStatChanges(move, user, target, rng, rec, false);
    applyMoveAilment(move, target, rng, rec, false);
    return;
  }

  // ── 공격기 ──
  if (target.currentHp <= 0) return void rec.say('하지만 실패했다!');
  if (!accuracyCheck(move, user, target, rng)) return void rec.say(`${target.name}에게는 맞지 않았다!`);

  const effectiveness = typeEffectiveness(move.type, target.types, dex);
  const isStruggle = move === STRUGGLE;
  if (!isStruggle && effectiveness === 0) return void rec.say(`${target.name}에게는 효과가 없는 것 같다...`);

  // 일격필살
  if (move.meta?.category === 'ohko') {
    target.lastHit = { damage: target.currentHp, category: move.category };
    hurt(rec, target, target.currentHp, effectiveness);
    rec.say('일격필살!');
    return;
  }

  let power = move.power ?? 0;
  if (move.variablePower) {
    const r = variablePower(move, user, target, rng);
    if (r.kind === 'fail') return void rec.say(r.reason);
    if (r.kind === 'heal') {
      heal(rec, target, r.amount);
      return void rec.say(`${target.name}의 체력이 회복되었다!`);
    }
    if (r.kind === 'fixed') {
      const dmg = hurt(rec, target, r.damage);
      target.lastHit = { damage: dmg, category: move.category };
      if (move.effectId === EFFECT.FINAL_GAMBIT) hurt(rec, user, user.currentHp);
      return;
    }
    power = r.power;
  }

  // 연속기 횟수: 2~5회는 35/35/15/15%
  const meta = move.meta;
  let hits = 1;
  if (meta?.minHits && meta.maxHits) {
    if (meta.minHits === 2 && meta.maxHits === 5) {
      const r = rng();
      hits = r < 0.35 ? 2 : r < 0.7 ? 3 : r < 0.85 ? 4 : 5;
    } else {
      hits = meta.minHits + Math.floor(rng() * (meta.maxHits - meta.minHits + 1));
    }
  }

  const physical = move.category === 'physical';
  const atkKey = physical ? 'atk' : 'spAtk';
  const defKey = physical ? 'def' : 'spDef';
  const critStage = Math.min(3, meta?.critRate ?? 0);

  let total = 0;
  let landed = 0;
  for (let h = 0; h < hits && target.currentHp > 0; h++) {
    const crit = rng() < CRIT_CHANCE[critStage];
    // 급소: 공격 측 하락 랭크, 방어 측 상승 랭크 무시
    const aStage = crit ? Math.max(0, user.stages[atkKey]) : user.stages[atkKey];
    const dStage = crit ? Math.min(0, target.stages[defKey]) : target.stages[defKey];
    const dmg = calcDamage({
      level: user.card.level,
      power,
      attack: Math.floor(user.stats[atkKey] * stageMult(aStage)),
      defense: Math.floor(target.stats[defKey] * stageMult(dStage)),
      stab: !isStruggle && user.types.includes(move.type),
      effectiveness: isStruggle ? 1 : effectiveness,
      crit,
      burned: physical && user.ailment === 'burn',
      randomRoll: 85 + Math.floor(rng() * 16),
    });
    total += hurt(rec, target, dmg, isStruggle ? 1 : effectiveness, crit);
    landed++;
    if (crit) rec.say('급소에 맞았다!');
  }
  target.lastHit = { damage: total, category: move.category };

  if (!isStruggle) {
    if (effectiveness > 1) rec.say('효과가 굉장했다!');
    else if (effectiveness < 1) rec.say('효과가 별로인 듯하다...');
  }
  if (hits > 1) rec.say(`${landed}번 맞았다!`);

  // 흡수 / 반동
  if (isStruggle) {
    hurt(rec, user, Math.max(1, Math.floor(user.stats.hp / 4)));
    rec.say(`${user.name}은(는) 반동으로 데미지를 입었다!`);
  } else if (meta?.drain) {
    const amount = Math.max(1, Math.floor((total * Math.abs(meta.drain)) / 100));
    if (meta.drain > 0) {
      heal(rec, user, amount);
      rec.say(`${target.name}(으)로부터 체력을 흡수했다!`);
    } else {
      hurt(rec, user, amount);
      rec.say(`${user.name}은(는) 반동으로 데미지를 입었다!`);
    }
  }

  // 추가 효과 (상대가 쓰러졌으면 상대 대상 효과는 무시됨)
  if (meta) {
    applyMoveAilment(move, target, rng, rec, true);
    applyStatChanges(move, user, target, rng, rec, true);
    if (meta.flinchChance && target.currentHp > 0 && rng() * 100 < meta.flinchChance) target.flinched = true;
    if (meta.category === 'damage-heal' && meta.healing) {
      heal(rec, user, Math.floor((user.stats.hp * meta.healing) / 100));
    }
  }
}

// ════════════════════════════════════════════
// 턴 진행
// ════════════════════════════════════════════

function active(side: BattleSide) {
  return side.party[side.activeIdx];
}

function firstAlive(side: BattleSide) {
  return side.party.findIndex((m) => m.currentHp > 0);
}

function switchIn(side: BattleSide, idx: number, who: Side, rec: Recorder) {
  const out = active(side);
  // 교체 시 랭크·혼란 초기화 (상태이상은 유지, 맹독 카운트는 초기화)
  out.stages = { ...ZERO_STAGES };
  out.confusedTurns = 0;
  out.toxicCounter = 0;
  side.activeIdx = idx;
  rec.emit({ type: 'switchIn', side: who, idx });
  const name = side.party[idx].name;
  rec.say(who === 'player' ? `가랏! ${name}!` : `상대는 ${name}을(를) 내보냈다!`);
}

function endOfTurnDamage(mon: BattleMon, rec: Recorder) {
  if (mon.currentHp <= 0) return;
  let dmg = 0;
  if (mon.ailment === 'burn') {
    dmg = Math.floor(mon.stats.hp / 16);
    rec.say(`${mon.name}은(는) 화상 데미지를 입었다!`);
  } else if (mon.ailment === 'poison') {
    dmg = Math.floor(mon.stats.hp / 8);
    rec.say(`${mon.name}은(는) 독 데미지를 입었다!`);
  } else if (mon.ailment === 'toxic') {
    mon.toxicCounter = Math.min(15, mon.toxicCounter + 1);
    dmg = Math.floor((mon.stats.hp * mon.toxicCounter) / 16);
    rec.say(`${mon.name}은(는) 독 데미지를 입었다!`);
  }
  if (dmg) hurt(rec, mon, Math.max(1, dmg));
}

/** 쓰러짐 처리. 상대는 자동 교체, 플레이어는 pendingSwitch */
function resolveFaints(state: BattleState, rec: Recorder) {
  for (const who of ['enemy', 'player'] as const) {
    const side = state[who];
    const mon = active(side);
    if (mon.currentHp > 0) continue;
    if (who === 'player' && state.pendingSwitch) continue; // 이미 처리됨
    rec.emit({ type: 'faint', side: who });
    rec.say(`${who === 'enemy' ? '상대 ' : ''}${mon.name}은(는) 쓰러졌다!`);
    // 4세대: 쓰러뜨린 시점에 살아 있는, 그 포켓몬과 싸운 아군만 경험치를 나눠 받는다
    if (who === 'enemy') {
      const participants = mon.facedBy.filter((i) => state.player.party[i].currentHp > 0);
      state.knockouts.push({ enemyIdx: side.activeIdx, participants });
    }
    const next = firstAlive(side);
    if (next === -1) {
      state.result = who === 'enemy' ? 'win' : 'lose';
      rec.say(who === 'enemy' ? '승리했다!' : '눈앞이 깜깜해졌다...');
      return;
    }
    if (who === 'enemy') {
      switchIn(side, next, 'enemy', rec);
      markFaced(state);
    } else state.pendingSwitch = true;
  }
}

type Resolved = { side: Side; action: BattleAction };

function priorityOf(r: Resolved, dex: Dex) {
  if (r.action.kind === 'switch') return 7; // 교체는 항상 먼저
  return dex.moves[r.action.moveId]?.priority ?? 0;
}

/**
 * 한 턴 진행. 플레이어 행동을 받아 상대 AI 행동과 함께 처리.
 * pendingSwitch 상태에서는 교체만 받으며 턴이 소모되지 않음.
 * 무효한 행동이면 prev를 그대로 돌려준다 (UI는 참조가 같으면 events를 다시 재생하지 않는다).
 */
export function battle(prev: BattleState, action: BattleAction, dex: Dex): BattleState {
  if (prev.result !== 'ongoing') return prev;
  const state: BattleState = structuredClone(prev);
  const rng = createRng(state.seed);
  state.events = [];
  const rec = recorder(state);

  if (state.pendingSwitch) {
    if (action.kind !== 'switch' || state.player.party[action.toIdx]?.currentHp <= 0) return prev;
    state.player.activeIdx = action.toIdx;
    rec.emit({ type: 'switchIn', side: 'player', idx: action.toIdx });
    rec.say(`가랏! ${active(state.player).name}!`);
    state.pendingSwitch = false;
    markFaced(state);
    state.seed = Math.floor(rng() * 2 ** 32);
    return finalize(state);
  }

  if (action.kind === 'switch') {
    const t = state.player.party[action.toIdx];
    if (!t || t.currentHp <= 0 || action.toIdx === state.player.activeIdx) return prev;
  }

  for (const m of [active(state.player), active(state.enemy)]) {
    m.flinched = false;
    m.lastHit = null;
  }

  const order: Resolved[] = [
    { side: 'player', action },
    { side: 'enemy', action: chooseEnemyAction(state, dex) },
  ];
  order.sort((a, b) => {
    const p = priorityOf(b, dex) - priorityOf(a, dex);
    if (p) return p;
    const s = effectiveSpeed(active(state[b.side])) - effectiveSpeed(active(state[a.side]));
    return s || (rng() < 0.5 ? -1 : 1); // 동속은 랜덤
  });

  // 행동 순서 결정 시점의 포켓몬. 중간에 쓰러져 교체되면 새 포켓몬은 이번 턴 행동하지 않음
  const actors = order.map((o) => active(state[o.side]));

  rec.say(`── ${state.turn}턴 ──`);
  for (const [i, { side, action: act }] of order.entries()) {
    if (state.result !== 'ongoing') break;
    const me = active(state[side]);
    if (me !== actors[i] || me.currentHp <= 0) continue;
    if (act.kind === 'switch') switchIn(state[side], act.toIdx, side, rec);
    else useMove(state, side, act.moveId, dex, rng, rec);
    markFaced(state);
    // 행동 중 쓰러진 쪽 확인 (상대 쓰러지면 남은 행동 생략)
    if (active(state.player).currentHp <= 0 || active(state.enemy).currentHp <= 0) {
      resolveFaints(state, rec);
      if (state.result !== 'ongoing' || state.pendingSwitch) break;
    }
  }

  if (state.result === 'ongoing') {
    endOfTurnDamage(active(state.player), rec);
    endOfTurnDamage(active(state.enemy), rec);
    resolveFaints(state, rec);
  }

  state.turn++;
  state.seed = Math.floor(rng() * 2 ** 32);
  return finalize(state);
}

// ════════════════════════════════════════════
// 상대 AI: 기대 데미지가 가장 높은 기술 (상대를 쓰러뜨릴 수 있으면 우선)
// ════════════════════════════════════════════

export function chooseEnemyAction(state: BattleState, dex: Dex): BattleAction {
  const me = active(state.enemy);
  const foe = active(state.player);
  const usable = me.card.moves.filter((id) => (me.pp[id] ?? 0) > 0 && dex.moves[id]);
  if (!usable.length) return { kind: 'move', moveId: me.card.moves[0] ?? 'struggle' };

  let best = usable[0];
  let bestScore = -1;
  for (const id of usable) {
    const mv = dex.moves[id];
    let score: number;
    if (mv.category === 'status') {
      // 변화기는 낮은 점수, 상대가 이미 상태이상이면 상태이상기는 0
      const wasted = mv.meta?.ailment !== 'none' && foe.ailment !== 'none';
      score = wasted ? 0 : 15;
    } else {
      const power = mv.power ?? 60;
      const physical = mv.category === 'physical';
      const eff = typeEffectiveness(mv.type, foe.types, dex);
      const expected = calcDamage({
        level: me.card.level, power,
        attack: me.stats[physical ? 'atk' : 'spAtk'],
        defense: foe.stats[physical ? 'def' : 'spDef'],
        stab: me.types.includes(mv.type), effectiveness: eff,
        crit: false, burned: physical && me.ailment === 'burn', randomRoll: 92,
      }) * ((mv.accuracy ?? 100) / 100);
      score = expected >= foe.currentHp ? 10000 + expected : expected;
    }
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return { kind: 'move', moveId: best };
}
