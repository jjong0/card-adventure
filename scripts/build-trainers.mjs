// scripts/build-trainers.mjs
// 하트골드·소울실버 원본 트레이너 데이터(pret/pokeheartgold 디컴파일) → src/data/trainers.json
// 관장·사천왕·챔피언·레드·라이벌만 추출. 실행: node scripts/build-trainers.mjs (build-data.mjs 먼저)
import { readFile, writeFile } from 'node:fs/promises';

const SRC = 'https://raw.githubusercontent.com/pret/pokeheartgold/master/files/poketool/trainer/trainers.json';
const POKEAPI = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const KO = '3';

// 스토리 진행 순서 (하트골드 기준). 관동은 순서 자유라 관장 에이스 레벨 오름차순
const STORY = [
  ['FALKNER', '비상', 'gym'], ['BUGSY', '호일', 'gym'], ['WHITNEY', '꼭두', 'gym'], ['MORTY', '유빈', 'gym'],
  ['CHUCK', '사도', 'gym'], ['JASMINE', '규리', 'gym'], ['PRYCE', '류옹', 'gym'], ['CLAIR', '이향', 'gym'],
  ['WILL', '일목', 'elite4'], ['KOGA', '독수', 'elite4'], ['BRUNO', '시바', 'elite4'], ['KAREN', '카렌', 'elite4'],
  ['LANCE', '목호', 'champion'],
  ['JANINE', '도희', 'gym'], ['LT_SURGE', '마티스', 'gym'], ['BROCK', '웅', 'gym'], ['MISTY', '이슬', 'gym'],
  ['SABRINA', '초련', 'gym'], ['ERIKA', '민화', 'gym'], ['BLAINE', '강연', 'gym'], ['BLUE', '그린', 'gym'],
  ['RED', '레드', 'final'],
];

const parseCsv = (text) => {
  const [h, ...rows] = text.trim().split('\n');
  const keys = h.split(',');
  return rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [keys[i], v])));
};
const csv = async (n) => parseCsv(await (await fetch(`${POKEAPI}/${n}.csv`)).text());

// SPECIES_MR_MIME → mr-mime 처럼 PokeAPI slug로 변환 (예외는 직접 매핑)
const SPECIES_FIX = { nidoran_f: 'nidoran-f', nidoran_m: 'nidoran-m', farfetchd: 'farfetchd', mr_mime: 'mr-mime', mime_jr: 'mime-jr', ho_oh: 'ho-oh', porygon_z: 'porygon-z' };
const toSlug = (s, prefix) => {
  const raw = s.replace(prefix, '').toLowerCase();
  return SPECIES_FIX[raw] ?? raw.replace(/_/g, '-');
};
// 게임 내부 명칭과 PokeAPI 명칭이 다른 기술
const MOVE_FIX = { 'ancientpower': 'ancient-power', 'dynamicpunch': 'dynamic-punch', 'extremespeed': 'extreme-speed', 'faint-attack': 'feint-attack', 'hi-jump-kick': 'high-jump-kick', 'selfdestruct': 'self-destruct', 'softboiled': 'soft-boiled', 'solarbeam': 'solar-beam', 'sonicboom': 'sonic-boom', 'thunderpunch': 'thunder-punch', 'thundershock': 'thunder-shock', 'vicegrip': 'vise-grip', 'doubleslap': 'double-slap', 'poisonpowder': 'poison-powder', 'smokescreen': 'smokescreen', 'dragonbreath': 'dragon-breath', 'bubblebeam': 'bubble-beam', 'sand-attack': 'sand-attack' };
const ITEM_FIX = {};

const species = JSON.parse(await readFile('src/data/species.json', 'utf8'));
const speciesBySlug = Object.fromEntries(species.map((s) => [s.slug, s]));
const [allMoves, items, itemNames] = await Promise.all([csv('moves'), csv('items'), csv('item_names')]);
const moveBySlug = Object.fromEntries(allMoves.map((m) => [m.identifier, m.id]));
const itemBySlug = Object.fromEntries(items.map((i) => [i.identifier, i.id]));
const itemKo = Object.fromEntries(itemNames.filter((n) => n.local_language_id === KO).map((n) => [n.item_id, n.name]));

