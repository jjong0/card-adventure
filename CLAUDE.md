# CLAUDE.md

하트골드 스토리를 따라가는 포켓몬 카드 가챠 + 갈림길 지도 웹게임. 프론트엔드 취업 포트폴리오 겸 취미 프로젝트.

**기획의 기준은 `docs/spec.md`다.** 작업 전에 해당 절을 읽는다. spec의 "확정" 항목(§1)을 바꿔야 할 것 같으면 구현하기 전에 사용자에게 먼저 묻는다. §12 미정 항목은 기본값으로 진행하고 바꾼 값을 알려준다.

## 대화
- 사용자와는 한국어로, 간결하게. 결정이 필요하면 선택지와 트레이드오프를 짧게 제시한다.
- 게임 UI 문구도 한국어. 포켓몬·기술·도구 이름은 공식 한국어 이름(데이터에 있음)을 쓴다.

## 명령어
```bash
npm run dev          # 개발 서버
npm run build        # 타입 체크 + 빌드
npm test             # vitest
npm run sim          # 밸런스 측정: 난이도별 자동 플레이 (SIM_RUNS=30, SIM_DETAIL=1)
node scripts/build-data.mjs       # PokeAPI → species/moves/learnsets/typeChart/expTable
node scripts/build-trainers.mjs   # 하트골드 원본 → trainers.json (build-data 다음에 실행)
node scripts/build-evolutions.mjs # PokeAPI → evolutions.json (build-data 다음에 실행)
node scripts/build-chapters.mjs   # overrides/chapters.json + 하트골드 야생 출현 → chapters.json (build-trainers 다음에 실행)
node scripts/build-tm-compat.mjs  # 하트골드 기술머신 + 종별 호환 → tmCompat.json (build-data 다음에 실행)
node scripts/build-items.mjs      # overrides/held-items.json + PokeAPI 한국어 → heldItems.json
node scripts/build-move-fx.mjs    # 기술 → 연출 계열(물기·광선 등) → moveFx.json (build-data 다음에 실행)
node scripts/verify-type-chart.mjs # 상성표 324칸 검증
```
spec §11의 1~7단계는 끝났고, 8단계(MVP)는 밸런스·README·시연 GIF까지 끝났다(Vercel 배포만 남음). 밸런스를 바꾸면 `npm run sim`으로 난이도별 클리어율을 확인한다. 다음은 9단계(3~22챕터 데이터 등)다. 전투 연출 확인용 테스트 전투는 주소에 `?test=battle`(+ `&moves=기술slug,…`)을 붙여 연다.

## 구조 규칙
- `src/core/`는 **순수 TypeScript**. React, 브라우저 API, Zustand를 import하지 않는다. 모든 규칙은 여기서 구현하고 Vitest로 테스트한다.
  - `battle.ts`: 전투 엔진. `battle(state, action, dex) → newState` 순수 함수. 상태를 직접 바꾸지 않는다(내부에서 structuredClone).
  - `card.ts`: ★등급, 개체값 포인트(2V 상한), 중복 합치기, 기술 장착
  - `gacha.ts`: 시드 RNG, 팩 개봉, 보관함 자동 합치기
- 난수는 반드시 `createRng(seed)`를 쓴다. `Math.random()` 금지. 같은 시드면 같은 결과가 나와야 한다.
- `src/data/*.json`은 스크립트가 생성한다. **직접 수정하지 않는다.** 수동 수정은 `src/data/overrides/`에 두고 스크립트가 반영하게 한다. 예외: `src/data/assets.json`(이미지 경로)은 수동 관리.
- 전투 로그 문구에는 `은(는)`, `이(가)`, `을(를)`, `(으)로`를 쓰고 `fixJosa`로 처리한다.
- 원작 수치(데미지 공식, 상태이상 확률 등)를 바꿀 때는 출처를 주석으로 남긴다.

## 테스트
- 기존 테스트 34개(`battle.test.ts`, `card.test.ts`)는 항상 통과해야 한다.
- `src/core`에 규칙을 추가하면 테스트도 같이 추가한다. 확률 규칙은 시드를 고정하거나 대량 시뮬레이션으로 검증한다.
- 작업 단위를 마칠 때 `npm test`와 `npm run build`를 실행한다.

## 에셋과 IP
- 포켓몬 스프라이트는 PokeAPI sprites URL을 직접 쓴다(spec §9.1의 대체 순서).
- 그 외 이미지(관장, 트레이너, 도시 배경, 노드 아이콘)는 사용자가 수집해서 `public/assets/`에 넣거나, 웹에서 원작을 참고해 **비슷한 느낌으로 직접 그려서(SVG 등) 코드로 넣는다**(예: 전투 배경 `BattleBackdrop.tsx`).
- 경로는 `src/data/assets.json`에서만 관리하고, **파일이 없으면 기본 표시로 대체**한다.
- `public/assets/` 안의 이미지는 커밋하지 않는다(`.gitkeep`만).
- 원작 게임의 대사·음악은 쓰지 않는다. 대사는 직접 작성한다.

## 커밋
- 사용자가 요청할 때만 커밋한다. 메시지는 한국어, `feat:` `fix:` `refactor:` `test:` `docs:` `chore:` 접두어.
