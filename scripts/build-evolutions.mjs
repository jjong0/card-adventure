// scripts/build-evolutions.mjs
// PokeAPI pokemon_evolution → src/data/evolutions.json (spec §4.6)
// 실행: node scripts/build-evolutions.mjs  (build-data.mjs 다음에 실행: species.json을 읽음)
//
// 결과: evolutions[진화 전 종 id] = [{ to, method, ... }]
//   level       원작 레벨업 진화
//   item        도구(진화의돌 등) 사용
//   substitute  원작 조건(교환·친밀도·기타)을 대체 레벨로 바꾼 진화
import { readFile, writeFile } from 'node:fs/promises';
import { csv, KO, num } from './lib/pokeapi-csv.mjs';

// spec §4.6 대체 레벨 규칙
const TRADE_LEVEL = 36;
const FRIENDSHIP_LEVEL = 22;
const OTHER_STEP = 10;      // 기타 조건: 같은 계열 이전 진화 레벨 + 10
const OTHER_FALLBACK = 30;  // 이전 진화가 없거나 레벨이 없을 때 (spec 미정 → 기본값)

const TRIGGER = { LEVEL_UP: '1', TRADE: '2', USE_ITEM: '3', IN_BATTLE_LEVEL_UP: '10' };
// 같은 대상에 기본 행이 여러 개면 이 순서로 고른다 (원작에서 가장 흔한 방법 우선)
const RANK = { level: 0, item: 1, friendship: 2, trade: 3, other: 4 };
const FORM_ID_NON_DEFAULT = 10000; // PokeAPI 폼 id 10000 이상 = 지역폼 등 기본이 아닌 폼

const species = JSON.parse(await readFile('src/data/species.json', 'utf8'));
const overrides = JSON.parse(await readFile('src/data/overrides/evolution-levels.json', 'utf8'));
const byId = Object.fromEntries(species.map((s) => [s.id, s]));

const [rows, items, itemNames] = await Promise.all([csv('pokemon_evolution'), csv('items'), csv('item_names')]);
const itemSlug = Object.fromEntries(items.map((i) => [i.id, i.identifier]));
const itemKo = Object.fromEntries(itemNames.filter((n) => n.local_language_id === KO).map((n) => [n.item_id, n.name]));

/** 행 하나를 방법으로 분류 */
function classify(r) {
  const level = num(r.minimum_level);
  const levelTrigger = r.evolution_trigger_id === TRIGGER.LEVEL_UP || r.evolution_trigger_id === TRIGGER.IN_BATTLE_LEVEL_UP;
  // 레벨 + 부가 조건(성별·시간·능력치 비교 등)은 레벨 진화로 본다. 갈래가 여러 개면 플레이어가 고른다
  if (levelTrigger && level) return { kind: 'level', level };
  if (r.evolution_trigger_id === TRIGGER.USE_ITEM) return { kind: 'item', itemId: r.trigger_item_id };
  if (levelTrigger && (num(r.minimum_happiness) || num(r.minimum_affection))) return { kind: 'friendship' };
  if (r.evolution_trigger_id === TRIGGER.TRADE) return { kind: 'trade' };
  return { kind: 'other' };
}

// 대상 종별로 쓸 행 하나 고르기
const skippedRegional = [];
const chosen = {}; // toId → { row, c }
const rowsByTo = Object.groupBy(rows, (r) => r.evolved_species_id);
for (const sp of species) {
  if (!sp.evolvesFrom) continue;
  const all = rowsByTo[sp.id] ?? [];
  // 진화 전이 기본이 아닌 폼(가라르 마임맨 등)이어야 하는 행은 제외. 엔진에 폼 개념이 없다.
  // 진화 후 폼만 다른 행(비비용 무늬, 알로라 라이츄)은 남기고, 정렬에서 기본폼 결과를 우선한다
  const usable = all.filter((r) => r.is_default === '1' && !(num(r.required_pokemon_form_id) >= FORM_ID_NON_DEFAULT));
  if (!usable.length) {
    if (all.length) skippedRegional.push(sp.id);
    continue;
  }
  const ranked = usable
    .map((row) => ({ row, c: classify(row) }))
    .sort(
      (a, b) =>
        RANK[a.c.kind] - RANK[b.c.kind] ||
        Number(num(a.row.evolved_pokemon_form_id) >= FORM_ID_NON_DEFAULT) -
          Number(num(b.row.evolved_pokemon_form_id) >= FORM_ID_NON_DEFAULT) ||
        Number(b.row.version_group_id) - Number(a.row.version_group_id),
    );
  chosen[sp.id] = ranked[0];
}

