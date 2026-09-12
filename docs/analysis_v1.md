# 카톡밀당분석기 1.0 — 코드베이스 분석

> 작성일: 2026-09-12 · 분석 대상 커밋: `dd6061a` (main, 총 18 커밋)
> 목적: 2.0 개발 착수 전 기존 자산 평가 및 의사결정 정리
> 원칙: 이 문서의 모든 판단은 실제 코드 근거(`파일:줄`)를 병기했습니다. 코드로 확인할 수 없는 항목은 **[미확인]** 으로 표시했습니다.

---

## 1. 프로젝트 전체 구조

### 1.1 기술 스택

| 영역 | 사용 기술 | 근거 |
|---|---|---|
| 빌드 | Vite 8 | `package.json`, `vite.config.js` |
| 프론트 | React 19 (SPA, 라우터 없음) | `src/main.jsx`, `src/App.jsx:11` STEPS 상태 머신 |
| 스타일 | Tailwind CSS 4 (CSS-first `@theme`) | `src/index.css:1-15` |
| 서버 | Express 5 + cors + dotenv | `server/index.js` |
| LLM | `@anthropic-ai/sdk` ^0.106.0 | `server/analyze.js:1`, `server/ocrScreenshots.js:1` |
| 이미지 캡처 | `html-to-image` | `src/utils/shareResultImage.js:1` |
| 린트 | oxlint (react rules 2개만) | `.oxlintrc.json` |
| 배포 | Render (free plan), 단일 Node 프로세스 | `render.yaml`, `server/index.js:196-202` |
| 타입 | **없음** — JSDoc 주석만 | 전 파일 `.js/.jsx` |
| 테스트 | **없음** — 테스트 파일·러너·스크립트 전무 | `package.json` scripts |

**언어/런타임**: ESM (`"type": "module"`), Node ≥ 20.

### 1.2 디렉토리와 파일 역할

```
├── index.html              SEO 메타·OG·JSON-LD·GSC 인증 (정적, SPA 진입점)
├── vite.config.js          /api, /ads.txt → localhost:3001 프록시 (dev)
├── render.yaml             Render 배포 정의 + env 선언
│
├── src/                    ── 프론트엔드 ──
│   ├── App.jsx             3단계 상태 머신(INPUT/LOADING/RESULT) + 분석 오케스트레이션
│   ├── main.jsx            루트 마운트 + AdSense 스크립트 주입
│   ├── index.css           Tailwind theme(brand=핑크) + 8종 커스텀 애니메이션
│   ├── components/  (15개) 화면 단위 UI
│   ├── utils/       (16개) 파싱·익명화·API 호출·로컬분석·공유·광고
│   └── data/mockResult.js  ★ 어디에서도 import되지 않는 죽은 파일
│
├── server/                 ── API 서버 ──
│   ├── index.js            라우트 5개 + 정적 서빙 + ads.txt 생성
│   ├── analyze.js          Claude 분석 호출
│   ├── ocrScreenshots.js   Claude Vision OCR 호출
│   ├── ocrPrompt.js        OCR 시스템 프롬프트
│   ├── quota.js            일일 사용량 정책 로직
│   ├── quotaStore.js       파일(JSON) 영속화
│   └── asyncHandler.js     async 라우트 래퍼
│
├── shared/                 ── 프론트·서버 공용 ──
│   ├── quotaConfig.js      3/3/6회, 45초 쿨다운 상수
│   ├── normalizeAnalysis.js  LLM 응답 정규화 + MOMENT_TYPE_LABELS
│   ├── enrichResult.js     LLM 응답 → 화면용 결과 객체 (RELATION_LABELS)
│   └── truncateForAnalysis.js  350개/14,000자 컷
│
├── blog/                   워드프레스 블로그 운영 문서 + 초안 2편 (코드 아님)
├── samples/                테스트용 카톡 대화 5종
├── public/                 favicon, icons, robots.txt, sitemap.xml
└── .github/workflows/      Render free tier sleep 방지 cron (14분마다 /api/health)
```

**구조상 특이점 — 서버가 프론트 소스를 직접 import**
`server/index.js:13-14`가 `../src/utils/parseChat.js`, `../src/utils/scrubResult.js`를 로드하고, `server/analyze.js:2`가 `../src/utils/apiPrompt.js`를 로드합니다. `shared/`라는 공용 디렉토리가 이미 있는데도 공용 모듈 절반이 `src/`에 남아 있어, 프론트/서버 경계가 무너져 있습니다. (`shared/truncateForAnalysis.js:1`도 `src/utils/parseChat.js`를 import)

### 1.3 사용자 플로우

```
[INPUT 화면]
 └ 탭 선택 (기본값: 📸 캡처)           MobileImportPanel.jsx:6  useState('screenshot')
   ├─ A. 스크린샷 (최대 6장, 순서 드래그)
   │    → [글자 뽑기] → POST /api/ocr-screenshots → Claude Haiku Vision
   │    → mergedText → 클라이언트 익명화 → 리뷰용 textarea에 표시
   │    ※ 여기서 AI 사용 1회 차감
   └─ B. 붙여넣기 / txt 업로드 / 직접 입력
        → deliverChatText(): 「나」 있으면 즉시 익명화, 실명 2명↑면 본인 선택 대기
 └ (필요시) SelfSpeakerPick — "이 중에 너는?" 본인 지목
 └ [🔥 호감도 분석 시작]
        ↓
[LOADING 화면]  ~30초
 └ 로컬 휴리스틱 즉시 결과("1차 점수") 표시 + 진행바(1.8초마다 +4%, 92%에서 정지)
 └ 6단계 스테이지 애니메이션 + 12종 랜덤 문구 + 광고 1개
 └ 백그라운드: POST /api/analyze → Claude Sonnet
        ↓
[RESULT 화면]
 └ 총점 → 심리분석 → 광고 → 추이차트 → 심층지표 → 결정적순간 → 광고
   → 주도권 → 세부점수 → AI요약 → 솔루션 → 광고
 └ (쿼터 부족 시) 공유하고 +1회 패널
 └ 결과 이미지 저장 / 카톡 공유 (html-to-image로 리포트 전체 캡처)
 └ [다른 카톡 분석하기]
```

### 1.4 입력 → 분석 → 결과 데이터 흐름

