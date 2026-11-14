// src/lib/dex.ts
// 생성된 정적 데이터를 core 함수들이 받는 형태로 한 번만 묶는다
import speciesList from '../data/species.json';
import moves from '../data/moves.json';
import typeChart from '../data/typeChart.json';
import learnsets from '../data/learnsets.json';
import trainersJson from '../data/trainers.json';
import expTable from '../data/expTable.json';
import evolutionsJson from '../data/evolutions.json';
import type { EncounterDex } from '../core/encounter';
import type { ProgressDex } from '../core/progress';
import type { Dex, Evolutions, Learnsets, Move, Species, Trainer, TypeChart } from '../core/types';

export const dex: Dex & EncounterDex & ProgressDex = {
  species: Object.fromEntries((speciesList as Species[]).map((s) => [s.id, s])),
  moves: moves as unknown as Record<string, Move>,
  typeChart: typeChart as TypeChart,
  learnsets: learnsets as Learnsets,
  expTable,
  evolutions: evolutionsJson as Evolutions,
};

export const trainers = trainersJson as Trainer[];
