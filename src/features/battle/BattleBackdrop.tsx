// 전투 배경: 장소(env)별로 직접 그린 그림. 원작 4세대처럼 배경(장소)과 발판(땅)을 따로 그린다.
//   field 풀밭 · forest 숲 · cave 동굴 · water 물가 · snow 설원 · gym 체육관 · league 포켓몬리그
//
// DS 도트 느낌을 내는 방법:
//   - 매끈한 그라디언트 대신 몇 가지 색의 띠 + 띠 경계의 디더(체크무늬)
//   - 원·타원을 반복하지 않고, 고정 시드 난수로 울퉁불퉁한 윤곽(수관, 바위, 구름)을 그린다
//   - 1/3 해상도 캔버스로 래스터화(안티에일리어싱 없이)한 뒤 픽셀 그대로 키운다. 스프라이트와 같은 도트 크기
// assets.json의 battleBackgrounds에 그 장소 이미지가 있으면 그림 대신 이미지를 깔고, 발판만 위에 그린다.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import assets from '../../data/assets.json';
import { useAssetImage } from '../../lib/assetImage';

const W = 1280;
const H = 520;
/** 땅이 시작되는 높이 (지평선) */
const HORIZON = 228;
/** 도트 한 칸 = 3px (캔버스는 1/3 해상도) */
const PIXEL = 3;

/** 발판 중심·크기. Field의 스프라이트 위치와 맞춘다 (발이 타원 중심에 오도록) */
export const PLATFORMS = {
  enemy: { cx: 940, cy: 236, rx: 185, ry: 38 },
  player: { cx: 370, cy: 453, rx: 225, ry: 46 },
} as const;

const BACKGROUNDS = assets.battleBackgrounds as Record<string, string>;
const CHAPTER_ENV = assets.battleChapterEnv as Record<string, string>;

/** 전투 장소: 관장전은 체육관(사천왕·챔피언 구간은 포켓몬리그), 그 밖은 챕터 장소 */
export function battleEnv(chapter: number, leader: boolean): string {
  const env = CHAPTER_ENV[String(chapter)] ?? 'field';
  if (!leader) return env;
  return env === 'league' ? 'league' : 'gym';
}

// ════════════════════════════════════════════
// 그리기 도구
// ════════════════════════════════════════════

type Rand = () => number;

/** 고정 시드 난수 (그림이 매번 같게) */
function seeded(seed: number): Rand {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (r: Rand, a: number, b: number) => a + r() * (b - a);
const f = (n: number) => Math.round(n);

/** 점들을 지나는 부드러운 닫힌 곡선 (중점 이차 곡선) */
function closedCurve(pts: [number, number][]): string {
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[pts.length - 1], pts[0]);
  let d = `M${f(start[0])} ${f(start[1])}`;
  pts.forEach((p, i) => {
    const m = mid(p, pts[(i + 1) % pts.length]);
    d += ` Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`;
  });
  return `${d} Z`;
}

/** 울퉁불퉁한 덩어리 (바위, 구름 조각, 잎 뭉치) */
function blob(r: Rand, cx: number, cy: number, rx: number, ry: number, jitter = 0.2, n = 9): string {
  const off = r() * Math.PI * 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * Math.PI * 2;
    const k = 1 + (r() - 0.5) * 2 * jitter;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return closedCurve(pts);
}

/**
 * 띠 그라디언트: 색마다 평평한 띠, 경계에는 2도트 체크무늬 디더.
 * perspective면 아래 띠일수록 두꺼워진다 (땅의 원근).
 */
