# Roomfit

실측 치수 기반 3D 방에 가구를 배치해 보는 집꾸미기 **앱**(안드로이드·아이폰)과, 같은 화면을 쓰는 웹·API 서버입니다.

## 앱 받기 (안드로이드)

`main` 브랜치에 올리면 GitHub Actions가 APK를 만들어 **Releases**에 `roomfit.apk`로 올립니다.
휴대폰에서 Releases 페이지를 열어 받은 뒤 설치하면 됩니다 ("출처를 알 수 없는 앱" 허용 필요).

- 앱이 접속하는 서버: 기본 `http://223.130.151.95:3100`.
  바꾸려면 저장소 Settings → Secrets and variables → Actions → **Variables**에 `ROOMFIT_API_URL`을 넣고 다시 빌드
- 아이폰: Actions → build-app → Run workflow에서 "아이폰 빌드 확인"을 켜면 빌드 확인만 합니다.
  실제 설치·앱스토어 출시는 애플 개발자 계정(연 $99)과 서명 설정이 필요합니다.

## 구조

| 부분 | 위치 | 설명 |
|---|---|---|
| 앱 화면 | `src/components`, `mobile/` | 웹과 같은 React 코드. `mobile/build.mjs`가 앱용 번들(`mobile/www`)을 만든다 |
| 앱 껍데기 | `android/`, `ios/`, `capacitor.config.ts` | Capacitor 7 |
| API 서버 | `src/app/api`, `src/server` | 로그인·방 저장. 서버에서 PM2로 실행 (`deploy/`) |

앱은 쿠키 대신 로그인 토큰(기기 저장소 보관)으로 서버를 호출합니다. 웹은 쿠키를 씁니다.

## 웹·서버 개발

```bash
npm install
npm run dev          # http://localhost:3000
```

프로덕션 빌드: `npm run build && npm start`
충돌 판정 점검: `npm run check:geometry`
샘플 GLB 다시 만들기: `npm run models`

Node.js 22.13 이상이 필요합니다 (내장 SQLite 사용). 로컬 DB 파일은 `data/roomfit.db`에 생깁니다.

서버 배포(PM2): `deploy/DEPLOY.md` 참고. 서버에서 `bash deploy/deploy.sh` 한 줄로 설치·빌드·실행합니다.
웹 데모(단일 HTML) 빌드: `npm run build:demo`

## 구현된 기능

- **집 구조 편집** (상단 "집 구조" 모드)
  - 방을 여러 개 만들고 서로 붙이기: 직사각형·ㄱ자 프리셋, 벽 옆에 방 붙이기, 바닥을 끌면 다른 방 벽에 자동으로 붙음
  - 꼭짓점 끌기·추가(벽 가운데 ⊕)·삭제로 ㄱ자·대각선 등 자유로운 모양. 벽 길이 직접 입력
  - 벽에 문·창문 달기: 폭·높이·바닥에서 높이·위치 입력, 끌어서 옮기기. 방 사이 벽의 문은 두 방을 잇는다
  - 방마다 이름·천장 높이·면적(㎡/평) 표시
  - 벽 두께 12cm, 방 다각형은 안쪽 벽면 기준. 이웃 방은 벽 두께만큼 떨어져 붙고 그 벽은 한 번만 그린다
- 바닥, 벽, 조명, 그림자. 카메라 쪽 벽은 자동으로 숨김
- 3D 시점 ↔ 평면(직교) 시점 전환, 카메라 회전·확대·축소
- 가구 추가 · 선택 · 드래그 이동 (1cm 스냅) · 회전 · 복제 · 삭제
- 회전: 선택 시 나타나는 파란 점을 드래그 (15° 스냅, Shift로 자유 회전), Q/E 키, ±90° 버튼, 각도 직접 입력
- 선택한 가구의 실제 치수 라벨과 위치·회전값 직접 입력
- 경고 (배치는 막지 않음): 벽 침범(꺾인 벽·대각선 벽 포함), 방 바깥, 가구끼리 겹침, 천장보다 높음
  - 회전된 가구도 정확히 판정하도록 바닥 투영 사각형(OBB) + 분리축 정리 사용
  - 러그처럼 `collides: false`인 상품은 겹침 검사 제외
- 배치 목록과 예시 가격 합계
- 회원가입·로그인 (이메일 + 비밀번호). 로그인하면 내 방을 서버에서 불러오고, 바꿀 때마다 자동 저장
  - 비밀번호는 scrypt 해시로만 저장, 세션은 HttpOnly 쿠키 (30일)
  - 로그인 10회 실패 시 15분 제한, 다른 사이트에서 오는 요청 차단
  - 가입 전 이 브라우저에서 꾸미던 방은 가입할 때 계정으로 옮김
  - 저장 상태 표시(저장됨/저장 중/저장 실패), 연결이 끊기면 자동 재시도

### 단축키

| 키 | 동작 |
|---|---|
| 방향키 | 1cm 이동 (Shift: 10cm) |
| Q / E | 15° 회전 (Shift: 90°) |
| Ctrl/⌘ + D | 복제 |
| Delete / Backspace | 삭제 |
| Esc | 선택 해제 |

## 좌표계 규약

- 단위 미터, Y-up, 바닥 y = 0
- 방 원점은 바닥 중앙. 내부는 x ∈ [−가로/2, 가로/2], z ∈ [−세로/2, 세로/2]
- 벽 두께(10cm)는 방 바깥쪽에 두어 내부 치수에 영향이 없음
- 가구 모델 원점은 바닥면 중앙, 정면은 +Z
- 로딩 시 바운딩 박스로 원점을 다시 맞추고, 상품 치수와 1cm 이상 다르면 콘솔에 경고

## 구조

```
src/
  app/                       Next.js App Router 진입점
  lib/
    types.ts                 Room, Product, PlacedItem, SceneData 타입
    catalog.ts               테스트 카탈로그 (3단계에서 API로 교체)
    geometry.ts              바닥 투영, 겹침·벽 침범 판정 (three.js 비의존)
    plan.ts                  방 다각형·벽·공유벽·문/창문 구멍 계산 (three.js 비의존)
  server/                    DB(SQLite)·인증·저장소 (서버 전용)
  app/api/                   auth/signup·login·logout, me, projects/[id]
  store/editorStore.ts       장면 데이터 + UI 상태 (zustand)
  components/
    three/                   3D 렌더링 (SceneCanvas, RoomMesh, FurnitureItem)
    editor/                  패널 UI (Editor, NumberField)
public/models/*.glb          테스트용 가구 모델 7종 (실제 치수)
scripts/
  generate-models.mjs        테스트 GLB 생성기
  geometry-check.ts          충돌·평면 계산 점검 (32개 케이스)
```

상품 정보(`Product`)와 배치 데이터(`PlacedItem`)는 분리되어 있으며, 저장 대상은 `SceneData`(방 치수 + 배치 목록)뿐입니다.

## 테스트 모델 안내

`public/models`의 가구는 상자를 조합해 만든 테스트 모델이며 실제 상품과 연결되어 있지 않습니다. 가격은 예시값으로, 화면에 "(예시)"로 표시됩니다.

## 다음 단계

1. 문 열림 공간·통로 폭 검사
2. 상품 카탈로그 API로 `catalog.ts` 교체
3. 예산 입력과 초과 표시, 구매처 링크