const src = await (await fetch(SRC)).json();
const list = Object.values(src)[0];

const missing = new Set();
const mapSpecies = (s) => {
  const slug = toSlug(s, 'SPECIES_');
  const sp = speciesBySlug[slug] ?? species.find((x) => x.slug.startsWith(slug + '-'));
  if (!sp) missing.add(`species:${s}`);
  return sp?.id ?? null;
};
const mapMove = (m) => {
  let slug = toSlug(m, 'MOVE_');
  slug = MOVE_FIX[slug.replace(/-/g, '')] ?? MOVE_FIX[slug] ?? slug;
  const id = moveBySlug[slug];
  if (!id) missing.add(`move:${m}`);
  return id ?? null;
};
const mapItem = (i) => {
  if (!i || i === 'ITEM_NONE') return null;
  const slug = ITEM_FIX[i] ?? toSlug(i, 'ITEM_');
  const id = itemBySlug[slug];
  if (!id) missing.add(`item:${i}`);
  return id ? { slug, name: itemKo[id] ?? slug } : null;
};

function convert(t, index, meta) {
  return {
    index,                       // 원본 트레이너 번호
    key: meta.key,
    name: meta.name,
    nameEn: t.name.replace('{TRNAME}', ''),
    role: meta.role,             // gym | elite4 | champion | final | rival
    battle: meta.battle,         // story | rematch
    chapter: meta.chapter ?? null,
    aiFlags: t.ai_flags,
    double: !!t.double,
    bagItems: t.items.map(mapItem).filter(Boolean),
    party: t.party.map((p) => ({
      speciesId: mapSpecies(p.species),
      level: p.level,
      // 원작 트레이너 개체값: difficulty(0~255) × 31 / 255, 전 스탯 동일
      iv: Math.floor((p.difficulty * 31) / 255),
      item: mapItem(p.item),
      moves: (p.moves ?? []).filter((m) => m !== 'MOVE_NONE').map(mapMove).filter(Boolean),
    })),
  };
}

const out = [];
STORY.forEach(([key, name, role], chapterIdx) => {
  const match = list
    .map((t, i) => [t, i])
    .filter(([t]) => (key === 'RED' ? t.class === 'TRAINERCLASS_PKMN_TRAINER_RED' : t.class.endsWith(`_${key}`) || (key === 'LANCE' && t.class === 'TRAINERCLASS_CHAMPION' && t.name.includes('Lance'))));
  match.forEach(([t, i], n) => {
    out.push(convert(t, i, { key: key.toLowerCase(), name, role, battle: n === 0 ? 'story' : 'rematch', chapter: n === 0 ? chapterIdx + 1 : null }));
  });
});
// 라이벌: 플레이어 스타터에 따라 3종 × 등장 시점별
list.forEach((t, i) => {
  if (t.class === 'TRAINERCLASS_RIVAL') out.push(convert(t, i, { key: 'rival', name: '라이벌', role: 'rival', battle: 'story' }));
});

await writeFile('src/data/trainers.json', JSON.stringify(out, null, 1));

const story = out.filter((t) => t.battle === 'story' && t.role !== 'rival');
console.log(`트레이너 ${out.length}명 (스토리 ${story.length}, 재대결 ${out.filter((t) => t.battle === 'rematch').length}, 라이벌 ${out.filter((t) => t.role === 'rival').length})`);
console.log(`매핑 실패 ${missing.size}건`, [...missing].join(', '));
for (const t of story) {
  const sp = Object.fromEntries(species.map((s) => [s.id, s.name]));
  console.log(`${String(t.chapter).padStart(2)} ${t.name}(${t.nameEn}) ` + t.party.map((p) => `${sp[p.speciesId]}${p.level}`).join(' '));
}
