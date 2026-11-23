// scripts/build-items.mjs
// overrides/held-items.json(목록·등급, 수동) + PokeAPI 공식 한국어 이름·설명 → src/data/heldItems.json
// 실행: node scripts/build-items.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { csv, KO } from './lib/pokeapi-csv.mjs';

const EN = '9';
const config = JSON.parse(await readFile('src/data/overrides/held-items.json', 'utf8'));
const [items, names, flavors] = await Promise.all([csv('items'), csv('item_names'), csv('item_flavor_text')]);
const idOf = Object.fromEntries(items.map((i) => [i.identifier, i.id]));
const koName = Object.fromEntries(names.filter((n) => n.local_language_id === KO).map((n) => [n.item_id, n.name]));

// 설명: 언어별 가장 최신 버전그룹 (한국어 없으면 영어)
const desc = { [KO]: {}, [EN]: {} };
const vgOf = { [KO]: {}, [EN]: {} };
for (const f of flavors) {
  const lang = f.language_id;
  if (lang !== KO && lang !== EN) continue;
  const vg = Number(f.version_group_id);
  if (!vgOf[lang][f.item_id] || vg > vgOf[lang][f.item_id]) {
    vgOf[lang][f.item_id] = vg;
    desc[lang][f.item_id] = f.flavor_text.replace(/\s*\n\s*/g, ' ').trim();
  }
}

const out = [];
const problems = [];
for (const [tier, slugs] of Object.entries(config.tiers)) {
  for (const slug of slugs) {
    const id = idOf[slug];
    if (!id) {
      problems.push(`없는 도구: ${slug}`);
      continue;
    }
    const name = koName[id] ?? config.names[slug];
    const description = config.descriptions[slug] ?? desc[KO][id] ?? desc[EN][id] ?? '';
    if (!name) problems.push(`한국어 이름 없음: ${slug}`);
    if (!desc[KO][id] && !config.descriptions[slug]) problems.push(`한국어 설명 없음(영어 사용): ${slug}`);
    out.push({ slug, name: name ?? slug, description, tier });
  }
}

await writeFile('src/data/heldItems.json', `[\n${out.map((i) => `  ${JSON.stringify(i)}`).join(',\n')}\n]\n`);
const count = out.reduce((m, i) => ((m[i.tier] = (m[i.tier] ?? 0) + 1), m), {});
console.log(`지닌 도구 ${out.length}종`, count);
if (problems.length) console.log(problems.join('\n'));
