import { describe, expect, it } from 'vitest';
import { spriteCandidates } from './sprite';

describe('spriteCandidates', () => {
  it('649번까지는 블랙·화이트 애니메이션 → 정지 이미지', () => {
    expect(spriteCandidates('16')).toEqual([
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/16.gif',
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/16.png',
    ]);
  });

  it('650번부터는 쇼다운 애니메이션, 뒷모습은 back/ 경로', () => {
    expect(spriteCandidates('906', true)).toEqual([
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/back/906.gif',
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/906.png',
    ]);
  });
});
