// scripts/build-move-fx.mjs
// 기술 → 연출 계열 → src/data/moveFx.json (build-data 다음에 실행: moves.json을 읽음)
// 원작 이펙트를 따라 만들지 않고, 기술이 실제로 하는 동작(물기·펀치·광선…)으로 계열을 나눠
// 계열마다 직접 디자인한 연출을 쓴다. 계열이 없는 기술은 화면에서 타입×분류 기본 연출을 쓴다.
import { readFile, writeFile } from 'node:fs/promises';
import { csv } from './lib/pokeapi-csv.mjs';

const moves = JSON.parse(await readFile('src/data/moves.json', 'utf8'));
const overrides = JSON.parse(await readFile('src/data/overrides/move-fx.json', 'utf8'));
const [flagNames, flagMap] = await Promise.all([csv('move_flags'), csv('move_flag_map')]);

const flagName = Object.fromEntries(flagNames.map((f) => [f.id, f.identifier]));
const flagsOf = {};
for (const r of flagMap) (flagsOf[r.move_id] ??= new Set()).add(flagName[r.move_flag_id]);

const SPREAD = new Set(['all-other-pokemon', 'all-opponents']);

// 위에서부터 처음 맞는 규칙. 원작 분류(flag)가 있는 계열은 flag, 없는 계열은 slug·타입·대상으로 판정
const RULES = [
  ['explode', (m) => /^(explosion|self-destruct|misty-explosion|mind-blown)$/.test(m.slug)],
  ['bite', (m, f) => f.has('bite')],
  ['punch', (m, f) => f.has('punch') || /kick|stomp/.test(m.slug)],
  ['sound', (m, f) => f.has('sound')],
  ['quake', (m) => m.type === 'ground' && m.category !== 'status' && SPREAD.has(m.target)],
  ['beam', (m, f) => m.category !== 'status' && (f.has('pulse') || /beam|-ray$|cannon/.test(m.slug))],
  ['stream', (m) => m.category !== 'status' && /thrower|-gun$|-pump$|^scald$|^surf$|muddy-water|octazooka|sludge-wave|steam-eruption|heat-wave|mud-shot|^bubble$|^water-spout$|^eruption$|^overheat$|^fire-spin$|whirlpool|^acid$|^smog$|^spit-up$/.test(m.slug)],
  ['fall', (m) => m.category !== 'status' && /^(thunder|thunderbolt|blizzard|powder-snow|draco-meteor|rock-slide|avalanche|meteor-beam|ice-shard|icicle-crash|icicle-spear|hurricane|zap-cannon|fire-blast|stone-edge|rock-throw|bolt-strike|blue-flare)$/.test(m.slug)],
  ['slash', (m) => m.category !== 'status' && /slash|cut|claw|blade|scissor|razor|scratch|fury-swipes|sacred-sword|aerial-ace|air-cutter|air-slash|secret-sword/.test(m.slug)],
];

const fx = {};
const count = {};
for (const m of Object.values(moves)) {
  const f = flagsOf[m.id] ?? new Set();
  const family = overrides[m.slug] ?? RULES.find(([, test]) => test(m, f))?.[0];
  if (!family || family === 'none') continue;
  fx[m.id] = family;
  (count[family] ??= []).push(m.name);
}

const lines = Object.keys(fx).sort((a, b) => a - b).map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(fx[id])}`);
await writeFile('src/data/moveFx.json', `{\n${lines.join(',\n')}\n}\n`);

console.log(`연출 계열이 있는 기술 ${Object.keys(fx).length}/${Object.keys(moves).length}`);
for (const [family, names] of Object.entries(count)) console.log(`${family} ${names.length}: ${names.join(', ')}`);
