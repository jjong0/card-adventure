// scripts/build-chapters.mjs
// overrides/chapters.json(수동 설정) + 하트골드 야생 출현 + trainers.json → src/data/chapters.json
// 실행: node scripts/build-chapters.mjs  (build-data, build-trainers, build-tm-compat 다음에 실행)
//
// 챕터마다 다음을 계산한다
//   wild          하트골드 풀숲·동굴 출현표 (spec §3.3)
//   packLevel     팩 카드 레벨 = 야생 최고 레벨 (spec §4.1, §12 기본값)
//   trainerLevel  일반 트레이너 풀의 파티 최고 레벨 범위 (spec §3.4)
//   trainers      그 범위의 일반 트레이너 (원본 번호)
//   rivals        플레이어 스타터 타입별 라이벌전 (원본 번호)
//   rewardTm      관장을 이기면 받는 기술머신 (tmCompat.json에서 기술 id를 찾음, 없으면 null)
//   levelBoost    야생 레벨 보정 (하트골드 관동은 야생이 관장보다 너무 낮다, overrides의 _note)
import { readFile, writeFile } from 'node:fs/promises';
import { csv } from './lib/pokeapi-csv.mjs';

const HEARTGOLD = '15';               // versions.csv
const METHODS = new Set(['walk']);    // 풀숲·동굴만. 낚시·파도타기는 비전머신이 필요해서 제외
// 라디오(호연·신오 사운드)와 대량발생은 특정 조작을 해야 나오는 출현이라 제외
const EXCLUDED_CONDITIONS = new Set(['radio-hoenn', 'radio-sinnoh', 'swarm-yes']);
const TIMES = ['time-morning', 'time-day', 'time-night']; // 같은 비중으로 평균

// 라이벌 스타터 계열 → 그 라이벌이 나오는 플레이어 스타터 타입 (라이벌이 상성 우위, spec §3.4)
const RIVAL_LINE_FOR_PLAYER = {
  grass: ['155', '156', '157'], // 내가 풀이면 라이벌은 브케인 계열
  fire: ['158', '159', '160'],  // 불꽃이면 리아코 계열
  water: ['152', '153', '154'], // 물이면 치코리타 계열
};

const config = JSON.parse(await readFile('src/data/overrides/chapters.json', 'utf8'));
const trainers = JSON.parse(await readFile('src/data/trainers.json', 'utf8'));
const species = JSON.parse(await readFile('src/data/species.json', 'utf8'));
const speciesName = Object.fromEntries(species.map((s) => [s.id, s.name]));
const tm = JSON.parse(await readFile('src/data/tmCompat.json', 'utf8'));

const [locations, areas, encounters, slots, methods, condMap, condValues, pokemon] = await Promise.all([
  csv('locations'), csv('location_areas'), csv('encounters'), csv('encounter_slots'),
  csv('encounter_methods'), csv('encounter_condition_value_map'), csv('encounter_condition_values'), csv('pokemon'),
]);

// ── 지역 식별자 → area id ──────────────────────
const locationSlug = Object.fromEntries(locations.map((l) => [l.id, l.identifier]));
const areaIdBySlug = {};
for (const a of areas) {
  const loc = locationSlug[a.location_id];
  areaIdBySlug[a.identifier ? `${loc}/${a.identifier}` : loc] = a.id;
}

const methodName = Object.fromEntries(methods.map((m) => [m.id, m.identifier]));
const slotById = Object.fromEntries(slots.map((s) => [s.id, s]));
const condName = Object.fromEntries(condValues.map((c) => [c.id, c.identifier]));
const condsOf = {};
for (const c of condMap) (condsOf[c.encounter_id] ??= []).push(condName[c.encounter_condition_value_id]);
const speciesOfPokemon = Object.fromEntries(pokemon.map((p) => [p.id, p.species_id]));
const encountersByArea = Object.groupBy(
  encounters.filter((e) => e.version_id === HEARTGOLD),
  (e) => e.location_area_id,
);

