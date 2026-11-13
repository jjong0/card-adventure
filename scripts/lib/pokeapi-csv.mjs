// scripts/lib/pokeapi-csv.mjs
// PokeAPI CSV 내려받기 + 파싱 (따옴표 안 쉼표/줄바꿈 처리). 데이터 생성 스크립트 공용.
export const BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
export const KO = '3';

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [keys, ...data] = rows;
  return data.map((v) => Object.fromEntries(keys.map((k, i) => [k, v[i] ?? ''])));
}

export async function csv(name) {
  const res = await fetch(`${BASE}/${name}.csv`);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return parseCsv(await res.text());
}

export const num = (v) => (v === '' || v == null ? null : Number(v));