function Bands({ id, y0, y1, colors, perspective = false }: { id: string; y0: number; y1: number; colors: string[]; perspective?: boolean }) {
  const weights = colors.map((_, i) => (perspective ? i + 1.5 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let y = y0;
  const rows = colors.map((c, i) => {
    const h = ((y1 - y0) * weights[i]) / total;
    const row = { c, y, h };
    y += h;
    return row;
  });
  const D = PIXEL * 2;
  return (
    <g>
      <defs>
        {rows.slice(1).map((row, i) => (
          <pattern key={i} id={`${id}-${i}`} width={D} height={D} patternUnits="userSpaceOnUse">
            <rect width={D} height={D} fill={row.c} />
            <rect width={PIXEL} height={PIXEL} fill={rows[i].c} />
            <rect x={PIXEL} y={PIXEL} width={PIXEL} height={PIXEL} fill={rows[i].c} />
          </pattern>
        ))}
      </defs>
      {rows.map((row) => <rect key={row.y} x={0} y={f(row.y)} width={W} height={Math.ceil(row.h) + 1} fill={row.c} />)}
      {rows.slice(1).map((row, i) => <rect key={i} x={0} y={f(row.y - D)} width={W} height={D * 2} fill={`url(#${id}-${i})`} />)}
    </g>
  );
}

/** 뭉게구름: 크기가 다른 덩어리 몇 개 + 아랫면 그늘 (좌우가 같지 않게) */
function Cloud({ seed, x, y, w, light = '#FFFFFF', shade = '#D5E9F3' }: { seed: number; x: number; y: number; w: number; light?: string; shade?: string }) {
  const r = seeded(seed);
  const parts = [];
  let cx = x;
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const rr = between(r, w * 0.12, w * 0.24);
    parts.push({ cx, cy: y - rr * between(r, 0.3, 0.8), rr });
    cx += rr * between(r, 0.8, 1.3);
  }
  return (
    <g>
      {parts.map((p, i) => <path key={i} d={blob(r, p.cx, p.cy, p.rr, p.rr * 0.8, 0.12)} fill={light} />)}
      <path d={blob(r, (x + cx) / 2, y + 2, (cx - x) / 2 + w * 0.08, w * 0.07, 0.08)} fill={shade} />
    </g>
  );
}

interface Bump {
  x: number;
  y: number;
  r: number;
}

/** 수관 줄의 윗선: 크기가 제각각인 둥근 혹을 이어 붙인 실루엣. 혹 위치도 돌려준다 */
function canopy(r: Rand, base: number, hMin: number, hMax: number, step: [number, number], bottom: number): { d: string; bumps: Bump[] } {
  const bumps: Bump[] = [];
  let x = -60;
  while (x < W + 80) {
    const w = between(r, step[0], step[1]);
    bumps.push({ x: x + w / 2, y: base - between(r, hMin, hMax), r: w / 2 });
    x += w * between(r, 0.7, 0.95);
  }
  let d = `M-80 ${bottom} L-80 ${f(bumps[0].y + bumps[0].r)}`;
  for (const b of bumps) {
    // 혹 하나 = 왼쪽 어깨 → 꼭대기 → 오른쪽 어깨
    d += ` Q${f(b.x - b.r)} ${f(b.y - b.r * 0.15)} ${f(b.x - b.r * 0.15)} ${f(b.y - b.r * 0.55)}`;
    d += ` Q${f(b.x + b.r * 0.4)} ${f(b.y - b.r * 0.75)} ${f(b.x + b.r)} ${f(b.y + b.r * 0.1)}`;
  }
  d += ` L${W + 80} ${bottom} Z`;
  return { d, bumps };
}

/** 나무 줄. 뒷줄은 단색 실루엣, 앞줄은 잎 뭉치 빛·그늘과 줄기까지 */
function Trees({ seed, base, hMin, hMax, step, color, light, dark, trunk, bottom = HORIZON + 2 }: {
  seed: number; base: number; hMin: number; hMax: number; step: [number, number];
  color: string; light?: string; dark?: string; trunk?: string; bottom?: number;
}) {
  const r = seeded(seed);
  const { d, bumps } = canopy(r, base, hMin, hMax, step, trunk ? base + 4 : bottom);
  const lights: ReactNode[] = [];
  const darks: ReactNode[] = [];
  const trunks: ReactNode[] = [];
  bumps.forEach((b, i) => {
    if (light && r() < 0.8) {
      // 왼쪽 위에서 빛: 잎 뭉치 2~3개를 혹 윗부분에
      const k = 2 + Math.floor(r() * 2);
      for (let j = 0; j < k; j++) {
        lights.push(<path key={`${i}-${j}`} d={blob(r, b.x - b.r * between(r, 0.1, 0.5), b.y - b.r * between(r, 0.05, 0.35), b.r * between(r, 0.18, 0.32), b.r * between(r, 0.12, 0.22), 0.3, 7)} fill={light} />);
      }
    }
    if (dark && r() < 0.7) darks.push(<path key={i} d={blob(r, b.x + b.r * 0.3, b.y + b.r * 0.55, b.r * 0.45, b.r * 0.25, 0.3, 7)} fill={dark} />);
    if (trunk && r() < 0.45) {
      const tw = between(r, 7, 13);
      const tx = b.x + between(r, -b.r * 0.3, b.r * 0.3);
      trunks.push(<path key={i} d={`M${f(tx - tw / 2)} ${f(base)} L${f(tx - tw * 0.7)} ${bottom} L${f(tx + tw * 0.7)} ${bottom} L${f(tx + tw / 2)} ${f(base)} Z`} fill={trunk} />);
    }
  });
  return (
    <g>
      {trunks}
      <path d={d} fill={color} />
      {darks}
      {lights}
    </g>
  );
}

/** 땅 위의 작은 무늬 (풀 포기, 조약돌, 눈 더미, 물결). 아래로 갈수록 크고 많다 */
function Scatter({ seed, y0, count, draw }: { seed: number; y0: number; count: number; draw: (r: Rand, x: number, y: number, s: number, i: number) => ReactNode }) {
  const r = seeded(seed);
  const out: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const t = Math.pow(r(), 0.7); // 아래쪽에 더 많이
    const y = y0 + t * (H - y0);
    const s = 0.5 + t * 1.2;
    out.push(draw(r, r() * W, y, s, i));
  }
  return <g>{out}</g>;
}

