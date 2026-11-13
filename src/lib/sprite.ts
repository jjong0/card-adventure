// src/lib/sprite.ts
// 포켓몬 스프라이트 URL 후보 (docs/spec.md §9.1). 앞에서부터 시도하고, 실패하면 다음 후보로.
const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
/** 5세대 블랙·화이트 애니메이션이 있는 마지막 번호 */
const BW_ANIMATED_MAX = 649;

export function spriteCandidates(speciesId: string, back = false): string[] {
  const id = Number(speciesId);
  const b = back ? 'back/' : '';
  const animated =
    id <= BW_ANIMATED_MAX
      ? `${BASE}/versions/generation-v/black-white/animated/${b}${id}.gif`
      : `${BASE}/other/showdown/${b}${id}.gif`; // 650번 이후 (일부 번호 없음)
  return [animated, `${BASE}/${b}${id}.png`]; // 정지 이미지는 1025번까지 있음
}