```
원문 chatText (실명 포함, React state에만 존재)
  │
  ├─(1) App.jsx:77  anonymizeChatText(chatText)
  │        parseChat.js:403 → 16종 정규식으로 파싱 → 발화자 순서 수집
  │        → speakerLabels.js:137 buildAnonymizationMap()
  │            나 → 「나」 / 상대 1명 → 「상대방」 / 다수 → 「상대방A,B…」
  │        → applySpeakerAnonymization(): ★줄머리 화자 위치만 치환
  │        결과: { anonymizedText, nameMap: { "김민수": "상대방", ... } }
  │
  ├─(2) App.jsx:78-79  analyzeLocally() → 로컬 휴리스틱 "1차 점수" (LOADING 화면용)
  │
  └─(3) App.jsx:97  analyzeChat(chatText)
           anonymize.js:11 익명화 재실행(동일 연산 2회차)
           POST /api/analyze
             body: { text: anonymizedText, nameMap }   ← ★ nameMap에 실명 포함
             header: X-Device-Id
                │
                ▼ server/index.js:123
           쿼터 검사 → 텍스트 길이 검사(≥10자) → API 키 검사
           anonymizeChatText() 서버에서 또 실행 (3회차, index.js:155)
           analyzeWithClaude(anonymizedText)                  analyze.js:30
             ├ truncateChatForAnalysis(): 최근 350개 / 14,000자로 컷
             ├ client.messages.create({ model, max_tokens:4096, system, messages })
             ├ extractJson(): ```json 펜스 제거 → 첫 { ~ 마지막 } → JSON.parse
             └ enrichResult(): 관계유형 검증 → 라벨 부착 → 필드 정규화·clamp
           scrubResultNames(result, nameMap)                  index.js:168
           getConversationMeta()로 플랫폼·기간 메타 계산
           consumeQuota()  ← 성공한 뒤에만 차감 (실패 시 무료)
                │
                ▼
           클라이언트 anonymize.js:42  scrubResultNames() 한 번 더
           App.jsx:104  setResult() → ResultStep 렌더
