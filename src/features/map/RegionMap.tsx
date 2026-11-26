// 포켓기어 타운맵 풍 지방 지도 (직접 그린 SVG, 이미지 파일 없음). 지도 화면 오른쪽 칸의 미니맵.
// 1~13장은 성도, 14~22장은 관동. 이번 챕터 마을은 빛나고, 지나온 마을과 길은 금색.
// 마을 위치·해안선·도로망은 원작(금·은 / 하트골드) 타운맵의 칸 배치를 따라 직접 다시 그렸다.
// 좌표는 타운맵을 20×16칸(성도)·20×18칸(관동) 격자로 본 칸 번호다.
import { useReducedMotion } from 'framer-motion';

const VW = 1000;
const VH = 800;

type Region = 'johto' | 'kanto';
interface Town {
  name: string;
  /** 칸 좌표 */
  x: number;
  y: number;
  /** 도시(큰 칸)인지 마을(작은 칸)인지 */
  big?: boolean;
}

const GRID: Record<Region, { cols: number; rows: number }> = {
  johto: { cols: 20, rows: 16 },
  kanto: { cols: 20, rows: 18 },
};

const TOWNS: Record<Region, Record<string, Town>> = {
  johto: {
    newbark: { name: '연두마을', x: 15.5, y: 12.5 },
    cherrygrove: { name: '무궁시티', x: 12.5, y: 12.5 },
    violet: { name: '도라지시티', x: 11.5, y: 7.5, big: true },
    azalea: { name: '고동마을', x: 8.5, y: 13.5 },
    goldenrod: { name: '금빛시티', x: 5.5, y: 10, big: true },
    ecruteak: { name: '인주시티', x: 6.5, y: 5.5, big: true },
    olivine: { name: '담청시티', x: 3, y: 7.5, big: true },
    cianwood: { name: '진청시티', x: 1, y: 10.5 },
    mahogany: { name: '황토마을', x: 11.5, y: 4.5 },
    rage: { name: '분노의호수', x: 11.5, y: 1.8 },
    blackthorn: { name: '검은먹시티', x: 15.5, y: 3.5, big: true },
    indigo: { name: '석영고원', x: 18.5, y: 3.5, big: true },
  },
  kanto: {
    silver: { name: '은빛산', x: 1, y: 6 },
    indigo: { name: '석영고원', x: 2.5, y: 2.5 },
    pallet: { name: '태초마을', x: 4.5, y: 13.5 },
    viridian: { name: '상록시티', x: 4.5, y: 9.5, big: true },
    pewter: { name: '회색시티', x: 4.5, y: 4.5, big: true },
    cerulean: { name: '블루시티', x: 12.5, y: 3.5, big: true },
    saffron: { name: '노랑시티', x: 12.5, y: 7.5, big: true },
    celadon: { name: '무지개시티', x: 8.5, y: 7.5, big: true },
    lavender: { name: '보라타운', x: 16.5, y: 7.5 },
    vermilion: { name: '갈색시티', x: 12.5, y: 11.5, big: true },
    fuchsia: { name: '연분홍시티', x: 9.5, y: 15, big: true },
    seafoam: { name: '쌍둥이섬', x: 7, y: 16.5 },
    cinnabar: { name: '홍련섬', x: 4.5, y: 16.5 },
  },
};

/** 도로 (원작 도로 번호 순서대로 잇는 마을 쌍과 꺾이는 점). 흐리게 그린다 */
type Road = [string, string, ...[number, number][]];
const ROADS: Record<Region, Road[]> = {
  johto: [
    ['newbark', 'cherrygrove'],                         // 29번도로
    ['cherrygrove', 'violet', [12.5, 7.5]],             // 30·31번도로
    ['violet', 'azalea', [11.5, 13.5]],                 // 32·33번도로 (연결동굴)
    ['azalea', 'goldenrod', [5.5, 13.5]],               // 너도밤나무숲·34번도로
    ['goldenrod', 'ecruteak', [5.5, 7.5], [6.5, 7.5]],  // 35·36·37번도로 (자연공원)
    ['violet', 'ecruteak', [6.5, 7.5]],                 // 36번도로
    ['ecruteak', 'olivine', [3, 5.5]],                  // 38·39번도로
    ['olivine', 'cianwood', [3, 10.5]],                 // 40·41번수로 (소용돌이섬)
    ['ecruteak', 'mahogany'],                           // 42번도로
    ['mahogany', 'rage'],                               // 43번도로
    ['mahogany', 'blackthorn', [15.5, 4.5]],            // 44번도로·얼음길
    ['blackthorn', 'newbark', [15.5, 9.5], [16.5, 11.5]], // 45·46번도로
    ['newbark', 'indigo', [18.5, 12.5]],                // 27·26번도로 (도호폭포)
  ],
  kanto: [
    ['pallet', 'viridian'],                             // 1번도로
    ['viridian', 'pewter'],                             // 2번도로 (상록숲)
    ['pewter', 'cerulean', [9.5, 4.5], [10.5, 3.5]],    // 3·4번도로 (달맞이산)
    ['cerulean', 'saffron'],                            // 5번도로
    ['saffron', 'vermilion'],                           // 6번도로
    ['saffron', 'celadon'],                             // 7번도로
    ['saffron', 'lavender'],                            // 8번도로
    ['cerulean', 'lavender', [16.5, 3.5]],              // 9·10번도로 (돌산터널)
    ['vermilion', 'lavender', [16.5, 11.5]],            // 11·12번도로
    ['lavender', 'fuchsia', [16.5, 13.5], [12.5, 15]],  // 12·13·14·15번도로
    ['celadon', 'fuchsia', [7, 7.5], [7, 15]],          // 16·17·18번도로 (사이클링로드)
    ['fuchsia', 'seafoam', [9.5, 16.5]],                // 19·20번수로
    ['seafoam', 'cinnabar'],                            // 20번수로
    ['cinnabar', 'pallet'],                             // 21번수로
    ['viridian', 'indigo', [2.5, 9.5]],                 // 22·23번도로 (챔피언로드)
    ['viridian', 'silver', [1, 9.5]],                   // 22·28번도로
  ],
};