const warnings = [];

/** 한 지역의 출현표: speciesId → { weight(합 1), minLevel, maxLevel } */
function areaTable(slug) {
  const id = areaIdBySlug[slug];
  if (!id) throw new Error(`없는 지역 식별자: ${slug}`);
  const perTime = Object.fromEntries(TIMES.map((t) => [t, {}]));
  const levels = {};
  for (const e of encountersByArea[id] ?? []) {
    const slot = slotById[e.encounter_slot_id];
    if (!METHODS.has(methodName[slot.encounter_method_id])) continue;
    const conds = condsOf[e.id] ?? [];
    if (conds.some((c) => EXCLUDED_CONDITIONS.has(c))) continue;
    const times = conds.filter((c) => TIMES.includes(c));
    const sid = speciesOfPokemon[e.pokemon_id];
    for (const t of times.length ? times : TIMES) perTime[t][sid] = (perTime[t][sid] ?? 0) + Number(slot.rarity);
    const lv = (levels[sid] ??= { minLevel: Infinity, maxLevel: 0 });
    lv.minLevel = Math.min(lv.minLevel, Number(e.min_level));
    lv.maxLevel = Math.max(lv.maxLevel, Number(e.max_level));
  }
  const table = {};
  for (const t of TIMES) {
    const total = Object.values(perTime[t]).reduce((a, b) => a + b, 0);
    if (total !== 100) warnings.push(`${slug} ${t}: 출현 확률 합 ${total}% (100%가 아님)`);
    if (!total) continue;
    for (const [sid, r] of Object.entries(perTime[t])) {
      table[sid] ??= { weight: 0, ...levels[sid] };
      table[sid].weight += r / total / TIMES.length;
    }
  }
  if (!Object.keys(table).length) throw new Error(`출현 데이터 없음: ${slug}`);
  return table;
}

// ── 트레이너 레벨 범위 ─────────────────────────
const maxLevel = (t) => Math.max(...t.party.map((p) => p.level));
const leaders = trainers.filter((t) => t.battle === 'story' && t.chapter);
const aceOf = Object.fromEntries(leaders.map((t) => [t.chapter, maxLevel(t)]));

/**
 * (이전 관장 에이스, 이번 관장 에이스]. 류옹(7장, 34)처럼 이전 관장보다 에이스가 낮으면
 * 범위가 비므로, 이번 에이스보다 낮은 이전 에이스 중 가장 큰 값을 하한으로 쓴다.
 */
function trainerLevelRange(chapter) {
  const upTo = aceOf[chapter];
  const lower = Object.entries(aceOf)
    .filter(([c, ace]) => Number(c) < chapter && ace < upTo)
    .map(([, ace]) => ace);
  return { above: lower.length ? Math.max(...lower) : 0, upTo };
}

const inRange = (t, r) => maxLevel(t) > r.above && maxLevel(t) <= r.upTo;

/**
 * 트레이너 풀이 너무 작으면(관동 후반은 관장 에이스 사이가 1~2레벨이라 몇 명뿐) 같은 트레이너만 반복된다.
 * MIN_POOL명이 될 때까지 바로 아래 레벨의 트레이너를 더한다.
 */
const MIN_POOL = 12;
function trainerPool(range) {
  const pool = trainers.filter((t) => t.role === 'trainer' && inRange(t, range));
  if (pool.length >= MIN_POOL) return pool;
  const below = trainers
    .filter((t) => t.role === 'trainer' && maxLevel(t) <= range.above)
    .sort((a, b) => maxLevel(b) - maxLevel(a) || a.index - b.index)
    .slice(0, MIN_POOL - pool.length);
  return [...pool, ...below].sort((a, b) => a.index - b.index);
}

// 한 라이벌전은 한 챕터에서만 (관장 에이스 범위가 겹치는 챕터에서 같은 라이벌이 다시 나오지 않게)
const usedRivals = new Set();