const grassTuft = (dark: string, light: string) => (r: Rand, x: number, y: number, s: number, i: number) => {
  const h = (6 + r() * 6) * s;
  const w = 3 * s;
  return (
    <g key={i}>
      <path d={`M${f(x - w * 2)} ${f(y)} L${f(x - w * 1.4)} ${f(y - h * 0.7)} L${f(x - w * 0.6)} ${f(y)} L${f(x)} ${f(y - h)} L${f(x + w * 0.8)} ${f(y)} L${f(x + w * 1.8)} ${f(y - h * 0.6)} L${f(x + w * 2.2)} ${f(y)} Z`} fill={dark} />
      <path d={`M${f(x - w * 0.2)} ${f(y)} L${f(x)} ${f(y - h * 0.8)} L${f(x + w * 0.5)} ${f(y)} Z`} fill={light} />
    </g>
  );
};

// ════════════════════════════════════════════
// 발판: 두께(옆면) + 윗면 + 치우친 밝은 부분 + 점 무늬 + 가장자리 장식
// ════════════════════════════════════════════

interface PlatformStyle {
  side: string;
  rim: string;
  top: string;
  patch: string;
  speck: string;
  edge: 'grass' | 'rock' | 'ripple' | 'snow' | 'metal' | 'gold';
  edgeColors: [string, string];
}

const PLATFORM_STYLE: Record<string, PlatformStyle> = {
  field: { side: '#3F7A34', rim: '#5FA347', top: '#B9DF7E', patch: '#CDEA95', speck: '#94C863', edge: 'grass', edgeColors: ['#4B9139', '#6DB04F'] },
  forest: { side: '#234A28', rim: '#3D7638', top: '#86BD5F', patch: '#9ACB70', speck: '#6EA84E', edge: 'grass', edgeColors: ['#2E6430', '#4C8B40'] },
  cave: { side: '#3A2B21', rim: '#6E5845', top: '#A38B73', patch: '#B39C83', speck: '#8B735E', edge: 'rock', edgeColors: ['#5C4838', '#857060'] },
  water: { side: '#2D6C99', rim: '#5AA7D3', top: '#93CFEC', patch: '#B4E0F4', speck: '#E6F6FC', edge: 'ripple', edgeColors: ['#EAF8FE', '#A9DBF1'] },
  snow: { side: '#8BA2BB', rim: '#BFD0E2', top: '#EEF4FA', patch: '#FFFFFF', speck: '#D3E0EC', edge: 'snow', edgeColors: ['#D9E5F0', '#FFFFFF'] },
  gym: { side: '#2A3A50', rim: '#60738C', top: '#B5C3D3', patch: '#C9D5E2', speck: '#A3B2C4', edge: 'metal', edgeColors: ['#E6EDF5', '#7B8EA6'] },
  league: { side: '#140C20', rim: '#7D5F25', top: '#382A4F', patch: '#45355F', speck: '#2E2242', edge: 'gold', edgeColors: ['#F2C14E', '#B3862C'] },
};