/** 챕터 → 지방과 마을 (spec §2) */
const CHAPTER_TOWN: Record<number, [Region, string]> = {
  1: ['johto', 'violet'], 2: ['johto', 'azalea'], 3: ['johto', 'goldenrod'], 4: ['johto', 'ecruteak'],
  5: ['johto', 'cianwood'], 6: ['johto', 'olivine'], 7: ['johto', 'mahogany'], 8: ['johto', 'blackthorn'],
  9: ['johto', 'indigo'], 10: ['johto', 'indigo'], 11: ['johto', 'indigo'], 12: ['johto', 'indigo'], 13: ['johto', 'indigo'],
  14: ['kanto', 'fuchsia'], 15: ['kanto', 'vermilion'], 16: ['kanto', 'pewter'], 17: ['kanto', 'cerulean'],
  18: ['kanto', 'saffron'], 19: ['kanto', 'celadon'], 20: ['kanto', 'seafoam'], 21: ['kanto', 'viridian'], 22: ['kanto', 'silver'],
};

/** 지방마다 여정의 출발점: 성도는 연두마을, 관동은 배(아쿠아호)가 닿는 갈색시티 */
const START: Record<Region, string> = { johto: 'newbark', kanto: 'vermilion' };

/** 땅 (칸 좌표 다각형). 원작 해안선을 칸 단위로 따라 그렸다 */
const LAND: Record<Region, [number, number][][]> = {
  johto: [
    // 본토: 서쪽은 담청시티 앞바다, 남쪽은 금빛·고동·무궁 해안, 동쪽은 27번도로 해안
    [[2, 1], [9, 0.6], [14, 0.6], [17, 1], [19.6, 1.6], [19.6, 9], [19, 12], [19.6, 14.2], [17, 14.4], [14, 14], [12, 14.6], [10, 15.2], [7, 15.2], [5, 14.6], [4.4, 12.6], [4, 11], [4.4, 9.4], [2, 9], [1.4, 6], [1.6, 3]],
    // 진청시티 해안
    [[0.2, 9.4], [1.8, 9.2], [2, 12], [0.4, 12.4]],
  ],
  kanto: [
    // 본토: 남서쪽 바다(19~21번수로)와 남쪽 해안을 비운다
    [[1.8, 0.8], [8, 0.6], [14, 0.6], [18, 1], [19, 3], [19, 10], [18.4, 13], [17, 15.2], [14, 15.6], [11.5, 16], [8.6, 16], [8, 14.6], [6, 14.6], [5.6, 15], [3.4, 15], [3, 12], [2.4, 10.4], [1.6, 8], [1.6, 3]],
    // 은빛산 (28번도로 서쪽)
    [[0, 4], [1.2, 4.4], [1.6, 8], [1.2, 10.4], [0, 10.6]],
    // 쌍둥이섬, 홍련섬
    [[6.2, 15.9], [7.8, 15.9], [7.8, 17.2], [6.2, 17.2]],
    [[3.8, 15.9], [5.2, 15.9], [5.2, 17.2], [3.8, 17.2]],
  ],
};

/** 물 (호수) */
const LAKES: Record<Region, [number, number, number][]> = {
  johto: [[11.5, 1.8, 0.9]], // 분노의호수
  kanto: [],
};

/** 산 표시 (작은 삼각형): 원작 타운맵의 산 칸 */
const PEAKS: Record<Region, [number, number][]> = {
  johto: [[14, 3], [17.5, 7], [9, 11.5], [2.6, 3.4]],
  kanto: [[0.6, 5.2], [0.6, 7.4], [8, 3.6], [15, 5.5]],
};

