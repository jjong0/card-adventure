// 밸런스 측정: 난이도별로 여러 시드를 끝까지 플레이하고 표로 출력한다.
// 평소 npm test에서는 건너뛰고, npm run sim으로만 돈다 (수십 초~몇 분 걸림). 봇이 도달한 챕터까지 출력한다.
import { describe, it } from 'vitest';
import { DIFFICULTIES } from '../core/difficulty';
import { playthrough } from './playthrough';

// 앱 tsconfig에는 Node 타입이 없어서, 이 파일에서 쓰는 만큼만 선언한다 (vitest는 Node에서 돈다)
declare const process: { env: Record<string, string | undefined> };

const RUNS = Number(process.env.SIM_RUNS ?? 20);

describe.skipIf(!process.env.SIM)('밸런스 시뮬레이션', () => {
  it(`난이도별 ${RUNS}판`, () => {
    const rows: string[] = [];
    for (const d of DIFFICULTIES) {
      const results = Array.from({ length: RUNS }, (_, i) => playthrough(d, 1000 + i));
      const last = Math.max(...results.flatMap((r) => r.chapters.map((c) => c.chapter)));
      for (let ch = 1; ch <= last; ch++) {
        const stats = results.map((r) => r.chapters.find((c) => c.chapter === ch)).filter((c) => c !== undefined);
        const cleared = stats.filter((c) => c.cleared);
        const avg = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '-');
        rows.push(
          [d.padEnd(8), `${ch}장`, `도달 ${stats.length}/${RUNS}`, `클리어 ${cleared.length}`, `재시작 평균 ${avg(cleared.map((c) => c.restarts))}`,
            `전투 ${avg(cleared.map((c) => c.battles))}`, `관장전 최고Lv ${avg(cleared.map((c) => c.topLevel))}`, `파티 ${avg(cleared.map((c) => c.partySize))}`].join(' | '),
        );
      }
    }
    console.log('\n' + rows.join('\n'));
    if (process.env.SIM_DETAIL) {
      for (const d of DIFFICULTIES) {
        for (let i = 0; i < 4; i++) {
          const r = playthrough(d, 1000 + i);
          console.log(d, r.chapters.map((c) => `${c.chapter}장 ${c.cleared ? '클리어' : '실패'}: ${c.losses.join(', ') || '패배 없음'}`).join(' / '));
        }
      }
    }
  });
});