function Platform({ seed, cx, cy, rx, ry, style }: { seed: number; cx: number; cy: number; rx: number; ry: number; style: PlatformStyle }) {
  const r = seeded(seed);
  const man = style.edge === 'metal' || style.edge === 'gold'; // 사람이 만든 발판은 반듯하게
  const lipH = ry * 0.32;
  const ellipse = (y: number) => `M${cx - rx} ${y} A${rx} ${ry} 0 1 0 ${cx + rx} ${y} A${rx} ${ry} 0 1 0 ${cx - rx} ${y} Z`;
  const top = man ? ellipse(cy) : blob(seeded(seed * 7), cx, cy, rx, ry, 0.035, 14);
  const side = man ? ellipse(cy + lipH) : blob(seeded(seed * 7), cx, cy + lipH, rx, ry, 0.035, 14);
  const edge: ReactNode[] = [];
  const [c1, c2] = style.edgeColors;

  if (style.edge === 'grass' || style.edge === 'rock' || style.edge === 'snow') {
    // 고르지 않은 간격으로 가장자리에 붙인다
    let a = r() * 0.3;
    let i = 0;
    while (a < Math.PI * 2) {
      const x = cx + Math.cos(a) * rx * 0.96;
      const y = cy + Math.sin(a) * ry * 0.96;
      const s = between(r, 0.6, 1.3);
      const fill = r() < 0.6 ? c1 : c2;
      if (style.edge === 'grass') edge.push(grassTuft(c1, c2)(r, x, y + 2, s, i));
      else if (style.edge === 'rock') edge.push(<path key={i} d={blob(r, x, y, 7 * s, 4 * s, 0.3, 6)} fill={fill} />);
      else edge.push(<path key={i} d={blob(r, x, y, 10 * s, 4 * s, 0.25, 7)} fill={fill} />);
      a += between(r, 0.12, 0.34);
      i++;
    }
  } else if (style.edge === 'ripple') {
    // 끊긴 물결 고리 두 겹 (가운데가 조금씩 어긋나게)
    edge.push(<ellipse key="r1" cx={cx} cy={cy + 2} rx={rx * 1.1} ry={ry * 1.12} fill="none" stroke={c2} strokeWidth={PIXEL} strokeDasharray="60 22 34 18" opacity={0.85} />);
    edge.push(<ellipse key="r2" cx={cx + 6} cy={cy + 4} rx={rx * 1.24} ry={ry * 1.28} fill="none" stroke={c1} strokeWidth={PIXEL} strokeDasharray="28 30 70 26" opacity={0.6} />);
  } else {
    edge.push(<ellipse key="m1" cx={cx} cy={cy - 3} rx={rx * 0.86} ry={ry * 0.74} fill="none" stroke={c1} strokeWidth={PIXEL * 2} />);
    edge.push(<ellipse key="m2" cx={cx} cy={cy - 3} rx={rx * 0.5} ry={ry * 0.4} fill="none" stroke={c2} strokeWidth={PIXEL} />);
  }

  // 윗면 점 무늬 (흙·풀·얼음 결)
  const specks: ReactNode[] = [];
  if (!man) {
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 0.8;
      specks.push(<rect key={i} x={f(cx + Math.cos(a) * rx * d)} y={f(cy + Math.sin(a) * ry * d)} width={PIXEL * 2} height={PIXEL} fill={style.speck} />);
    }
  }

  return (
    <g>
      <path d={side} fill={style.side} />
      <path d={top} fill={style.rim} />
      {man ? (
        <ellipse cx={cx} cy={cy - 3} rx={rx * 0.94} ry={ry * 0.84} fill={style.top} />
      ) : (
        <path d={blob(r, cx - rx * 0.03, cy - ry * 0.1, rx * 0.9, ry * 0.76, 0.04, 12)} fill={style.top} />
      )}
      {!man && <path d={blob(r, cx - rx * 0.18, cy - ry * 0.22, rx * 0.5, ry * 0.36, 0.18, 9)} fill={style.patch} />}
      {specks}
      {edge}
    </g>
  );
}

// ════════════════════════════════════════════
// 장소별 배경
// ════════════════════════════════════════════

function FieldScene() {
  return (
    <>
      <Bands id="f-sky" y0={0} y1={HORIZON} colors={['#79C3EE', '#8BCCF0', '#9FD6F2', '#B5DFF4', '#CBE9F4']} />
      <Cloud seed={3} x={90} y={64} w={190} />
      <Cloud seed={8} x={560} y={40} w={120} />
      <Cloud seed={21} x={1010} y={88} w={230} />
      <Trees seed={101} base={HORIZON - 34} hMin={8} hMax={34} step={[70, 130]} color="#9DCBB0" />
      <Trees seed={7} base={HORIZON - 8} hMin={20} hMax={62} step={[60, 110]} color="#5C9E6E" light="#76B482" />
      <Trees seed={33} base={HORIZON - 30} hMin={30} hMax={96} step={[70, 150]} color="#2F7A3E" light="#4E9E4F" dark="#246231" trunk="#5B4532" />
      <Bands id="f-ground" y0={HORIZON} y1={H} colors={['#A6DC72', '#9AD569', '#8ECD60', '#82C457', '#76BA4E', '#6BB046']} perspective />
      <Scatter seed={5} y0={HORIZON + 8} count={70} draw={grassTuft('#5E9F42', '#B3E07E')} />
    </>
  );
}