// 대체 레벨 계산 (기타 조건은 이전 진화 레벨에 의존하므로 재귀 + 메모)
const memo = {};
function levelOf(toId) {
  if (toId in memo) return memo[toId];
  const entry = chosen[toId];
  let lv = null;
  if (overrides[toId] != null) lv = overrides[toId];
  else if (!entry) lv = null;
  else if (entry.c.kind === 'level') lv = entry.c.level;
  else if (entry.c.kind === 'friendship') lv = FRIENDSHIP_LEVEL;
  else if (entry.c.kind === 'trade') lv = TRADE_LEVEL;
  else if (entry.c.kind === 'other') {
    const prev = levelOf(byId[toId].evolvesFrom);
    lv = prev == null ? OTHER_FALLBACK : prev + OTHER_STEP;
  }
  return (memo[toId] = lv);
}

const evolutions = {};
const stats = { level: 0, item: 0, trade: 0, friendship: 0, other: 0, override: 0 };
const fallbackUsed = [];
for (const sp of species) {
  if (!sp.evolvesFrom) continue;
  const entry = chosen[sp.id];
  const overridden = overrides[sp.id] != null;
  if (!entry && !overridden) continue;

  let evo;
  if (overridden) {
    evo = { to: sp.id, method: 'substitute', level: overrides[sp.id], reason: 'override' };
    stats.override++;
  } else if (entry.c.kind === 'level') {
    evo = { to: sp.id, method: 'level', level: entry.c.level };
  } else if (entry.c.kind === 'item') {
    const id = entry.c.itemId;
    evo = { to: sp.id, method: 'item', item: itemSlug[id], itemName: itemKo[id] ?? itemSlug[id] };
  } else {
    evo = { to: sp.id, method: 'substitute', level: levelOf(sp.id), reason: entry.c.kind };
    if (entry.c.kind === 'other' && levelOf(sp.evolvesFrom) == null) fallbackUsed.push(sp.name);
  }
  if (!overridden) stats[entry.c.kind]++;
  (evolutions[sp.evolvesFrom] ??= []).push(evo);
}

// 진화 전 종 하나당 한 줄: 다시 생성했을 때 diff를 읽기 쉽게
const lines = Object.entries(evolutions).map(([from, list]) => `  ${JSON.stringify(from)}: ${JSON.stringify(list)}`);
await writeFile('src/data/evolutions.json', `{\n${lines.join(',\n')}\n}\n`);

const name = (id) => byId[id]?.name ?? id;
console.log(`진화 ${Object.values(evolutions).flat().length}개 (진화 전 종 ${Object.keys(evolutions).length}개)`, stats);
console.log(`기타 조건 중 이전 진화 레벨이 없어 Lv${OTHER_FALLBACK} 적용 ${fallbackUsed.length}종: ${fallbackUsed.join(', ')}`);
console.log(`지역폼 전용이라 제외 ${skippedRegional.length}종: ${skippedRegional.map(name).join(', ')}`);
const items_ = [...new Set(Object.values(evolutions).flat().filter((e) => e.method === 'item').map((e) => e.itemName))];
console.log(`진화 도구 ${items_.length}종: ${items_.join(', ')}`);
