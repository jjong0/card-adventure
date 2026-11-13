// scripts/build-trainers.mjs
// 하트골드·소울실버 원본 트레이너 데이터(pret/pokeheartgold 디컴파일) → src/data/trainers.json
// 관장·사천왕·챔피언·레드·라이벌 + 일반 트레이너 전원. 원작 대사는 쓰지 않으므로 추출하지 않는다.
// 실행: node scripts/build-trainers.mjs (build-data.mjs 먼저)
import { readFile, writeFile } from 'node:fs/promises';
import { csv, KO } from './lib/pokeapi-csv.mjs';

const SRC = 'https://raw.githubusercontent.com/pret/pokeheartgold/master/files/poketool/trainer/trainers.json';

// 일반 트레이너 풀에서 빼는 직업: 주인공·태그 파트너 같은 고유 인물, 꼬렛 Lv5 자리표시만 있는
// 배틀프런티어 브레인, 스타터 Lv5 한 마리짜리 행인
const EXCLUDED_CLASS = /^(PKMN_TRAINER_|PASSERBY$|TOWER_TYCOON$|HALL_MATRON$|FACTORY_HEAD$|ARCADE_STAR$|CASTLE_VALET$)/;
const BOSS_CLASS = /^(LEADER_|ELITE_FOUR_|CHAMPION$|RIVAL$)/;

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
const classKo = JSON.parse(await readFile('src/data/overrides/trainer-classes-ko.json', 'utf8'));
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
  // PokeAPI 이름이 바뀌는 경우가 있어(vise-grip → vice-grip) 원래 이름을 먼저 찾고, 없을 때만 예외 매핑
  const slug = toSlug(m, 'MOVE_');
  const id = moveBySlug[slug] ?? moveBySlug[MOVE_FIX[slug.replace(/-/g, '')] ?? MOVE_FIX[slug]];
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
    class: t.class.replace('TRAINERCLASS_', ''), // 직업 이미지 키 (assets.json trainerClasses)
    name: meta.name,
    nameEn: t.name.replace('{TRNAME}', ''),
    role: meta.role,             // gym | elite4 | champion | final | rival | trainer
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
// 일반 트레이너: 원본에 위치가 없으므로 챕터는 파티 최고 레벨로 정한다 (build-chapters.mjs, spec §3.4)
// 개인 이름은 한국어가 없어 직업 이름을 표시 이름으로 쓴다
const missingClassKo = new Set();
list.forEach((t, i) => {
  const cls = t.class.replace('TRAINERCLASS_', '');
  if (!t.party.length || BOSS_CLASS.test(cls) || EXCLUDED_CLASS.test(cls)) return;
  if (!classKo[cls]) missingClassKo.add(cls);
  out.push(convert(t, i, { key: cls.toLowerCase(), name: classKo[cls] ?? cls, role: 'trainer', battle: 'story' }));
});

// 트레이너 한 명당 한 줄: 다시 생성했을 때 diff를 읽기 쉽게
await writeFile('src/data/trainers.json', `[\n${out.map((t) => JSON.stringify(t)).join(',\n')}\n]\n`);

const story = out.filter((t) => t.battle === 'story' && t.chapter);
const count = (role) => out.filter((t) => t.role === role).length;
console.log(`트레이너 ${out.length}명 (스토리 보스 ${story.length}, 재대결 ${out.filter((t) => t.battle === 'rematch').length}, 라이벌 ${count('rival')}, 일반 ${count('trainer')})`);
console.log(`매핑 실패 ${missing.size}건`, [...missing].join(', '));
console.log(`한국어 직업명 없음 ${missingClassKo.size}건`, [...missingClassKo].join(', '));
for (const t of story) {
  const sp = Object.fromEntries(species.map((s) => [s.id, s.name]));
  console.log(`${String(t.chapter).padStart(2)} ${t.name}(${t.nameEn}) ` + t.party.map((p) => `${sp[p.speciesId]}${p.level}`).join(' '));
}