/** 숲: 하늘이 조금만 보이게 나무가 빽빽하고, 잎 사이로 햇살이 비스듬히 든다 */
function ForestScene() {
  const rays = [[120, 90], [430, 60], [780, 110], [1060, 70]].map(([x, w], i) => (
    // 바닥 끝까지 내려 중간에서 잘린 경계가 보이지 않게
    <path key={i} d={`M${x} 0 L${x + w} 0 L${x + w + 470} ${H} L${x + 330} ${H} Z`} fill="#FFF3C0" opacity={0.1 + (i % 2) * 0.04} />
  ));
  return (
    <>
      <Bands id="fo-sky" y0={0} y1={160} colors={['#A8DCC4', '#BCE5CF', '#CFEDD9']} />
      <Trees seed={61} base={120} hMin={10} hMax={70} step={[90, 170]} color="#2C6A3A" light="#3F8449" />
      <Trees seed={62} base={HORIZON - 50} hMin={20} hMax={80} step={[80, 150]} color="#21592D" light="#36763F" dark="#194823" />
      <Trees seed={63} base={HORIZON - 22} hMin={30} hMax={110} step={[90, 170]} color="#1B4D27" light="#2F6E38" dark="#123A1C" trunk="#3E2E22" />
      <Bands id="fo-ground" y0={HORIZON} y1={H} colors={['#74B652', '#69AB4A', '#5EA043', '#53953C', '#498A35']} perspective />
      <Scatter seed={14} y0={HORIZON + 6} count={80} draw={grassTuft('#3F7F30', '#8CC965')} />
      <Scatter seed={15} y0={HORIZON + 10} count={18} draw={(r, x, y, s, i) => <rect key={i} x={f(x)} y={f(y)} width={f(PIXEL * 2 * s)} height={PIXEL} fill={r() < 0.5 ? '#D9B44A' : '#C46A3A'} />} />
      {rays}
    </>
  );
}

/** 동굴: 바위 결이 있는 벽, 들쭉날쭉한 종유석, 바닥의 바위와 조약돌, 안쪽에서 새는 빛 */
function CaveScene() {
  const r = seeded(77);
  const stalactites: ReactNode[] = [];
  for (let x = -20; x < W + 40; ) {
    const w = between(r, 26, 70);
    const h = between(r, 30, 140);
    const tip = x + w * between(r, 0.35, 0.65);
    stalactites.push(
      <g key={x}>
        <path d={`M${f(x)} 0 L${f(x + w * 0.2)} ${f(h * 0.4)} L${f(tip)} ${f(h)} L${f(x + w * 0.8)} ${f(h * 0.5)} L${f(x + w)} 0 Z`} fill="#2C2018" />
        <path d={`M${f(x + w * 0.15)} 0 L${f(x + w * 0.28)} ${f(h * 0.38)} L${f(tip)} ${f(h)} L${f(x + w * 0.42)} 0 Z`} fill="#4A382B" />
      </g>,
    );
    x += w * between(r, 0.7, 1.4);
  }
  const rocks: ReactNode[] = [];
  for (let i = 0; i < 8; i++) {
    const x = between(r, -40, W + 40);
    const rw = between(r, 50, 130);
    const rh = rw * between(r, 0.45, 0.75);
    rocks.push(
      <g key={i}>
        <path d={blob(r, x, HORIZON + 6, rw, rh, 0.22, 8)} fill="#4C392C" />
        <path d={blob(r, x - rw * 0.25, HORIZON + 6 - rh * 0.4, rw * 0.45, rh * 0.32, 0.3, 7)} fill="#65503F" />
      </g>,
    );
  }
  const veins = Array.from({ length: 6 }, (_, i) => {
    const y = 70 + i * 28 + between(r, -8, 8);
    return <path key={i} d={`M-10 ${f(y)} Q ${f(between(r, 200, 500))} ${f(y + between(r, -24, 24))} ${f(between(r, 600, 800))} ${f(y + between(r, -10, 10))} T ${W + 10} ${f(y + between(r, -20, 20))}`} stroke="#1E1610" strokeWidth={PIXEL} fill="none" opacity={0.7} />;
  });
  return (
    <>
      <defs>
        <radialGradient id="c-glow" cx="0.55" cy="0.5" r="0.55">
          <stop offset="0" stopColor="#F2C890" stopOpacity="0.2" />
          <stop offset="1" stopColor="#F2C890" stopOpacity="0" />
        </radialGradient>
      </defs>
      <Bands id="c-wall" y0={0} y1={HORIZON + 10} colors={['#1C140F', '#261B15', '#30231B', '#3B2C22', '#463428']} />
      {veins}
      {stalactites}
      {rocks}
      <Bands id="c-ground" y0={HORIZON + 10} y1={H} colors={['#7D6651', '#735D49', '#695341', '#5F4A39', '#554232']} perspective />
      <Scatter seed={9} y0={HORIZON + 16} count={46} draw={(rr, x, y, s, i) => <path key={i} d={blob(rr, x, y, 5 * s, 3 * s, 0.3, 6)} fill={rr() < 0.5 ? '#4A3A2D' : '#927A64'} />} />
      <rect width={W} height={H} fill="url(#c-glow)" />
    </>
  );
}