// ── 챕터 생성 ─────────────────────────────────
const round = (x) => Math.round(x * 1000) / 10; // 0~1 → % (소수 첫째 자리)
const out = config.chapters.map((c) => {
  const leader = leaders.find((t) => t.key === c.leader);
  if (!leader) throw new Error(`없는 관장 키: ${c.leader}`);

  // 지역끼리 같은 비중으로 합친다
  const merged = {};
  for (const slug of c.areas) {
    for (const [sid, e] of Object.entries(areaTable(slug))) {
      const m = (merged[sid] ??= { speciesId: sid, minLevel: Infinity, maxLevel: 0, weight: 0 });
      m.weight += e.weight / c.areas.length;
      m.minLevel = Math.min(m.minLevel, e.minLevel);
      m.maxLevel = Math.max(m.maxLevel, e.maxLevel);
    }
  }
  const boost = c.levelBoost ?? 0;
  const wild = Object.values(merged)
    .map((m) => ({ ...m, minLevel: Math.min(100, m.minLevel + boost), maxLevel: Math.min(100, m.maxLevel + boost), weight: round(m.weight) }))
    .sort((a, b) => b.weight - a.weight);

  // 관장 보상 기술머신 (tm 번호 → 기술 id)
  // 사천왕·챔피언·레드는 원작에서 기술머신을 주지 않는다 (null)
  let rewardTm = null;
  if (c.rewardTm) {
    const machine = tm.machines.find((m) => m.id === c.rewardTm);
    if (!machine) throw new Error(`없는 기술머신: ${c.rewardTm}`);
    rewardTm = { id: machine.id, name: machine.name, moveId: machine.moveId };
  }

  const range = trainerLevelRange(c.chapter);
  const rivals = {};
  const markRivals = () => Object.keys(rivals).length === 3 && Object.values(rivals).forEach((i) => usedRivals.add(i));
  for (const [playerType, line] of Object.entries(RIVAL_LINE_FOR_PLAYER)) {
    // 범위 안의 라이벌전 중 가장 레벨이 높은 것 (같은 시점의 전투가 레벨만 조금 다른 경우가 있음)
    const pick = trainers
      .filter((t) => t.role === 'rival' && !usedRivals.has(t.index) && inRange(t, range) && t.party.some((p) => line.includes(p.speciesId)))
      .sort((a, b) => maxLevel(b) - maxLevel(a))[0];
    if (pick) rivals[playerType] = pick.index;
  }
  markRivals();

  return {
    chapter: c.chapter,
    place: c.place,
    type: c.type ?? null,
    leader: { key: leader.key, name: leader.name, trainerIndex: leader.index, aceLevel: aceOf[c.chapter] },
    areas: c.areas,
    wild,
    packLevel: Math.max(...wild.map((w) => w.maxLevel)),
    trainerLevel: range,
    trainers: trainerPool(range).map((t) => t.index),
    rivals: Object.keys(rivals).length === 3 ? rivals : null,
    rewardTm,
  };
});

await writeFile('src/data/chapters.json', JSON.stringify(out, null, 2) + '\n');

for (const c of out) {
  console.log(`${c.chapter}장 ${c.place} (${c.leader.name}, 에이스 Lv${c.leader.aceLevel}) 팩 Lv${c.packLevel} · 기술머신 ${c.rewardTm?.name ?? '없음'}`);
  console.log(`  야생 ${c.wild.length}종: ${c.wild.map((w) => `${speciesName[w.speciesId]} ${w.weight}% Lv${w.minLevel}-${w.maxLevel}`).join(', ')}`);
  console.log(`  트레이너 ${c.trainers.length}명 (파티 최고 Lv ${c.trainerLevel.above + 1}~${c.trainerLevel.upTo}), 라이벌 ${c.rivals ? JSON.stringify(c.rivals) : '없음'}`);
}
if (warnings.length) console.log(`경고 ${warnings.length}건\n  ${warnings.join('\n  ')}`);
