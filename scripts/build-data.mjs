// scripts/build-data.mjs
// PokeAPI CSV → src/data/{species,typeChart,moves,learnsets}.json
// 실행: node scripts/build-data.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { csv, KO, num } from './lib/pokeapi-csv.mjs';

// 한국어 설명이 없는 기술의 직접 번역 (slug → 설명)
const descOverrides = JSON.parse(await readFile('src/data/overrides/move-desc-ko.json', 'utf8'));

const MAX_SPECIES = 1025;
const TYPE_COUNT = 18;
const TACKLE = '33';
// 레벨업 기술 기준 버전그룹: 최신 본가 우선 (아르세우스/Z-A/레츠고/챔피언스 제외)
const VG_PRIORITY = [25, 20, 23, 18, 17, 16, 15, 14, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const LEVEL_UP = '1';

const CATEGORY = { 1: 'status', 2: 'physical', 3: 'special' };
const STAT_KEY = { 1: 'hp', 2: 'atk', 3: 'def', 4: 'spAtk', 5: 'spDef', 6: 'spd', 7: 'accuracy', 8: 'evasion' };
const META_CATEGORY = {
  0: 'damage', 1: 'ailment', 2: 'net-good-stats', 3: 'heal', 4: 'damage-ailment', 5: 'swagger',
  6: 'damage-lower', 7: 'damage-raise', 8: 'damage-heal', 9: 'ohko', 10: 'whole-field-effect',
  11: 'field-effect', 12: 'force-switch', 13: 'unique',
};
const TARGET = {
  1: 'specific-move', 2: 'selected-pokemon-me-first', 3: 'ally', 4: 'users-field', 5: 'user-or-ally',
  6: 'opponents-field', 7: 'user', 8: 'random-opponent', 9: 'all-other-pokemon', 10: 'selected-pokemon',
  11: 'all-opponents', 12: 'entire-field', 13: 'user-and-allies', 14: 'all-pokemon', 15: 'all-allies',
  16: 'fainting-pokemon',
};

const groupBy = (arr, key) =>
  arr.reduce((m, x) => ((m[x[key]] ??= []).push(x), m), {});

const T = Object.fromEntries(
  await Promise.all(
    [
      'pokemon_species', 'pokemon', 'pokemon_stats', 'pokemon_types', 'types', 'pokemon_species_names',
      'type_efficacy', 'moves', 'move_names', 'move_meta', 'move_meta_stat_changes', 'move_meta_ailments',
      'move_flavor_text', 'pokemon_moves', 'growth_rates', 'experience',
    ].map(async (n) => [n, await csv(n)]),
  ),
);

// ── 타입 ────────────────────────────────────
const typeName = {};
for (const t of T.types) if (Number(t.id) <= TYPE_COUNT) typeName[t.id] = t.identifier;

const typeChart = {}; // [공격][방어] = 배율
for (const e of T.type_efficacy) {
  const a = typeName[e.damage_type_id], d = typeName[e.target_type_id];
  if (a && d) (typeChart[a] ??= {})[d] = Number(e.damage_factor) / 100;
}

// ── 포켓몬 (기본폼, 6스탯) ───────────────────────
const koSpecies = Object.fromEntries(
  T.pokemon_species_names.filter((n) => n.local_language_id === KO).map((n) => [n.pokemon_species_id, n.name]),
);
const defaultPokemonOf = {}; // speciesId → pokemonId
const speciesOfPokemon = {}; // pokemonId → speciesId (기본폼만)
const weightOf = {};         // pokemonId → kg
const baseExpOf = {};        // pokemonId → 기초 경험치
for (const p of T.pokemon) {
  if (p.is_default !== '1') continue;
  defaultPokemonOf[p.species_id] = p.id;
  speciesOfPokemon[p.id] = p.species_id;
  weightOf[p.id] = Number(p.weight) / 10; // CSV는 0.1kg 단위
  baseExpOf[p.id] = Number(p.base_experience) || 0;
}
const statsBy = {};
for (const s of T.pokemon_stats) (statsBy[s.pokemon_id] ??= {})[s.stat_id] = Number(s.base_stat);
const typesBy = {};
for (const t of T.pokemon_types) (typesBy[t.pokemon_id] ??= [])[Number(t.slot) - 1] = typeName[t.type_id];

function rarityOf(sp, bst) {
  if (sp.is_legendary === '1' || sp.is_mythical === '1') return 'UR';
  if (bst >= 500) return 'SR';
  if (bst >= 400 || sp.evolves_from_species_id) return 'R';
  return 'N';
}

const growthName = Object.fromEntries(T.growth_rates.map((g) => [g.id, g.identifier]));
// expTable[성장 곡선][레벨] = 그 레벨이 되는 데 필요한 누적 경험치
const expTable = {};
for (const e of T.experience) (expTable[growthName[e.growth_rate_id]] ??= [0])[Number(e.level)] = Number(e.experience);

const species = T.pokemon_species
  .filter((sp) => Number(sp.id) <= MAX_SPECIES)
  .map((sp) => {
    const pid = defaultPokemonOf[sp.id];
    const s = statsBy[pid];
    const baseStats = { hp: s[1], atk: s[2], def: s[3], spAtk: s[4], spDef: s[5], spd: s[6] };
    const bst = Object.values(baseStats).reduce((a, b) => a + b, 0);
    return {
      id: sp.id,
      name: koSpecies[sp.id] ?? sp.identifier,
      slug: sp.identifier,
      generation: Number(sp.generation_id),
      types: typesBy[pid].filter(Boolean),
      weight: weightOf[pid],
      baseStats,
      bst,
      baseExp: baseExpOf[pid],
      growthRate: growthName[sp.growth_rate_id],
      rarity: rarityOf(sp, bst),
      evolvesFrom: sp.evolves_from_species_id || null,
      sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${sp.id}.png`,
    };
  });

// ── 기술 ────────────────────────────────────
const koMove = Object.fromEntries(
  T.move_names.filter((n) => n.local_language_id === KO).map((n) => [n.move_id, n.name]),
);
// 기술 설명: 언어별 가장 최신 버전그룹. 한국어 없으면 영어로 대체
const EN = '9';
const desc = { [KO]: {}, [EN]: {} };
const descVg = { [KO]: {}, [EN]: {} };
for (const f of T.move_flavor_text) {
  const lang = f.language_id;
  if (lang !== KO && lang !== EN) continue;
  const vg = Number(f.version_group_id);
  if (!descVg[lang][f.move_id] || vg > descVg[lang][f.move_id]) {
    descVg[lang][f.move_id] = vg;
    desc[lang][f.move_id] = f.flavor_text.replace(/\s*\n\s*/g, ' ').trim();
  }
}
const ailmentName = Object.fromEntries(T.move_meta_ailments.map((a) => [a.id, a.identifier]));
const metaBy = Object.fromEntries(T.move_meta.map((m) => [m.move_id, m]));
const statChangesBy = groupBy(T.move_meta_stat_changes, 'move_id');

function buildMove(m) {
  const category = CATEGORY[m.damage_class_id];
  const meta = metaBy[m.id];
  const power = num(m.power);
  return {
    id: m.id,
    name: koMove[m.id] ?? m.identifier,
    slug: m.identifier,
    type: typeName[m.type_id] ?? 'normal',
    category,
    power,
    // 물리/특수인데 위력이 없음 = 위력 가변 (자이로볼, 지구던지기, 카운터 등) → effectId로 엔진에서 처리
    variablePower: category !== 'status' && power === null,
    accuracy: num(m.accuracy), // null = 반드시 명중
    pp: num(m.pp),
    priority: Number(m.priority),
    target: TARGET[m.target_id] ?? 'selected-pokemon',
    effectId: num(m.effect_id),
    effectChance: num(m.effect_chance),
    meta: meta && {
      category: META_CATEGORY[meta.meta_category_id] ?? 'unique',
      ailment: ailmentName[meta.meta_ailment_id] ?? 'none',
      ailmentChance: Number(meta.ailment_chance),
      minHits: num(meta.min_hits),
      maxHits: num(meta.max_hits),
      minTurns: num(meta.min_turns),
      maxTurns: num(meta.max_turns),
      drain: Number(meta.drain),       // % (음수 = 반동)
      healing: Number(meta.healing),   // % 최대 HP
      critRate: Number(meta.crit_rate),
      flinchChance: Number(meta.flinch_chance),
      statChance: Number(meta.stat_chance),
      statChanges: (statChangesBy[m.id] ?? []).map((c) => ({
        stat: STAT_KEY[c.stat_id],
        change: Number(c.change),
      })),
    },
    // 우선순위: 공식 한국어 → 직접 번역(overrides) → 영어
    description: desc[KO][m.id] ?? descOverrides[m.identifier] ?? desc[EN][m.id] ?? '',
    descriptionLang: desc[KO][m.id]
      ? 'ko'
      : descOverrides[m.identifier]
        ? 'ko-unofficial'
        : desc[EN][m.id]
          ? 'en'
          : null,
  };
}

const allMoves = Object.fromEntries(
  T.moves.filter((m) => Number(m.id) < 10000).map((m) => [m.id, buildMove(m)]),
);

// ── 레벨업 기술 배우기 ─────────────────────────
const byPokemon = {};
for (const pm of T.pokemon_moves) {
  if (pm.pokemon_move_method_id !== LEVEL_UP) continue;
  const sid = speciesOfPokemon[pm.pokemon_id];
  if (!sid || !allMoves[pm.move_id]) continue;
  ((byPokemon[sid] ??= {})[pm.version_group_id] ??= []).push({ moveId: pm.move_id, level: Number(pm.level) });
}

const learnsets = {};
const sourceVg = {};
const tackleAdded = [];
for (const sp of species) {
  const vgs = byPokemon[sp.id] ?? {};
  const vg = VG_PRIORITY.find((v) => vgs[v]?.length);
  sourceVg[vg] = (sourceVg[vg] ?? 0) + 1;
  const seen = new Set();
  const list = (vgs[vg] ?? [])
    .sort((a, b) => a.level - b.level)
    .filter((x) => !seen.has(x.moveId) && seen.add(x.moveId));

  // 위력 고정 데미지 기술이 하나도 없으면 몸통박치기 Lv1 기본 지급
  const hasFixedDamage = list.some((x) => allMoves[x.moveId].power !== null);
  if (!hasFixedDamage) {
    list.unshift({ moveId: TACKLE, level: 1, fallback: true });
    tackleAdded.push(sp.name);
  }
  learnsets[sp.id] = list;
}

// 레벨업 기술만이 아니라 전체를 담는다: 원작 트레이너 파티와 기술머신에 레벨업으로는 못 배우는 기술이 있다
const moves = allMoves;

// ── 출력 ────────────────────────────────────
await mkdir('src/data', { recursive: true });
await writeFile('src/data/species.json', JSON.stringify(species));
await writeFile('src/data/typeChart.json', JSON.stringify(typeChart, null, 2));
await writeFile('src/data/moves.json', JSON.stringify(moves));
await writeFile('src/data/learnsets.json', JSON.stringify(learnsets));
await writeFile('src/data/expTable.json', JSON.stringify(expTable));

const mv = Object.values(moves);
const count = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
console.log(`포켓몬 ${species.length}종, 등급`, count(species, (s) => s.rarity));
console.log(`타입 ${Object.keys(typeChart).length}개`);
console.log(`기술 ${mv.length}개`, count(mv, (m) => (m.variablePower ? 'variable' : m.category)));
console.log(`한글명 누락 ${mv.filter((m) => m.name === m.slug).length}, 설명 언어`, count(mv, (m) => m.descriptionLang));
console.log('기술 배우기 기준 버전그룹', sourceVg);
console.log(`몸통박치기 지급 ${tackleAdded.length}종: ${tackleAdded.join(', ')}`);