/** 물가: 수평선이 보이는 바다, 나무가 자란 먼 섬, 크기가 제각각인 물결 */
function WaterScene() {
  const r = seeded(41);
  return (
    <>
      <Bands id="w-sky" y0={0} y1={HORIZON - 28} colors={['#66BCEE', '#7AC6F0', '#90D0F2', '#A9DCF5', '#C3E8F7']} />
      <Cloud seed={12} x={170} y={70} w={200} />
      <Cloud seed={19} x={760} y={46} w={140} />
      <defs>
        {/* 섬 위 나무는 섬 폭 안에서만 보이게 */}
        <clipPath id="w-island">
          <path d={`M850 ${HORIZON - 20} Q 870 ${HORIZON - 70} 960 ${HORIZON - 74} Q 1060 ${HORIZON - 70} 1080 ${HORIZON - 20} Z`} />
        </clipPath>
      </defs>
      <rect x={0} y={HORIZON - 30} width={W} height={32} fill="#86C9E8" />
      {/* 먼 섬: 바위 덩어리 위에 나무 혹 */}
      <g clipPath="url(#w-island)">
        <Trees seed={42} base={HORIZON - 44} hMin={4} hMax={26} step={[26, 44]} color="#4F8A62" light="#69A578" bottom={HORIZON - 20} />
      </g>
      <path d={blob(r, 960, HORIZON - 24, 150, 34, 0.18, 10)} fill="#6E8E7E" />
      <path d={blob(r, 120, HORIZON - 16, 80, 16, 0.2, 8)} fill="#83A795" />
      <Bands id="w-sea" y0={HORIZON} y1={H} colors={['#52AADA', '#4A9FD2', '#4294CA', '#3A89C1', '#327EB8']} perspective />
      <Scatter
        seed={43}
        y0={HORIZON + 6}
        count={60}
        draw={(rr, x, y, s, i) => {
          const w = (16 + rr() * 26) * s;
          return <path key={i} d={`M${f(x - w)} ${f(y)} Q${f(x)} ${f(y - 5 * s)} ${f(x + w)} ${f(y)}`} stroke={rr() < 0.7 ? '#DDF2FB' : '#9FD3EE'} strokeWidth={PIXEL} fill="none" />;
        }}
      />
    </>
  );
}

/** 설원: 흐린 하늘, 들쭉날쭉한 설산, 층이 진 침엽수, 흩날리는 눈 */
function SnowScene() {
  const r = seeded(51);
  // 산 능선: 봉우리마다 높이·간격이 다르다
  const peaks: [number, number][] = [];
  for (let x = -40; x < W + 80; x += between(r, 120, 260)) peaks.push([x, HORIZON - between(r, 50, 175)]);
  let ridge = `M-40 ${HORIZON}`;
  peaks.forEach(([x, y], i) => {
    const next = peaks[i + 1];
    ridge += ` L${f(x)} ${f(y)}`;
    if (next) ridge += ` L${f((x + next[0]) / 2)} ${f(Math.max(y, next[1]) + between(r, 20, 50))}`;
  });
  ridge += ` L${W + 80} ${HORIZON} Z`;
  const caps = peaks.map(([x, y], i) => {
    const w = (HORIZON - y) * 0.45;
    const d = (HORIZON - y) * 0.28;
    return <path key={i} d={`M${f(x)} ${f(y)} L${f(x - w)} ${f(y + d)} L${f(x - w * 0.5)} ${f(y + d * 0.75)} L${f(x - w * 0.1)} ${f(y + d * 1.05)} L${f(x + w * 0.35)} ${f(y + d * 0.7)} L${f(x + w * 0.8)} ${f(y + d * 0.95)} Z`} fill="#F7FAFD" />;
  });
  const pines = (seed: number, base: number, size: number, color: string, shade: string) => {
    const pr = seeded(seed);
    const out: ReactNode[] = [];
    for (let x = -30; x < W + 40; ) {
      const h = size * between(pr, 0.7, 1.3);
      const w = h * between(pr, 0.36, 0.46);
      const tiers = 3;
      for (let t = 0; t < tiers; t++) {
        const ty = base - h + (t * h) / tiers;
        const tw = w * ((t + 1) / tiers) * 1.1;
        const th = (h / tiers) * 1.5;
        out.push(<path key={`${x}-${t}`} d={`M${f(x)} ${f(ty)} L${f(x + tw)} ${f(ty + th)} L${f(x - tw)} ${f(ty + th)} Z`} fill={color} />);
        out.push(<path key={`${x}-${t}d`} d={`M${f(x)} ${f(ty + th * 0.45)} L${f(x + tw)} ${f(ty + th)} L${f(x + tw * 0.2)} ${f(ty + th)} Z`} fill={shade} />);
        out.push(<path key={`${x}-${t}s`} d={`M${f(x)} ${f(ty)} L${f(x + tw * 0.55)} ${f(ty + th * 0.5)} L${f(x)} ${f(ty + th * 0.4)} L${f(x - tw * 0.8)} ${f(ty + th * 0.7)} Z`} fill="#F5F9FC" />);
      }
      x += w * between(pr, 1.0, 1.7);
    }
    return out;
  };
  return (
    <>
      <Bands id="s-sky" y0={0} y1={HORIZON} colors={['#AFC2D7', '#BDCDDF', '#CBD8E6', '#D9E3EE', '#E5ECF3']} />
      <path d={ridge} fill="#AEBFD2" transform="translate(16 10)" />
      <path d={ridge} fill="#C3D1E0" />
      {caps}
      {pines(52, HORIZON + 2, 80, '#46707A', '#355A63')}
      {pines(53, HORIZON + 14, 108, '#365E67', '#284A52')}
      <Bands id="s-ground" y0={HORIZON} y1={H} colors={['#EEF4FA', '#E6EEF6', '#DEE8F1', '#D5E1EC', '#CCDAE7']} perspective />
      <Scatter seed={54} y0={HORIZON + 10} count={30} draw={(rr, x, y, s, i) => <path key={i} d={blob(rr, x, y, 18 * s, 4 * s, 0.25, 7)} fill={rr() < 0.5 ? '#FFFFFF' : '#C4D3E2'} />} />
      <Scatter seed={55} y0={0} count={60} draw={(rr, x, y, _s, i) => <rect key={i} x={f(x)} y={f(y * rr())} width={PIXEL * (rr() < 0.3 ? 2 : 1)} height={PIXEL * (rr() < 0.3 ? 2 : 1)} fill="#FFFFFF" />} />
    </>
  );
}

