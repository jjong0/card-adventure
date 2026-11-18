# 필요한 이미지 목록

`public/assets/` 아래에 아래 파일 이름으로 넣으면 `src/data/assets.json`을 통해 자동 적용된다. 없는 파일은 기본 표시(색 테두리 + 이름)로 대체되므로 **모으는 대로 하나씩 넣으면 된다.**

- 형식: PNG 권장(투명 배경). 트레이너·관장은 정면 전신, 높이 256px 이상
- 이 폴더의 이미지는 Git에 올리지 않는다(.gitignore). 공개 배포 시 직접 만든 이미지로 교체할 수 있게 경로를 바꾸지 말 것

## 1. 챕터 지도 배경 `public/assets/map/`

| 파일 | 장 | 장소 | 관장 |
|---|---|---|---|
| city-01.png | 1 | 도라지시티 | 비상 |
| city-02.png | 2 | 고동마을 | 호일 |
| city-03.png | 3 | 금빛시티 | 꼭두 |
| city-04.png | 4 | 인주시티 | 유빈 |
| city-05.png | 5 | 진청시티 | 사도 |
| city-06.png | 6 | 담청시티 | 규리 |
| city-07.png | 7 | 황토마을 | 류옹 |
| city-08.png | 8 | 검은먹시티 | 이향 |
| city-09.png | 9 | 석영고원 | 일목 |
| city-10.png | 10 | 석영고원 | 독수 |
| city-11.png | 11 | 석영고원 | 시바 |
| city-12.png | 12 | 석영고원 | 카렌 |
| city-13.png | 13 | 석영고원 | 목호 |
| city-14.png | 14 | 연분홍시티 | 도희 |
| city-15.png | 15 | 갈색시티 | 마티스 |
| city-16.png | 16 | 회색시티 | 웅 |
| city-17.png | 17 | 블루시티 | 이슬 |
| city-18.png | 18 | 노랑시티 | 초련 |
| city-19.png | 19 | 무지개시티 | 민화 |
| city-20.png | 20 | 쌍둥이섬 | 강연 |
| city-21.png | 21 | 상록시티 | 그린 |
| city-22.png | 22 | 은빛산 | 레드 |

## 2. 노드 아이콘 `public/assets/nodes/`

지도에서 노드 종류마다 공통으로 뜨는 아이콘. 작은 도트(24~32px)가 노드 원에 잘 맞는다. 배경이 투명하지 않으면 흰 상자처럼 보이니 투명 PNG로.

| 파일 | 노드 | 추천 그림 |
|---|---|---|
| grass.png | 야생 포켓몬 | 풀숲 |
| trainer.png | 트레이너 | 몬스터볼 (가방 아이템 아이콘) |
| elite.png | 엘리트 (라이벌 그림이 없으면 라이벌 노드도) | 하이퍼볼 |
| center.png | 휴식·강화 | 포켓몬센터 |
| mart.png | 상점 | 프렌들리숍 |

## 2-1. 관장 노드 배지 `public/assets/badges/`

관장 노드에는 그 체육관 배지가 뜬다. 배지 그림이 없으면 아래 3절의 관장 그림, 그것도 없으면 글자로 대체한다.
사천왕·챔피언·레드(9~13장, 22장)는 배지가 없어 관장 그림을 쓴다.

| 파일 | 배지 | 관장 | 장 |
|---|---|---|---|
| zephyr-badge.png | 윙배지 | 비상 | 1 |
| hive-badge.png | 인섹트배지 | 호일 | 2 |
| plain-badge.png | 레귤러배지 | 꼭두 | 3 |
| fog-badge.png | 팬텀배지 | 유빈 | 4 |
| storm-badge.png | 쇼크배지 | 사도 | 5 |
| mineral-badge.png | 스틸배지 | 규리 | 6 |
| glacier-badge.png | 아이스배지 | 류옹 | 7 |
| rising-badge.png | 라이징배지 | 이향 | 8 |
| soul-badge.png | 핑크배지 | 도희 | 14 |
| thunder-badge.png | 오렌지배지 | 마티스 | 15 |
| boulder-badge.png | 그레이배지 | 웅 | 16 |
| cascade-badge.png | 블루배지 | 이슬 | 17 |
| marsh-badge.png | 골드배지 | 초련 | 18 |
| rainbow-badge.png | 레인보우배지 | 민화 | 19 |
| volcano-badge.png | 크림슨배지 | 강연 | 20 |
| earth-badge.png | 그린배지 | 그린 | 21 |

