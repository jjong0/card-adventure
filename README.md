# 카드 어드벤처

하트골드 스토리를 따라가는 카드 가챠 + 갈림길 지도 웹게임입니다.
몬스터볼 대신 카드팩으로 포켓몬을 모으고, 챕터마다 갈림길 지도를 지나 관장 22명에게 도전합니다.

> **비공식 팬 프로젝트**입니다. 닌텐도, 게임프리크, 주식회사 포켓몬과 관련이 없습니다.
> 수익(광고·후원·결제)을 내지 않습니다. 권리자의 요청이 있으면 바로 내리겠습니다.

**진행 상태**: 개발 중 (로드맵 1단계 완료 / 8단계에서 1~2챕터 MVP 배포)

## 특징

- **순수 함수 전투 엔진**: `battle(state, action, dex) → newState`. 시드 난수를 써서 같은 입력이면 항상 같은 결과가 나옵니다. 데미지 공식의 내림·반올림 순서까지 원작과 맞추고 테스트로 검증합니다.
- **카드 성장**: 같은 진화 계열 카드는 자동으로 합쳐져 ★등급이 오르고, 등급마다 받는 개체값 포인트를 직접 배분합니다(31 도달 스탯 최대 2개).
- **데이터 파이프라인**: PokeAPI CSV와 하트골드 디스어셈블리에서 종 1025개, 기술 691개, 원작 트레이너 파티를 스크립트로 생성합니다.

## 기술 스택

React 19 · TypeScript · Vite · Tailwind CSS v4 · Zustand · Framer Motion · Vitest

## 구조

```
src/
├─ core/    순수 TypeScript 게임 규칙 (React·브라우저 API 의존 없음, 전부 테스트)
├─ data/    스크립트가 생성한 JSON (수동 수정은 overrides/)
└─ app/     화면
scripts/    데이터 생성 스크립트
docs/       기획서(spec.md), 에셋 목록
```

설계와 규칙의 기준은 [docs/spec.md](docs/spec.md)입니다.

## 실행

```bash
npm install
npm run dev     # 개발 서버
npm test        # 테스트
npm run build   # 타입 체크 + 빌드
```

## 에셋

포켓몬 스프라이트는 [PokeAPI/sprites](https://github.com/PokeAPI/sprites) URL을 직접 불러옵니다.
그 밖의 이미지는 저장소에 포함하지 않으며, 없으면 색 테두리와 이름으로 된 기본 표시로 대체됩니다.

## 데이터 출처

- [PokeAPI](https://github.com/PokeAPI/pokeapi): 종, 기술, 상성, 경험치
- [pret/pokeheartgold](https://github.com/pret/pokeheartgold): 트레이너 파티

## 라이선스

코드는 [MIT](LICENSE)입니다. 포켓몬 관련 이름, 데이터, 이미지의 권리는 각 권리자에게 있으며 MIT 라이선스 대상이 아닙니다.