/** 체육관: 실내. 높은 창, 천장 조명, 관장 깃발, 소실점으로 모이는 바닥 타일, 경기장 선 */
function GymScene() {
  const vx = W / 2;
  const mid = (HORIZON + H) / 2 + 22;
  const lines = Array.from({ length: 15 }, (_, i) => {
    const x = (i - 7) * 210 + vx;
    return <line key={i} x1={f(vx + (x - vx) * 0.2)} y1={HORIZON} x2={f(x)} y2={H} stroke="#6B7D96" strokeWidth={PIXEL} />;
  });
  const rows = Array.from({ length: 6 }, (_, i) => {
    const y = HORIZON + (H - HORIZON) * Math.pow((i + 1) / 6, 1.7);
    return <rect key={i} x={0} y={f(y)} width={W} height={PIXEL} fill="#6B7D96" />;
  });
  return (
    <>
      <Bands id="g-wall" y0={0} y1={HORIZON} colors={['#1F2B3C', '#273548', '#2F3F55', '#384A62', '#41546E']} />
      <rect x={0} y={0} width={W} height={30} fill="#18212E" />
      {[70, 300, 520, 760, 1000, 1190].map((x, i) => (
        <g key={i}>
          <rect x={x} y={24} width={84} height={9} fill="#F4EFCF" />
          <path d={`M${x} 33 L${x + 84} 33 L${x + 140} ${HORIZON} L${x - 56} ${HORIZON} Z`} fill="#F4EFCF" opacity={0.05} />
        </g>
      ))}
      {[40, 190, 340, 790, 940, 1090].map((x, i) => (
        <g key={i}>
          <rect x={x} y={52} width={110} height={70} fill="#5F86AE" />
          <path d={`M${x + 8} 116 L${x + 40} 58 L${x + 52} 58 L${x + 20} 116 Z`} fill="#8DB1D3" opacity={0.6} />
          <rect x={x} y={52} width={110} height={70} fill="none" stroke="#22303F" strokeWidth={PIXEL * 2} />
          <rect x={x + 53} y={52} width={PIXEL * 2} height={70} fill="#22303F" />
        </g>
      ))}
      <rect x={0} y={138} width={W} height={PIXEL * 2} fill="#22303F" />
      <path d={`M${vx - 70} 46 L${vx + 70} 46 L${vx + 70} 150 L${vx} 176 L${vx - 70} 150 Z`} fill="#9E3B3B" />
      <path d={`M${vx + 40} 46 L${vx + 70} 46 L${vx + 70} 150 L${vx + 40} 164 Z`} fill="#7E2C2C" />
      <rect x={vx - 70} y={46} width={140} height={12} fill="#C9A045" />
      <path d={`M${vx} 84 L${vx + 26} 110 L${vx} 136 L${vx - 26} 110 Z`} fill="#E7D6A6" />
      <rect x={0} y={HORIZON - 16} width={W} height={16} fill="#1F2A39" />
      <Bands id="g-floor" y0={HORIZON} y1={H} colors={['#8698B0', '#91A2B8', '#9CACC0', '#A7B6C9', '#B2C0D2']} perspective />
      {lines}
      {rows}
      <ellipse cx={vx} cy={mid} rx={240} ry={54} fill="none" stroke="#E9EFF6" strokeWidth={PIXEL * 2} opacity={0.6} />
      <rect x={0} y={mid - PIXEL} width={W} height={PIXEL * 2} fill="#E9EFF6" opacity={0.45} />
    </>
  );
}