```

**실패 시 폴백**: `analyzeChat`이 네트워크·JSON·HTTP 오류를 만나면 `runLocal()`(anonymize.js:13)이 로컬 휴리스틱 결과를 반환합니다. 사용자에게는 오류 없이 결과가 나오고, `source: 'local'`이라 결과 화면의 "· AI" 뱃지(ResultStep.jsx:125)만 사라집니다. **429 쿼터 초과만 예외적으로 throw**되어 공유 패널로 유도합니다.

### 1.5 외부 API / LLM / DB / 저장소 / 배포

| 구분 | 내용 | 근거 |
|---|---|---|
| LLM (분석) | Anthropic Messages API, 기본 `claude-sonnet-4-6`, max_tokens 4096 | `analyze.js:6,39-50` |
| LLM (OCR) | 기본 `claude-haiku-4-5`, 실패 시 분석 모델로 폴백 | `ocrScreenshots.js:51-101` |
| DB | **없음** | — |
| 저장소 | `server/data/quota.json` 평문 파일 1개 (기기별 사용횟수만) | `quotaStore.js:7` |
| 브라우저 저장 | `localStorage['heydaystar_device_id']` = UUID | `deviceId.js:1-14` |
| 대화 저장 | **없음** — 서버는 메모리에서만 처리, 로그에도 본문 미기록 | `index.js:162-165` (이름 매핑만 dev 로그) |
| 광고 | Google AdSense, `ads.txt`를 서버가 env로 동적 생성 | `index.js:46-56`, `adsense.js` |
| 배포 | Render free plan, `npm start` 단일 프로세스가 `dist/` + `/api` 서빙 | `render.yaml`, `index.js:196-202` |
| 슬립 방지 | GitHub Actions cron 14분마다 `/api/health` ping | `.github/workflows/keep-render-awake.yml` |
| 도메인 | 앱 `app.heydaystar.co.kr` / 블로그 `www.heydaystar.co.kr`(워드프레스) | `index.html:20`, `blog/SETUP.md` |

### 1.6 환경변수

| 변수 | 기본값 | 사용처 | render.yaml 선언 |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | — (필수) | analyze.js:9, ocrScreenshots.js:9 | ✅ |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | analyze.js:40 | ❌ **누락** |
| `ANTHROPIC_OCR_MODEL` | `claude-haiku-4-5` | ocrScreenshots.js:51 | ❌ **누락** |
| `PORT` | 3001 | index.js:24 | ❌ (Render 자동 주입) |
| `NODE_ENV` | — | index.js:25 | ✅ |
| `RATE_LIMIT_DISABLED` | false | quota.js:10 | ✅ |
| `ADSENSE_PUBLISHER_ID` | — | index.js:47 (ads.txt) | ✅ |
| `VITE_ADSENSE_CLIENT` | — | adsense.js:4 (빌드타임) | ✅ |
| `VITE_ADSENSE_SLOT_BANNER/RECTANGLE/LEADERBOARD` | — | adsense.js:6-8 | ✅ |
| `VITE_ADSENSE_SLOT_LOADING` | RECTANGLE로 폴백 | adsense.js:9-13 | ❌ **누락** (DEPLOY.md엔 있음) |

> `.env` 파일의 주석은 기본 모델을 `claude-sonnet-4-20250514`라고 적고 있으나 실제 코드 기본값은 `claude-sonnet-4-6`입니다. 문서·주석이 코드와 어긋나 있습니다.

---

## 2. 현재 구현된 기능 정리

### 2.1 카카오톡 대화 입력 (3가지 경로)

| 방식 | 구현 | 비고 |
|---|---|---|
| **스크린샷 OCR** | `ScreenshotImportPanel.jsx` — 최대 6장, 드래그로 순서 변경, 썸네일 미리보기, 개별 삭제 | 기본 탭. 클라이언트에서 1280px/JPEG q0.78로 리사이즈(`compressImage.js`) 후 base64 업로드 |
| **클립보드 붙여넣기** | `MobileImportPanel.jsx:22` `navigator.clipboard.readText()` | 권한 거부 시 `alert()`로 수동 붙여넣기 안내 |
| **txt 파일** | `MobileImportPanel.jsx:10` FileReader UTF-8 | 카톡 "대화 내용 → txt 저장" |
| (직접 타이핑) | textarea 직접 입력도 허용 | 3줄 이상 필요 (`App.jsx:36-37`) |

### 2.2 전처리 (이 프로젝트의 최대 자산)

- **16종 라인 패턴 파서** (`parseChat.js:27-105`): 카카오톡 4종(모바일 내보내기/PC 드래그/브래킷 헤더), LINE 4종, SMS 3종, generic 5종
- **멀티라인 복원** (`parseChat.js:213-314`): PC 카톡 드래그 시 "날짜줄 → 이름줄 → 본문줄"로 쪼개지는 형태를 `pendingSpeaker`/`pendingTs` 상태로 재조립
- **날짜 컨텍스트 전파** (`dateUtils.js`): `--- 2024년 6월 21일 ---` 구분선을 읽어 이후의 "오후 3:21"만 있는 줄에 날짜를 주입. 6종 날짜 포맷 파싱
- **플랫폼 자동 감지** (`parseChat.js:316-330`): 패턴 매칭 점수 + 키워드 가중치
- **익명화** (`speakerLabels.js`): 본인 별칭(나/내/본인/Me) 인식, 1:1이면 「상대방」, 다자면 「상대방A/B」, 레거시 라벨(사용자A/인물A) 자동 마이그레이션
- **본인 지목 UI** (`SelfSpeakerPick.jsx`): 실명이 2명 이상 남으면 분석 버튼을 막고 사용자가 본인을 고르게 함
- **OCR 세그먼트 병합** (`mergeOcrText.js`): 스크린샷 겹침 구간의 중복 줄 제거(직전 줄 + 최근 6줄 윈도우 비교)
- **분석 전 절삭** (`truncateForAnalysis.js`): 최근 350개 메시지 / 14,000자 이내로 축소

### 2.3 분석 로직 — 2개의 독립 엔진

**① 로컬 휴리스틱 엔진** (`analyzeLocal.js` 366줄 + `deepAnalysisLocal.js` 342줄)
- 8개 주제 규칙(게임/업무/운동/음식/학업/연애/일상) 정규식 카운트
- 관계 유형 분류: 연애 신호 4패턴 vs 플라토닉 신호 3패턴 점수 비교
- 지표 계산: 답장 풍부도, 이모티콘, 주도성(턴 시작 비율), 참여도
- 심층: 텍스트 미러링(길이/이모지/어휘 자카드/에코 4요소 가중합), 답장속도 비대칭(타임스탬프 갭 평균비), 날짜 버킷 기반 타임라인, 결정적 순간 스코어링
- 용도 ①: LOADING 화면의 즉각적 "1차 점수" ②: API 실패 시 폴백

**② Claude 엔진** (`apiPrompt.js` 3,493자 단일 시스템 프롬프트)
- 관계 5분류 → 심층 6항목(미러링/답장비대칭/타임라인/메타/결정적순간/심리요약) → JSON 스키마 강제
- 분량 규정이 프롬프트에 하드코딩: psychologySummary 6~8문장, aiSummary 5~8문장, solution 5~7개×2~3문장 등

### 2.4 AI 호출

- 분석: 시스템 프롬프트 + 단일 user 메시지(익명화 대화 + 절삭 안내), `max_tokens: 4096`
- OCR: 시스템 프롬프트 + `[텍스트 "이미지 n/N"] + [image 블록]` 반복, 모델 not_found 시 Sonnet 폴백
- JSON 파싱: 정규식으로 코드펜스 제거 → 첫 `{` ~ 마지막 `}` 슬라이스 → `JSON.parse` (**재시도 없음**)
- 구조화 출력(`output_config.format`), 프롬프트 캐싱, thinking 파라미터 **모두 미사용**

### 2.5 결과 생성

`enrichResult()` (`shared/enrichResult.js:47`)가 LLM 원응답을 화면 계약에 맞춥니다: 관계유형 화이트리스트 검증 → 5종 라벨 세트 부착 → 점수 0~100 clamp → `normalizeDeepAnalysis/Timeline/CriticalMoments`로 결측 필드 기본값 주입 → 레거시 화자 표기 일괄 치환(`normalizeReportCopy`). LLM이 필드를 빠뜨려도 화면은 깨지지 않도록 방어되어 있습니다.

### 2.6 결과 화면

총점 히어로 · 관계/플랫폼/기간 뱃지 · 주제 태그 · 심리분석(다크 그라데이션) · SVG 추이 차트(`AffectionTrendChart`) · 게이지 링 심층지표(`DeepMetricsPanel`) · 말풍선형 결정적 순간(`CriticalMomentBubbles`) · 주도권 바 · 세부 점수 바 · AI 요약 · 솔루션. 차트는 전부 외부 라이브러리 없이 직접 SVG로 그렸습니다.

### 2.7 공유 기능

- **결과 이미지**: `html-to-image`로 `exportRef` 하위 전체를 PNG 캡처. `data-export-exclude` 속성이 붙은 광고 슬롯은 필터로 제외(`shareResultImage.js:5-9`). 높이에 따라 pixelRatio 2 → 1.25 → 1 자동 조정
- **네이티브 공유**: `navigator.share` 파일 공유 지원 시 이미지 첨부, 아니면 다운로드 폴백
- **공유 보너스**: 링크 공유/복사 성공 → `POST /api/quota/share` → +1회 (하루 최대 3회, 45초 쿨다운)

### 2.8 광고

`AdSlot.jsx` 4개 variant(banner/rectangle/leaderboard/loading). env 미설정 시 회색 placeholder 렌더. 한 세션에서 노출되는 광고 위치: 입력화면 상단 1 + 로딩화면 1 + 결과화면 3 = 최대 5개.

### 2.9 사용량 제한 / 저장 기능

- 기본 3회 + 공유 보너스 3회 = 하루 최대 6회 (`shared/quotaConfig.js`)
- KST 자정 기준 리셋 (`quota.js:13-22`)
- 식별자: localStorage UUID를 `X-Device-Id` 헤더로 전송
- **대화 내용 저장 기능은 없음** (히스토리·재조회 불가)

---

## 3. 코드 자산 평가

### A. 2.0에서 그대로 재사용 가능

| 모듈 | 이유 |
|---|---|
| `src/utils/dateUtils.js` | 6종 날짜 포맷 파서 + 날짜 컨텍스트 전파. 순수 함수, 외부 의존 0. 한국어 카톡 날짜 처리는 직접 만들면 다시 몇 시간 걸리는 영역 |
| `src/utils/parseChat.js` (파서 부분) | 16종 패턴 + PC 드래그 멀티라인 복원. **실배포로 검증된 가장 값비싼 자산**. 실제 카톡 출력 형태를 상대로 쌓은 노하우라 재작성 시 회귀 위험이 큼 |
| `src/utils/mergeOcrText.js` | 24줄, 스크린샷 겹침 중복 제거. 단순·독립적 |
| `src/utils/compressImage.js` | Canvas 리사이즈 → base64. Vision API 비용 절감에 직접 기여. 범용 |
| `src/utils/shareResultImage.js` | html-to-image 래핑 + `navigator.share` 폴백 + `data-export-exclude` 필터. 공유가 성장 루프의 핵심이면 그대로 씀 |
| `src/components/AffectionTrendChart.jsx` · `DeepMetricsPanel.jsx` · `CriticalMomentBubbles.jsx` | 순수 프레젠테이션. props 계약만 유지하면 디자인 변경은 Tailwind 클래스 수정으로 흡수 |
| `src/index.css` 애니메이션 8종 | 브랜드 톤(핑크/보라). 재사용 |
| `samples/*.txt` | 5종 회귀 테스트 픽스처. 2.0 테스트 스위트의 출발점으로 즉시 활용 |
| `.github/workflows/keep-render-awake.yml` | Render free tier를 계속 쓸 경우 그대로 |

### B. 일부 수정 후 재사용 권장

| 모듈 | 수정 필요 사유 |
|---|---|
| `src/utils/speakerLabels.js` | 로직 자체는 견고하나 (a) 레거시 라벨(`사용자A`/`인물A`) 마이그레이션 코드가 전체의 30%를 차지 — 2.0에서 제거 가능 (b) `preprocessOcrSpeakers`(195줄)는 **모든 분기가 입력을 그대로 반환하는 실질 no-op** — 삭제 또는 구현 (c) 본문 내 실명은 익명화하지 않음(4.3 참조) — 보강 필요 |
| `shared/enrichResult.js` + `shared/normalizeAnalysis.js` | LLM 응답 방어 로직은 유지 가치가 높음. 단 결과 스키마가 2.0에서 바뀌면 필드 목록 동반 수정. `RELATION_LABELS`가 `analyzeLocal.js:6`과 **중복 정의되고 문구까지 다름** → 단일 소스로 통합 |
| `server/quota.js` + `shared/quotaConfig.js` | 정책 로직(쿼터 계산·공유보너스·KST 리셋)은 재사용 가치 있음. 단 **저장 계층 교체 필수** (4.2 참조) 및 식별자 전략 재설계 |
| `src/utils/analyzeLocal.js` · `deepAnalysisLocal.js` | "LLM 응답 전 즉시 1차 점수"라는 UX 장치는 이탈 방지에 효과적이므로 컨셉 유지. 단 **성별 추정 휴리스틱**(`analyzeLocal.js:64-65` `FEMALE_NAME_HINTS`, `MALE_SPEECH`)은 이름 끝 글자로 성별을 추정해 관계 유형을 바꾸는 코드로, 정확도·윤리 양면에서 2.0에 가져가면 안 됨 → 제거 후 재사용 |
| `src/components/ResultStep.jsx` | 258줄 단일 컴포넌트. 결과 구조가 바뀌지 않으면 그대로 쓸 수 있으나, 분해 + 광고 배치 재검토 권장 |
| `src/utils/apiPrompt.js` | 프롬프트 "내용"(심리학 관점, 관계 5분류, 심층 6항목)은 도메인 자산. 다만 단일 문자열 구조와 분량 하드코딩은 재설계 필요 (4.5 참조) |
| `index.html` SEO 메타 | 구조는 재사용. `og-image.png`가 **실제로 존재하지 않아** OG 카드가 깨지는 상태 → 이미지 추가 필요 |

### C. 새로 구현 권장

| 모듈 | 이유 |
|---|---|
| `server/index.js` | 211줄에 라우팅·검증·에러핸들링·정적서빙·ads.txt가 뒤섞여 있고, 에러 미들웨어가 **라우트보다 먼저 등록되어 죽은 코드**(30-38줄, 185줄에 정상 사본 존재). 라우터 분리 + 검증 계층 도입으로 재작성이 빠름 |
| `server/quotaStore.js` | 27줄 파일 JSON. Render free tier는 디스크가 휘발성이라 재시작·배포마다 초기화되고, read-modify-write에 잠금이 없어 동시 요청 시 갱신 유실. 영속 저장소로 교체 필요 |
| 인증/식별 체계 | 현재 localStorage UUID를 클라이언트가 헤더로 보내는 구조라 우회가 자명함(localStorage 삭제 또는 임의 UUID 생성). 비용 통제가 2.0의 전제라면 새 설계 필요 |
| LLM 호출 계층 | `extractJson` 정규식 파싱이 `analyze.js:14`와 `ocrScreenshots.js:14`에 **동일하게 중복**. 구조화 출력(`output_config.format`)으로 대체하면 파서와 재시도 로직이 통째로 불필요 |
| 에러 처리 · 관측 | `alert()` 3곳, `console.error` 뿐. 에러 바운더리·구조적 로깅·지표 없음 |
| 테스트 하네스 | 전무. 파서가 핵심 자산인데 회귀 방어가 없음 |
| 결과 저장/히스토리 | 기능 자체가 없음. 2.0에서 필요하다면 신규 |
| `src/data/mockResult.js` | 어디에서도 import되지 않는 죽은 파일. 삭제 |

---

## 4. 기술부채 및 개선사항

### 4.1 구조적 문제

1. **프론트/서버 경계 붕괴** — `server/index.js:13-14`, `server/analyze.js:2`, `shared/truncateForAnalysis.js:1`이 모두 `src/utils/*`를 import. `shared/`가 있는데도 공용 코드가 두 곳에 흩어져 있어, 프론트 리팩터가 서버를 깨뜨릴 수 있습니다.
2. **죽은 에러 미들웨어** — `server/index.js:30-38`의 4-arg 에러 핸들러가 모든 라우트보다 **앞에** 등록되어 있어 절대 실행되지 않습니다. 185줄에 동일 로직 사본이 올바른 위치에 있어 동작에는 문제가 없지만, 같은 코드가 두 벌 존재합니다.
3. **`App.jsx`가 오케스트레이터 겸 뷰** — 익명화·로컬분석·진행바 타이머·쿼터·스크롤·전환 애니메이션을 한 컴포넌트가 모두 처리(198줄).
4. **라우터 없음** — 결과 화면에 URL이 없어 공유 링크가 항상 홈으로 향합니다. 공유가 성장 루프의 축인데 공유 대상이 결과가 아닌 앱 첫 화면입니다.

### 4.2 사용량 제한(쿼터)의 구조적 취약성

| 문제 | 근거 | 영향 |
|---|---|---|
| 클라이언트가 자기 식별자를 생성·전송 | `deviceId.js:6` `crypto.randomUUID()` → `X-Device-Id` 헤더 | localStorage 삭제 또는 curl 한 줄로 무제한 사용 |
| CORS 전면 허용 | `index.js:27` `app.use(cors())` | 임의 오리진·스크립트가 API 직접 호출 가능 |
| 파일 저장소가 휘발성 | `quotaStore.js:7` 로컬 경로, Render free tier 디스크 비영속 | 배포·재시작·슬립마다 전원 쿼터 초기화 |
| 동시성 제어 없음 | `quota.js:107-115` read → 수정 → write, 잠금 없음 | 동시 요청 시 카운트 유실 |
| TOCTOU | `assertCanUseQuota`가 읽고, 이후 `consumeQuota`가 다시 읽음 | 동시 요청이 한도를 넘겨 통과 가능 |
| 키가 사용자 제어 문자열 | `quota.js:152` `/^[a-zA-Z0-9-]{8,64}$/` → 객체 키로 사용 | `__proto__`는 정규식에 막히나, `constructor` 등은 통과. `Map`/`Object.create(null)` 권장 |
| 스크린샷 경로는 2회 차감 | OCR 1회(`index.js:114`) + 분석 1회(`index.js:170`) | 기본 3회 중 캡처 분석은 1.5회분. 사용자 인지와 불일치 |

### 4.3 개인정보 처리 — 가장 시급한 항목

**세 가지 지점에서 제품이 약속한 내용과 실제 동작이 다릅니다.**

1. **스크린샷 원본이 익명화 전에 서버·Anthropic으로 전송됩니다.**
   `ScreenshotImportPanel.jsx:62-64` — `ocrScreenshots(files)`로 **원본 이미지를 먼저 업로드**하고, 익명화(`anonymizeChatText`)는 응답을 받은 **뒤에** 수행합니다. 즉 실명·프로필 사진·대화 전문이 그대로 외부로 나갑니다.
   그런데 `PrivacyBadge.jsx:10`은 "대화 내용은 서버에 저장하지 않아. 분석이 끝나면 브라우저에서만 처리돼", `README.md`는 "대화 원문은 브라우저에서 `[인물A]` 등으로 익명화 후 API로 전송"이라고 표기합니다. **기본 탭이 스크린샷이므로 대다수 사용자가 이 경로를 탑니다.**

2. **`nameMap`(실명 → 익명라벨 대응표)이 서버로 전송됩니다.**
   `anonymize.js:24` `body: JSON.stringify({ text: anonymizedText, nameMap })` → `index.js:124`에서 수신. 텍스트는 익명화됐지만 대응표가 함께 가므로, 서버 입장에서는 실명 복원이 가능합니다. (Claude에는 전달되지 않으나, 서버가 보유하는 것 자체가 고지 내용과 다릅니다.)

3. **메시지 본문 속 실명은 익명화되지 않습니다.**
   `speakerLabels.js:177-191` `applySpeakerAnonymization`은 줄머리 `이름 :`, `[이름]`, `, 이름 :` 위치만 치환합니다. "민수가 어제 그랬는데" 같은 본문 내 언급은 그대로 Claude로 전송됩니다. (돌아온 결과는 `scrubResultNames`가 치환하므로 화면에는 안 보이지만, 전송은 이미 일어난 뒤입니다.)

**부수 항목**: 개인정보처리방침·이용약관 페이지가 앱에 없습니다(`blog/SETUP.md`에 워드프레스용 문구 초안만 존재). 국내 서비스에서 민감한 대화를 다루면서 방침 페이지가 없는 것은 AdSense 정책 측면에서도 위험합니다.

### 4.4 중복 코드

| 중복 | 위치 | 비고 |
|---|---|---|
| `extractJson()` 완전 동일 | `analyze.js:14-21`, `ocrScreenshots.js:14-21` | 8줄 복붙 |
| `RELATION_LABELS` | `shared/enrichResult.js:8`, `analyzeLocal.js:6` | **문구가 다름** — LLM 경로는 "연애 심층 심리 분석 리포트", 로컬 경로는 "연애 감정 분석 리포트" |
| 에러 미들웨어 | `index.js:30-38`, `index.js:185-194` | 하나는 죽은 코드 |
| `anonymizeChatText()` 3회 실행 | `App.jsx:77`, `anonymize.js:11`, `index.js:155` | 동일 입력에 대해 파싱·정규식 3회 |
| `analyzeLocally()` 2회 실행 | `App.jsx:79`(프리뷰), `anonymize.js:16`(폴백) | 폴백 경로에서만 |
| `scrubResultNames()` 2회 | `index.js:168`(서버), `anonymize.js:42`(클라) | 서버에서 이미 치환된 결과를 다시 순회 |
| 로딩 단계 문구 | `App.jsx:17-24` `phaseForProgress`, `LoadingStep.jsx:12-19` `ANALYSIS_STAGES` | 같은 6단계를 두 곳에서 각각 정의 |
| 쿼터 초과 처리 | `anonymize.js:34-39`, `ocrScreenshots.js:90-95` | 동일 패턴 반복 |

### 4.5 LLM 프롬프트 구조

1. **단일 3,493자 문자열** (`apiPrompt.js`) — 역할·분류 기준·필드별 분량 규정·JSON 스키마가 한 덩어리. 항목별 실험/버전 관리가 불가능합니다.
2. **구조화 출력 미사용** — JSON을 산문으로 지시하고 정규식으로 긁어냅니다. 현재 API는 `output_config: { format: {...} }`로 스키마를 강제할 수 있어, `extractJson`과 파싱 실패 경로를 통째로 없앨 수 있습니다.
3. **파싱 실패 시 재시도 없음** — `analyze.js:55` `extractJson` 실패 → throw → 500 → 클라이언트가 조용히 로컬 폴백. **호출 비용은 이미 지불했는데 결과는 버려집니다.**
4. **`max_tokens: 4096`과 프롬프트 요구 분량이 상충할 소지** — 프롬프트는 psychologySummary 6~8문장 + aiSummary 5~8문장 + solution 5~7개×2~3문장 + criticalMoments 3~5개×2~4문장 + interpretation 2개×3~5문장 + timeline 3~8구간 insight를 한국어 JSON으로 요구합니다. 한국어는 토큰 효율이 낮아 4096 토큰 상한에 걸려 JSON이 중간에 끊길 수 있고, 그 경우 3번 경로로 빠집니다. **[미확인 — 실제 응답 토큰 수 로그가 없어 발생 빈도는 측정 불가]**
5. **프롬프트 캐싱 미적용** — 시스템 프롬프트가 매 요청 동일한데 `cache_control`이 없습니다. 다만 캐시 가능한 최소 프리픽스는 모델별 512~4096 토큰이고 이 프롬프트(3,493자 한국어)가 그 기준을 넘는지는 `count_tokens`로 실측이 필요합니다. **[미확인]**
6. **모델 선택이 현행이 아님** — 기본값 `claude-sonnet-4-6`는 이전 세대이며 $3/$15 per MTok입니다. 현행 `claude-sonnet-5`는 **$2/$10로 더 저렴하면서 더 신형**입니다. OCR용 `claude-haiku-4-5`($1/$5)는 현행 모델이 맞습니다. 단 Sonnet 5부터는 `budget_tokens`가 제거되고 thinking은 `{type:"adaptive"}`만 허용되므로, 모델 교체 시 파라미터 확인이 필요합니다.
7. **프롬프트에 실패 안전장치 부재** — 대화가 너무 짧거나 한쪽만 발화한 경우의 지침이 없습니다. 최소 검증은 `text.trim().length < 10`(index.js:141) 한 줄뿐입니다.

### 4.6 하드코딩

- 도메인 문자열 분산: `shareResultImage.js:3` `https://app.heydaystar.co.kr`, `quotaApi.js:10` 폴백 URL, `InputStep.jsx` 블로그 링크, `index.html` 5곳, `public/robots.txt`, `public/sitemap.xml`
- 공유 문구 `quotaApi.js:6`, 이미지 파일명 `shareResultImage.js:36`
- 12종 로딩 문구, 6단계 스테이지, 8종 주제 정규식, 관계 분류 임계값(`analyzeLocal.js:106-133`의 `>= 3`, `>= 2`, `> 0.25` 등) 전부 코드 리터럴
- 절삭 상수 350개/14,000자, `max_tokens 4096`, 이미지 6장/1.2MB, JSON 12mb, 타임아웃 180초 — 설정 파일 없이 각 파일에 산재

### 4.7 에러 처리

- `alert()` 3회(`App.jsx:121`, `MobileImportPanel.jsx:26,28`) — 모바일에서 흐름을 끊는 네이티브 다이얼로그
- **React 에러 바운더리 없음** — `ResultStep` 하위에서 예외 발생 시 화면 전체 백지
- **조용한 폴백** — API 실패가 로컬 휴리스틱 결과로 대체되고, 차이는 "· AI" 뱃지 유무뿐. 사용자는 저품질 결과를 AI 결과로 오인할 수 있음
- 오류 메시지에 개발 지침 노출 — `ocrScreenshots.js:15,54,78` "터미널에서 Ctrl+C 후 npm run dev 를 실행해 주세요"가 **프로덕션 사용자에게도 표시**됨
- `/api/health`가 `hasApiKey`와 모델명을 무인증 공개(`index.js:58-65`) — 경미하나 불필요한 노출
- 에러 분기를 문자열 정규식으로 판정 — `index.js:118` `/API 키|스크린샷|이미지|잘못된/.test(err.message)`

### 4.8 비용 문제

| 항목 | 현황 | 개선 여지 |
|---|---|---|
| 모델 | `claude-sonnet-4-6` ($3/$15) | `claude-sonnet-5` ($2/$10) — 약 33% 절감 + 신형 |
| 프롬프트 캐싱 | 미적용 | 시스템 프롬프트 고정분 캐싱 시 반복 호출 입력 비용 대폭 절감 (최소 프리픽스 실측 선행) |
| 실패 호출 | 파싱 실패 시 전액 낭비, 재시도 없음 | 구조화 출력로 실패 자체를 제거 |
| 쿼터 우회 | 클라이언트 UUID 기반 | 우회가 자명하므로 **API 키 비용 상한이 사실상 없음**. 2.0 최우선 과제 |
| 중복 연산 | 익명화 3회, 로컬분석 2회 | CPU만 낭비(비용 직접 영향 없음) |
| OCR 이미지 | 클라이언트 리사이즈로 이미 최적화됨 | 잘 되어 있음 |
| 절삭 | 14,000자 상한 | 입력 비용 상한은 잘 잡혀 있음 |
| 사용량 로깅 | **없음** | `response.usage`를 기록하지 않아 실제 단가·토큰 분포를 알 수 없음 → 2.0에서 최소한 이것부터 |
| Batch API | 미사용 | 즉시성이 필요한 UX라 해당 없음 |

### 4.9 성능 문제

- 정규식 파싱 3회 + 로컬 분석 2회가 메인 스레드에서 동기 실행. 장문 대화(수천 줄)에서 UI 블로킹 가능
- `parseChat.js:185` 모든 줄이 16종 패턴을 순차 매칭 — O(줄 수 × 패턴 수)
- `analyzeLocal.js:73-78` `detectTopics`가 `classifyRelation` 내에서 2회 중복 호출(`analyzeLocal.js:91-92`)
- `deepAnalysisLocal.js:53-62` 메시지 전체를 토큰화하며 O(n²) 성향의 에코 비교
- `html-to-image` 캡처가 긴 리포트에서 pixelRatio 2로 동작(`shareResultImage.js:19` 5000px 이하일 때) — 모바일 Safari 메모리 한계에 근접할 수 있음
- Render free tier 콜드 스타트 + Sonnet 응답 ~30초 → 진행바가 92%에서 멈춰 대기(`App.jsx:91`)
- 번들 288KB(gzip 전) — 코드 스플리팅은 `analyzeLocal.js` 동적 import 하나뿐

### 4.10 모바일 UX

1. **스크린샷 순서 변경이 모바일에서 동작하지 않습니다.** `ScreenshotImportPanel.jsx:126-136`이 HTML5 Drag and Drop(`draggable` + `onDragStart`/`onDrop`)만 사용합니다. 이 API는 모바일 터치에서 발화하지 않습니다. **주 사용 경로(캡처 탭)의 핵심 조작이 주 사용 기기에서 불가능합니다.** 위/아래 이동 버튼 등 터치 대안이 필요합니다.
2. `alert()` 3곳 — 모바일에서 이질적
3. 결과 페이지가 매우 길고(광고 3개 포함) 상단 이동 수단이 헤더의 "↩ 다시"뿐
4. `navigator.clipboard.readText()`는 iOS Safari에서 권한·제스처 제약이 있어 실패 빈도가 높음. 폴백은 `alert` 안내
5. 이미지 저장이 iOS에서 `<a download>` 기반(`shareResultImage.js:32-41`) — iOS Safari에서 동작이 불안정. `navigator.share` 경로는 잘 처리되어 있음
6. `localStorage` 기반 device id는 Safari ITP의 7일 스토리지 삭제 대상 — 쿼터가 임의로 리셋됨

### 4.11 SEO / 광고 적용상의 문제

| 문제 | 근거 | 영향 |
|---|---|---|
| **`og-image.png` 부재** | `index.html:32,44`가 참조하나 `public/`·`dist/` 어디에도 파일 없음 | 카톡·트위터 공유 카드 이미지 깨짐. **공유가 성장 축인 서비스에서 치명적** |
| SEO 본문이 `<details>` 안 | `SeoContent.jsx:3` | 접힘 콘텐츠도 색인되나 가중치는 불리 |
| SPA·SSR 없음 | 전 콘텐츠 클라이언트 렌더 | 정적 색인 대상은 `index.html` 메타뿐 |
| sitemap에 URL 1개 | `public/sitemap.xml` | 색인 표면적 최소 |
| 결과 페이지 URL 없음 | 라우터 부재 | 공유 유입이 결과가 아닌 홈으로 |
| 슬롯 폴백이 중복 ID 유발 | `AdSlot.jsx:34` `slots[variant] \|\| slots.banner` | 특정 슬롯 미설정 시 **한 페이지에 동일 `data-ad-slot` 중복 렌더** → AdSense 정책 위반 소지 |
| 로딩 화면 광고 | `LoadingStep.jsx:185` | 자동 진행 중 화면의 광고는 오클릭 위험. AdSense 정책 재확인 권장 |
| 광고 밀도 | 결과 1페이지에 3개 + 본문 대비 비율 | 콘텐츠 대비 광고 비중 점검 필요 |
| 개인정보처리방침 페이지 부재 | 앱 내 없음 | AdSense 요구사항 |
| `robots.txt`/`sitemap.xml` 이중 관리 | `public/`과 `dist/` 양쪽 | 빌드 산출물이 소스와 분리 안 됨 |

### 4.12 유지보수성

- **테스트 0** — 핵심 자산인 파서에 회귀 방어가 전혀 없음. `samples/` 5종은 있으나 수동 실행 안내(`samples/README.md`)뿐
- **타입 0** — JSDoc만. `shared/normalizeAnalysis.js:6-26`에 `AnalysisResult` typedef가 있으나 강제력 없음
- **린트 규칙 2개** — `.oxlintrc.json`에 react hooks + only-export-components만
- **죽은 코드**: `src/data/mockResult.js`(미사용), `parseChat.js:6` `weekKey` import 미사용, `speakerLabels.js:195` `preprocessOcrSpeakers` 실질 no-op, 미사용 export 4개(`getAnonymizationChanges`, `scrubText`, `detectChatPlatform`, `parseTimestampMinutes`), `src/assets/`의 `hero.png`·`react.svg`·`vite.svg` 미참조
- **문서 표류**: `.env`의 모델 주석이 코드와 불일치, `README.md`의 `[인물A]` 라벨 표기가 현행 `상대방` 체계와 불일치, `scrubResult.js:4` JSDoc 예시도 구 라벨

### 4.13 보안

- `cors()` 전면 허용 — 오리진 제한 없음 (`index.js:27`)
- IP 기반 레이트리밋 없음 — 우회 가능한 device-id 쿼터가 유일한 방어선
- 보안 헤더 없음 (helmet/CSP/HSTS 미적용)
- 사용자 제어 문자열을 객체 키로 사용 (`quota.js` + `quotaStore.js`) — 4.2 참조
- 이미지 검증이 크기·개수·MIME 문자열뿐(`ocrScreenshots.js:41-48`) — 실제 디코딩 검증 없이 Anthropic으로 전달
- 긍정적 항목: `.env` gitignore 처리, API 키는 서버 전용, 대화 본문 서버 로그 미기록, 프로덕션 dev 로그 차단(`index.js:163`)

---

## 5. 2.0 개발 전 반드시 결정해야 하는 사항

### 5.1 제품 기획 결정사항

| # | 결정 항목 | 배경 (코드 근거) | 선택지 |
|---|---|---|---|
| P1 | **개인정보 약속의 수준을 어디로 잡을 것인가** | 현재 고지("브라우저에서 익명화 후 전송")와 실제 동작(스크린샷 원본·nameMap 전송)이 불일치. 4.3 참조 | ① 고지를 실제에 맞게 수정 ② 실제를 고지에 맞게 구현(온디바이스 OCR, nameMap 미전송, 본문 내 이름 마스킹) ③ 중간 — 단, **2.0 아키텍처가 여기서 갈립니다** |
| P2 | **무료/유료 모델** | 현재 하루 3회+공유3회 전면 무료, 우회 자명, 수익은 AdSense뿐 | 광고 유지 / 로그인+무료한도 / 부분유료 / 1회 결제 |
| P3 | **로그인을 도입할 것인가** | 쿼터 우회와 결과 히스토리 부재가 모두 여기서 파생 | 익명 유지 / 소셜 로그인 / 선택적 로그인 |
| P4 | **결과를 저장·재조회할 것인가** | 현재 저장 기능 없음. 결과 URL도 없어 공유가 홈으로 향함 | 저장 없음 / 결과 영구 URL / 기간제 |
| P5 | **공유 루프의 대상** | `quotaApi.js:11`은 홈+ref 파라미터, `shareResultImage.js`는 이미지. 결과 자체는 공유 불가 | 이미지만 / 결과 페이지 URL / 둘 다 |
| P6 | **관계 유형 범위** | 5종(romantic/friendship/work/family/ambiguous) 전부 지원 중이나, 브랜딩·SEO·프롬프트는 전부 "연애·썸" 중심 | 연애 특화 / 현행 5종 유지 / 확장 |
| P7 | **입력 경로의 우선순위** | 기본 탭이 스크린샷인데 모바일 순서 변경이 동작하지 않음(4.10-1). 또한 스크린샷은 쿼터를 2회 소모 | 캡처 우선(문제 수정 전제) / 텍스트 우선 / 동등 |
| P8 | **로컬 폴백 결과를 계속 제공할 것인가** | 사용자가 AI 결과로 오인 가능(4.7) | 폴백 유지+명시 / 폴백 제거하고 실패 안내 |
| P9 | **결과 분량·톤** | 프롬프트가 문장 수를 강제(`apiPrompt.js:43-67`), 결과 페이지가 매우 길어짐 | 현행 롱폼 / 요약 우선+더보기 |
| P10 | **광고 배치 정책** | 결과 3 + 로딩 1 + 입력 1. 로딩 화면 광고와 슬롯 중복 위험(4.11) | 현행 / 축소 / 유료 시 제거 |
| P11 | **도메인·브랜드 구조** | 앱(app) / 블로그(www 워드프레스) 분리 운영 중 | 현행 유지 / 통합 |

### 5.2 기술 결정사항

| # | 결정 항목 | 배경 (코드 근거) | 선택지 |
|---|---|---|---|
| T1 | **쿼터 식별·저장 방식** | `quotaStore.js` 파일 JSON은 Render free tier에서 휘발, 잠금 없음, device-id 우회 자명(4.2) | 서버 세션+IP / 로그인 기반 / 외부 KV·DB(Redis, Postgres 등) — **P2·P3에 종속** |
| T2 | **호스팅 유지 여부** | Render free tier 콜드스타트를 GitHub Actions cron으로 우회 중. 파일 영속성 없음 | Render 유료 / 서버리스 / 다른 PaaS |
| T3 | **모델 선택과 파라미터** | 현재 `claude-sonnet-4-6`(이전 세대, $3/$15). `claude-sonnet-5`는 $2/$10로 더 싸고 신형. Sonnet 5는 `budget_tokens` 미지원, thinking은 adaptive만 | 분석 모델 / OCR 모델(`claude-haiku-4-5` 현행 유지 가능) / effort 레벨 |
| T4 | **구조화 출력 도입 여부** | 현재 정규식 `extractJson` + 재시도 없음(4.5). `output_config.format`로 대체 가능 | 도입(파서·실패경로 제거) / 현행 유지 |
| T5 | **프롬프트 캐싱 적용** | 시스템 프롬프트 3,493자 고정인데 미적용. 단 캐시 최소 프리픽스 충족 여부는 `count_tokens` 실측 필요 | 실측 후 적용 / 미적용 |
| T6 | **OCR을 어디서 수행할 것인가** | 현재 원본 이미지를 서버 경유로 Claude Vision에 전송(P1 직결) | 현행 서버 OCR / 온디바이스 OCR / 하이브리드 |
| T7 | **TypeScript 도입** | 현재 JSDoc만. 결과 스키마가 프론트·서버·정규화 3곳에 걸쳐 있어 계약 붕괴 위험 | 전면 TS / 서버만 / 현행 유지 |
| T8 | **테스트 전략** | 전무. 파서가 최대 자산인데 회귀 방어 없음. `samples/` 5종 재활용 가능 | 파서 단위 테스트만 / +API 통합 / +E2E |
| T9 | **`shared/` 경계 재정립** | 서버가 `src/utils/*`를 import(4.1). 프론트 리팩터가 서버를 깸 | 모노레포 워크스페이스 / `shared/`로 전부 이동 / 현행 |
| T10 | **라우팅 도입** | 라우터 없어 결과 URL 부재(P4·P5 직결) | React Router / 파일 기반 프레임워크 전환 / 현행 |
| T11 | **SSR/SSG 여부** | SPA라 SEO 표면적이 메타 태그뿐(4.11) | Vite SPA 유지 / Next.js·Remix 등 전환 |
| T12 | **로컬 휴리스틱 엔진 유지 범위** | 708줄. "1차 점수" UX 장치 + 폴백 두 역할. 성별 추정 코드 제거 필요 | 프리뷰 전용으로 축소 / 폴백까지 유지 / 폐기 |
| T13 | **관측·비용 로깅** | `response.usage` 미기록으로 실단가 파악 불가(4.8) | 최소 usage 로깅 / APM 도입 |
| T14 | **에러 처리 표준** | `alert` 3곳, 에러 바운더리 없음, 프로덕션에 dev 안내 노출 | 토스트+바운더리 도입 / 현행 |

### 5.3 결정 순서 제안

P1(개인정보 수준) → P2·P3(수익·로그인) 이 두 축이 T1·T6·T10을 모두 결정합니다. **이 세 가지를 먼저 확정하지 않으면 기술 결정이 되돌려질 수 있습니다.**

---

## 6. 부록 — 2.0에서 즉시 손봐야 할 항목 (재사용 우선 관점)

기존 코드를 살리면서 고칠 수 있는 항목만 추렸습니다. 구현은 2.0 방향 확정 후 진행합니다.

| 우선도 | 항목 | 기존 코드 재사용 가능 여부 |
|---|---|---|
| 높음 | 스크린샷 순서 변경 터치 대응 | `moveItem()`(`ScreenshotImportPanel.jsx:7`) 그대로 쓰고 버튼 UI만 추가 |
| 높음 | `og-image.png` 생성·배치 | 코드 변경 불필요, 에셋만 추가 |
| 높음 | 개인정보 고지와 실제 동작 일치 | `PrivacyBadge.jsx` 문구 수정 또는 `ScreenshotImportPanel.jsx:62` 순서 변경 |
| 높음 | 쿼터 저장소 교체 | `quota.js` 정책 로직은 유지, `quotaStore.js`만 교체 |
| 중간 | 모델 `claude-sonnet-5`로 전환 | `analyze.js:6` 상수 1줄 + 파라미터 확인 |
| 중간 | 구조화 출력 도입 | `extractJson` 2곳 삭제, `enrichResult` 방어 로직은 유지 |
| 중간 | `RELATION_LABELS` 단일화 | `shared/enrichResult.js` 쪽으로 통합, `analyzeLocal.js:6` 제거 |
| 중간 | 죽은 에러 미들웨어 제거 | `index.js:30-38` 삭제 (185줄 사본이 정상 동작) |
| 중간 | 성별 추정 휴리스틱 제거 | `analyzeLocal.js:64-65,104-110` 제거 후 분류 로직 재조정 |
| 중간 | 프로덕션 오류 문구 정리 | `ocrScreenshots.js:15,54,78` 메시지 분기 |
| 낮음 | 죽은 코드 정리 | `mockResult.js`, 미사용 import·export, `src/assets/` 3파일 |
| 낮음 | `alert()` → 인앱 토스트 | 3곳 |
| 낮음 | `samples/` 기반 파서 테스트 | 픽스처 이미 존재 |

---

## 7. 한 줄 요약

**1.0의 진짜 자산은 카톡 파서(`parseChat.js` + `dateUtils.js` + `speakerLabels.js`, 약 900줄)와 결과 시각화 컴포넌트이고, 반드시 새로 만들어야 하는 것은 쿼터/식별 체계와 서버 계층입니다.** 그리고 2.0 아키텍처를 좌우하는 단 하나의 결정은 **"개인정보 약속을 어느 수준으로 지킬 것인가"** — 온디바이스 OCR 여부, 서버 역할, 로그인 필요성이 전부 여기서 갈립니다.
