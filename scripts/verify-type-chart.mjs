// scripts/verify-type-chart.mjs
// 생성된 typeChart.json을 독립 출처(veekun.com/dex/types, 6세대 이후 기준)와 대조
import { readFile } from 'node:fs/promises';

const COLS = ['bug','dark','dragon','electric','fairy','fighting','fire','flying','ghost',
  'grass','ground','ice','normal','poison','psychic','rock','steel','water'];
// 행 = 공격 타입, 열 = 방어 타입 (h = ½)
const REF = {
  bug:      '1 2 1 1 h h h h h 2 1 1 1 h 2 1 h 1',
  dark:     '1 h 1 1 h h 1 1 2 1 1 1 1 1 2 1 1 1',
  dragon:   '1 1 2 1 0 1 1 1 1 1 1 1 1 1 1 1 h 1',
  electric: '1 1 h h 1 1 1 2 1 h 0 1 1 1 1 1 1 2',
  fairy:    '1 2 2 1 1 2 h 1 1 1 1 1 1 h 1 1 h 1',
  fighting: 'h 2 1 1 h 1 1 h 0 1 1 2 2 h h 2 2 1',
  fire:     '2 1 h 1 1 1 h 1 1 2 1 2 1 1 1 h 2 h',
  flying:   '2 1 1 h 1 2 1 1 1 2 1 1 1 1 1 h h 1',
  ghost:    '1 h 1 1 1 1 1 1 2 1 1 1 0 1 2 1 1 1',
  grass:    'h 1 h 1 1 1 h h 1 h 2 1 1 h 1 2 h 2',
  ground:   'h 1 1 2 1 1 2 0 1 h 1 1 1 2 1 2 2 1',
  ice:      '1 1 2 1 1 1 h 2 1 2 2 h 1 1 1 1 h h',
  normal:   '1 1 1 1 1 1 1 1 0 1 1 1 1 1 1 h h 1',
  poison:   '1 1 1 1 2 1 1 1 h 2 h 1 1 h 1 h 0 1',
  psychic:  '1 0 1 1 1 2 1 1 1 1 1 1 1 2 h 1 h 1',
  rock:     '2 1 1 1 1 h 2 2 1 1 h 2 1 1 1 1 h 1',
  steel:    '1 1 1 h 2 1 h 1 1 1 1 2 1 1 1 2 h h',
  water:    '1 1 h 1 1 1 2 1 1 h 2 1 1 1 1 2 1 h',
};

const chart = JSON.parse(await readFile('src/data/typeChart.json', 'utf8'));
let checked = 0;
const diffs = [];
for (const [atk, row] of Object.entries(REF)) {
  row.split(' ').forEach((v, i) => {
    const expected = v === 'h' ? 0.5 : Number(v);
    const actual = chart[atk]?.[COLS[i]];
    checked++;
    if (actual !== expected) diffs.push(`${atk} → ${COLS[i]}: 생성 ${actual}, 기준 ${expected}`);
  });
}
console.log(`${checked}칸 대조, 불일치 ${diffs.length}건`);
diffs.forEach((d) => console.log('  ' + d));
process.exit(diffs.length ? 1 : 0);