/** 포켓몬리그: 어두운 방, 빛을 받는 쪽이 있는 기둥, 날개 문장, 스포트라이트, 윤이 나는 바닥 */
function LeagueScene() {
  const pillars = [60, 290, 990, 1220].map((x, i) => (
    <g key={i}>
      <rect x={x - 36} y={20} width={72} height={HORIZON - 20} fill="#281C3B" />
      <rect x={x - 36} y={20} width={18} height={HORIZON - 20} fill="#3B2B55" />
      <rect x={x + 20} y={20} width={16} height={HORIZON - 20} fill="#1B1229" />
      <rect x={x - 46} y={HORIZON - 20} width={92} height={20} fill="#1D142E" />
      <rect x={x - 46} y={12} width={92} height={14} fill="#1D142E" />
      <rect x={x - 46} y={12} width={92} height={PIXEL} fill="#B3862C" />
    </g>
  ));
  const spots = [PLATFORMS.enemy.cx, PLATFORMS.player.cx].map((x, i) => (
    <path key={i} d={`M${x - 36} 0 L${x + 40} 0 L${x + 250} ${H} L${x - 270} ${H} Z`} fill="#F7E7B0" opacity={0.07} />
  ));
  return (
    <>
      <Bands id="l-wall" y0={0} y1={HORIZON} colors={['#0C0714', '#130C1F', '#1B122B', '#231837', '#2B1E43']} />
      <g transform={`translate(${W / 2} 108)`}>
        <path d="M-50 -16 L-140 -40 L-110 -6 L-150 4 L-60 18 Z M50 -16 L140 -40 L110 -6 L150 4 L60 18 Z" fill="#3B2B55" stroke="#7D5F25" strokeWidth={PIXEL} />
        <path d="M0 -58 L44 -24 L30 40 L0 58 L-30 40 L-44 -24 Z" fill="#2F2147" stroke="#B3862C" strokeWidth={PIXEL * 2} />
        <path d="M0 -30 L18 -8 L0 30 L-18 -8 Z" fill="#F2C14E" opacity={0.8} />
      </g>
      {pillars}
      <Bands id="l-floor" y0={HORIZON} y1={H} colors={['#2C2041', '#261B39', '#201731', '#1A1229', '#140D21']} perspective />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} x={0} y={f(HORIZON + 20 + i * i * 5.5)} width={W} height={PIXEL} fill="#6A4E96" opacity={0.3} />
      ))}
      {spots}
    </>
  );
}

const SCENES: Record<string, () => ReactNode> = {
  field: FieldScene,
  forest: ForestScene,
  cave: CaveScene,
  water: WaterScene,
  snow: SnowScene,
  gym: GymScene,
  league: LeagueScene,
};

/**
 * 그림을 SVG로 만든 뒤 1/3 해상도 캔버스에 안티에일리어싱 없이 그려, 픽셀 그대로 키워 보여준다.
 * 캔버스가 준비되기 전(첫 프레임)에는 SVG를 그대로 보여준다.
 */
export function BattleBackdrop({ env = 'field' }: { env?: string }) {
  const image = useAssetImage([BACKGROUNDS[env]]);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const Scene = SCENES[env] ?? FieldScene;
  const style = PLATFORM_STYLE[env] ?? PLATFORM_STYLE.field;

  useEffect(() => {
    const svg = svgRef.current;
    const canvas = canvasRef.current;
    if (!svg || !canvas || image === undefined) return;
    setReady(false);
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    const img = new Image();
    let alive = true;
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      if (!alive || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setReady(true);
    };
    img.src = url;
    return () => {
      alive = false;
    };
  }, [env, image]);

  return (
    <div className="absolute inset-0">
      {image && <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        className={`absolute inset-0 h-full w-full ${ready ? 'invisible' : ''}`}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        shapeRendering="crispEdges"
        aria-hidden
      >
        {!image && <Scene />}
        <Platform seed={1} {...PLATFORMS.enemy} style={style} />
        <Platform seed={2} {...PLATFORMS.player} style={style} />
      </svg>
      <canvas
        ref={canvasRef}
        width={Math.round(W / PIXEL)}
        height={Math.round(H / PIXEL)}
        className={`absolute inset-0 h-full w-full object-cover ${ready ? '' : 'invisible'}`}
        style={{ imageRendering: 'pixelated' }}
        aria-hidden
      />
    </div>
  );
}
