// scripts/build-tm-compat.mjs
// 하트골드 기술머신·비전머신 목록 + 종별로 배울 수 있는 기술머신 → src/data/tmCompat.json (spec §6)
// 실행: node scripts/build-tm-compat.mjs  (build-data 다음에 실행: species.json, moves.json을 읽음)
//
// 기술머신 목록은 하트골드 기준(TM01~92, HM01~08). 상점·관장 보상이 이 목록에서 나온다.
// 배울 수 있는지는 모든 세대의 기술머신 습득 데이터를 합친다. 4세대 이후 포켓몬도 써야 하기 때문
import { readFile, writeFile } from 'node:fs/promises';
import { csv, KO } from './lib/pokeapi-csv.mjs';

const HGSS = '10';         // version_groups.csv heartgold-soulsilver
const MACHINE = '4';       // pokemon_move_methods.csv machine
const HM_OFFSET = 100;     // machines.csv에서 HGSS 비전머신은 101~108

const species = JSON.parse(await readFile('src/data/species.json', 'utf8'));
const moves = JSON.parse(await readFile('src/data/moves.json', 'utf8'));
const speciesIds = new Set(species.map((s) => s.id));

const [machinesCsv, itemNames, pokemon, pokemonMoves] = await Promise.all([
  csv('machines'), csv('item_names'), csv('pokemon'), csv('pokemon_moves'),
]);
const itemKo = Object.fromEntries(itemNames.filter((n) => n.local_language_id === KO).map((n) => [n.item_id, n.name]));

const machines = machinesCsv
  .filter((m) => m.version_group_id === HGSS)
  .map((m) => {
    const n = Number(m.machine_number);
    const hm = n > HM_OFFSET;
    const no = String(hm ? n - HM_OFFSET : n).padStart(2, '0');
    return { id: `${hm ? 'hm' : 'tm'}${no}`, name: itemKo[m.item_id] ?? `${hm ? '비전머신' : '기술머신'}${no}`, moveId: m.move_id };
  })
  // 기술머신 → 비전머신 순, 각각 번호순 ('tm' > 'hm'이라 접두어 비교는 뒤집는다)
  .sort((a, b) => b.id.slice(0, 2).localeCompare(a.id.slice(0, 2)) || a.id.localeCompare(b.id));

const missingMoves = machines.filter((m) => !moves[m.moveId]);
if (missingMoves.length) throw new Error(`moves.json에 없는 기술: ${missingMoves.map((m) => m.id).join(', ')}`);

// 기본폼만 (지역폼 등은 엔진에 없음)
const speciesOfPokemon = Object.fromEntries(pokemon.filter((p) => p.is_default === '1').map((p) => [p.id, p.species_id]));
const tmMoves = new Set(machines.map((m) => m.moveId));
const compat = {};
for (const pm of pokemonMoves) {
  if (pm.pokemon_move_method_id !== MACHINE || !tmMoves.has(pm.move_id)) continue;
  const sid = speciesOfPokemon[pm.pokemon_id];
  if (!sid || !speciesIds.has(sid)) continue;
  (compat[sid] ??= new Set()).add(pm.move_id);
}

// 종 하나당 한 줄: 다시 생성했을 때 diff를 읽기 쉽게
const byNum = (a, b) => Number(a) - Number(b);
const compatLines = Object.keys(compat)
  .sort(byNum)
  .map((sid) => `    ${JSON.stringify(sid)}: ${JSON.stringify([...compat[sid]].sort(byNum))}`);
const machineLines = machines.map((m) => `    ${JSON.stringify(m)}`);
await writeFile(
  'src/data/tmCompat.json',
  `{\n  "machines": [\n${machineLines.join(',\n')}\n  ],\n  "compat": {\n${compatLines.join(',\n')}\n  }\n}\n`,
);

const name = (id) => moves[id].name;
const learners = Object.fromEntries(machines.map((m) => [m.id, Object.values(compat).filter((s) => s.has(m.moveId)).length]));
console.log(`기술머신 ${machines.filter((m) => m.id.startsWith('tm')).length}개, 비전머신 ${machines.filter((m) => m.id.startsWith('hm')).length}개`);
console.log(`배울 수 있는 기술머신이 있는 종 ${Object.keys(compat).length}/${species.length}`);
const none = species.filter((s) => !compat[s.id]).map((s) => s.name);
console.log(`하나도 없는 종 ${none.length}: ${none.join(', ')}`);
console.log('예시:', machines.slice(0, 5).map((m) => `${m.name} ${name(m.moveId)} (${learners[m.id]}종)`).join(', '));