function scale(region: Region) {
  const { cols, rows } = GRID[region];
  return (x: number, y: number) => [(x / cols) * VW, (y / rows) * VH] as const;
}

/** 이 지방에서 들르는 마을 순서 (출발점 → 챕터 순서) */
function journey(region: Region): string[] {
  const order = [START[region]];
  for (let c = 1; c <= 22; c++) {
    const [r, id] = CHAPTER_TOWN[c];
    if (r === region && order.at(-1) !== id) order.push(id);
  }
  return order;
}

/**
 * 타운맵 카드 (오른쪽 정보 칸): 지방 윤곽, 도로망, 지나온 길과 마을, 이번 챕터 마을.
 * 갈림길 지도와 겹치면 노드에 가려서 따로 둔다.
 */
export function RegionMap({ chapter }: { chapter: number }) {
  const reduce = useReducedMotion();
  const [region, here] = CHAPTER_TOWN[chapter] ?? CHAPTER_TOWN[1];
  const towns = TOWNS[region];
  const S = scale(region);
  const route = journey(region);
  const hereIdx = route.indexOf(here);
  const poly = (pts: [number, number][]) => pts.map(([x, y]) => S(x, y).map((v) => v.toFixed(0)).join(',')).join(' ');
  const roadPoints = ([a, b, ...via]: Road) => [[towns[a].x, towns[a].y], ...via, [towns[b].x, towns[b].y]] as [number, number][];

  return (
    <svg className="block h-full w-full" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${region === 'johto' ? '성도' : '관동'} 지방 지도, 지금 ${towns[here].name}`}>
      <defs>
        <radialGradient id="rm-glow">
          <stop offset="0" stopColor="#F2C14E" stopOpacity="0.6" />
          <stop offset="1" stopColor="#F2C14E" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 땅: 원작 타운맵처럼 각진 해안선 (테두리를 한 번 더 그려 얕은 바다처럼) */}
      {LAND[region].map((shape, i) => (
        <g key={i}>
          <polygon points={poly(shape)} fill="none" stroke="#1D3A55" strokeWidth="18" strokeLinejoin="round" />
          <polygon points={poly(shape)} fill="#1A3049" stroke="#3A6488" strokeWidth="3" strokeLinejoin="round" />
        </g>
      ))}
      {LAKES[region].map(([x, y, r], i) => {
        const [cx, cy] = S(x, y);
        return <ellipse key={i} cx={cx} cy={cy} rx={(r / GRID[region].cols) * VW} ry={(r / GRID[region].rows) * VH * 0.8} fill="#101A2A" stroke="#3A6488" strokeWidth="3" />;
      })}
      {PEAKS[region].map(([x, y], i) => {
        const [cx, cy] = S(x, y);
        return <path key={i} d={`M${cx - 22} ${cy + 16} L${cx} ${cy - 18} L${cx + 22} ${cy + 16} Z`} fill="#24425E" stroke="#3A6488" strokeWidth="3" strokeLinejoin="round" />;
      })}

      {/* 도로망 (흐리게) */}
      {ROADS[region].map((road, i) => (
        <polyline key={i} points={poly(roadPoints(road))} fill="none" stroke="#2E5274" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
      ))}

      {/* 지나온 길 (금색) */}
      {route.slice(1, hereIdx + 1).map((id, i) => {
        const [x1, y1] = S(towns[route[i]].x, towns[route[i]].y);
        const [x2, y2] = S(towns[id].x, towns[id].y);
        return <line key={id} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#C9A045" strokeWidth="7" strokeDasharray="14 10" strokeLinecap="round" />;
      })}

      {/* 마을: 도시는 큰 칸, 마을은 작은 칸. 지나온 곳 금색, 지금 마을은 빛남 */}
      {Object.entries(towns).map(([id, t]) => {
        const [x, y] = S(t.x, t.y);
        const idx = route.indexOf(id);
        const passed = idx >= 0 && idx < hereIdx;
        const isHere = id === here;
        const size = isHere ? 46 : t.big ? 32 : 22;
        return (
          <g key={id}>
            {isHere && (
              <circle cx={x} cy={y} r="90" fill="url(#rm-glow)">
                {!reduce && <animate attributeName="r" values="70;100;70" dur="2.6s" repeatCount="indefinite" />}
              </circle>
            )}
            <rect x={x - size / 2} y={y - size / 2} width={size} height={size} rx="5" fill={isHere ? '#F2C14E' : passed ? '#C9A045' : '#2A4D70'} stroke={isHere ? '#FFF1C2' : passed ? '#E6C46A' : '#4A7AA2'} strokeWidth="4" />
          </g>
        );
      })}
    </svg>
  );
}