## 3. 관장·사천왕·챔피언·레드 `public/assets/leaders/`

| 파일 | 인물 | 장 |
|---|---|---|
| falkner.png | 비상 | 1 |
| bugsy.png | 호일 | 2 |
| whitney.png | 꼭두 | 3 |
| morty.png | 유빈 | 4 |
| chuck.png | 사도 | 5 |
| jasmine.png | 규리 | 6 |
| pryce.png | 류옹 | 7 |
| clair.png | 이향 | 8 |
| will.png | 일목 | 9 |
| koga.png | 독수 | 10 |
| bruno.png | 시바 | 11 |
| karen.png | 카렌 | 12 |
| lance.png | 목호 | 13 |
| janine.png | 도희 | 14 |
| lt-surge.png | 마티스 | 15 |
| brock.png | 웅 | 16 |
| misty.png | 이슬 | 17 |
| sabrina.png | 초련 | 18 |
| erika.png | 민화 | 19 |
| blaine.png | 강연 | 20 |
| blue.png | 그린 | 21 |
| red.png | 레드 | 22 |

## 4. 트레이너 `public/assets/trainers/`

지도 노드에는 쓰지 않는다(노드는 2절의 공통 아이콘). 나중에 대화 화면·전투 시작 연출에서 인물 그림으로 쓴다. 라이벌 노드만 `rival.png`이 있으면 지도에도 뜬다.
직업 키는 하트골드 원본 데이터의 `TRAINERCLASS_` 뒤 이름이다(괄호 안은 원본 데이터에 등장하는 트레이너 수).

| 파일 | 직업 키 | 등장 수 |
|---|---|---|
| rival.png | (라이벌) | 24 |
| fisherman.png | FISHERMAN | 36 |
| school-kid-m.png | SCHOOL_KID_M | 34 |
| team-rocket.png | TEAM_ROCKET | 33 |
| picnicker.png | PICNICKER | 32 |
| bird-keeper-gs.png | BIRD_KEEPER_GS | 31 |
| bug-catcher.png | BUG_CATCHER | 30 |
| camper.png | CAMPER | 30 |
| hiker.png | HIKER | 30 |
| biker.png | BIKER | 26 |
| swimmer-m.png | SWIMMER_M | 25 |
| ace-trainer-f.png | ACE_TRAINER_F | 24 |
| ace-trainer-m.png | ACE_TRAINER_M | 24 |
| swimmer-f.png | SWIMMER_F | 24 |
| beauty.png | BEAUTY | 20 |
| lass.png | LASS | 20 |
| youngster.png | YOUNGSTER | 18 |
| super-nerd.png | SUPER_NERD | 17 |
| pokefan-m.png | POKEFAN_M | 16 |
| poke-maniac.png | POKE_MANIAC | 15 |
| sailor.png | SAILOR | 15 |
| twins.png | TWINS | 15 |
| black-belt.png | BLACK_BELT | 12 |
| psychic-m.png | PSYCHIC_M | 12 |
| firebreather.png | FIREBREATHER | 11 |
| sage.png | SAGE | 11 |
| gentleman.png | GENTLEMAN | 9 |
| medium.png | MEDIUM | 9 |
| pokefan.png | POKEFAN | 8 |
| scientist-gs.png | SCIENTIST_GS | 8 |
| teacher.png | TEACHER | 7 |
| young-couple.png | YOUNG_COUPLE | 7 |
| juggler.png | JUGGLER | 6 |
| kimono-girl.png | KIMONO_GIRL | 6 |
| boarder.png | BOARDER | 5 |
| team-rocket-f.png | TEAM_ROCKET_F | 5 |
| burglar.png | BURGLAR | 3 |
| double-team.png | DOUBLE_TEAM | 3 |
| passerby.png | PASSERBY | 3 |
| skier.png | SKIER | 3 |
| executive-ariana.png | EXECUTIVE_ARIANA | 2 |
| executive-petrel.png | EXECUTIVE_PETREL | 2 |
| executive-proton.png | EXECUTIVE_PROTON | 2 |
| guitarist.png | GUITARIST | 2 |
| policeman.png | POLICEMAN | 2 |
| arcade-star.png | ARCADE_STAR | 1 |
| castle-valet.png | CASTLE_VALET | 1 |
| elder.png | ELDER | 1 |
| executive-archer.png | EXECUTIVE_ARCHER | 1 |
| factory-head.png | FACTORY_HEAD | 1 |
| hall-matron.png | HALL_MATRON | 1 |
| mystery-man.png | MYSTERY_MAN | 1 |
| rocket-boss.png | ROCKET_BOSS | 1 |
| tower-tycoon.png | TOWER_TYCOON | 1 |

MVP(1~2장)만 먼저 하려면: 노드 아이콘 5개(grass, trainer, elite, center, mart), 배지 2개(zephyr-badge, hive-badge), rival, 그리고 지도 배경 city-01·02부터 모으면 된다.

## 5. 기술 이펙트 `public/assets/fx/`

기술을 쓸 때 재생되는 이펙트 그림이다. 없으면 이펙트 없이 피격 반응(타입 색 번쩍임)만 나온다.

**형식**
- 정사각형 프레임을 **가로로 이어 붙인 PNG 한 장**(스프라이트 시트), 투명 배경. 프레임 수는 가로÷세로로 자동 계산한다(64×64 프레임 8장이면 512×64).
- 기본 15fps로 재생한다. 기술 연출 시간이 0.8초라 **12프레임 이하**를 권장한다.
- 도트 이펙트를 권장한다(포켓몬 스프라이트와 화풍을 맞추기 위해). 확대는 픽셀이 뭉개지지 않게 그대로 키운다.

**파일** (경로와 설정은 `src/data/assets.json`의 `fx`)

| 파일 | 쓰이는 기술 | 놓는 방식 | 그림 예 |
|---|---|---|---|
| physical.png | 물리 기술 기본 (몸통박치기 등) | 대상 위 | 타격 섬광 |
| special.png | 특수 기술 기본 (불꽃세례 등) | 쓰는 쪽 → 대상으로 날아감 | 빛 구체 |
| status.png | 변화 기술 기본 (째려보기, 칼춤 등) | 대상 위 | 반짝임·오라 |
| bite.png | 물기 (깨물어부수기, 불꽃엄니) | 대상 위 | 이빨이 맞물림 |
| punch.png | 펀치·킥 (불꽃펀치, 두번차기) | 대상 위 | 주먹 충격 |
| slash.png | 베기 (베어가르기, 리프블레이드) | 대상 위 | 베기 궤적 |
| beam.png | 광선 (냉동빔, 파괴광선) | 쓰는 쪽에서 대상까지 늘임 | 가로로 긴 빛줄기 (프레임은 정사각형, 가로로 늘어남) |
| stream.png | 방사 (화염방사, 물대포) | 쓰는 쪽에서 대상까지 늘임 | 가로로 긴 줄기 |
| fall.png | 낙하 (번개, 눈보라) | 대상 위, 크게 | 위에서 떨어지는 것 |
| quake.png | 지진 (지진, 땅고르기) | 대상 위, 크게 | 땅 균열·돌 (화면 흔들림은 자동) |
| sound.png | 소리 (울음소리, 하이퍼보이스) | 쓰는 쪽 → 대상으로 날아감 | 음파 |
| explode.png | 폭발 (대폭발, 자폭) | 쓰는 쪽 위, 아주 크게 | 폭발 |

**더 구체적인 그림 추가하기**: `assets.json`의 `fx`에 키를 더하면 위 파일보다 먼저 쓰인다. 찾는 순서는 `move:기술slug` → `계열.타입` → `계열` → `분류.타입` → `분류`.
```json
"special.fire": { "src": "/assets/fx/special-fire.png", "at": "travel" },
"beam.ice": { "src": "/assets/fx/beam-ice.png", "at": "line", "size": 96 },
"move:thunderbolt": { "src": "/assets/fx/thunderbolt.png", "at": "target", "size": 256 }
```
`at`: target(대상 위) / user(쓰는 쪽 위) / travel(날아감) / line(늘임), `size`: 표시 크기 px(기본 192), `fps`: 기본 15.

**그림 고르는 기준**
- **원작 게임에서 추출하거나 원작 이펙트를 따라 그린 그림은 쓰지 않는다.** 스프라이트 추출 사이트의 포켓몬 이펙트, 다른 팬게임의 이펙트도 마찬가지다.
- 라이선스가 명확한 것만: **CC0**(출처 표시 불필요)를 우선, CC-BY는 아래 표에 출처를 남긴다. "개인 사용만 허용", 재배포 금지 라이선스는 피한다.
- 일반 판타지·RPG용 도트 이펙트 팩(타격, 불, 얼음, 번개, 폭발 등)이 잘 맞는다.

**출처 기록** (CC-BY 등 표시가 필요한 그림)

| 파일 | 작품명 | 작가 | 라이선스 | 링크 |
|---|---|---|---|---|
| | | | | |
