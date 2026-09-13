# 카톡밀당분석기 2.0 — 구현 계획

> 작성일: 2026-09-12 (개정 v3 — 1차: `docs/implementation_review_v2.md` 반영 / 2차: 사용자 최종 결정 확정 + 추가 수정 반영)
> 기준 문서: `docs/analysis_v1.md` → `docs/prd_v2.md` v0.3 → `docs/implementation_review_v2.md` → 이번 턴의 최종 결정 메모(**이 문서보다 우선**)
> 원칙: ① 기존 검증 자산(특히 Parser)은 재작성하지 않고 재사용한다 ② LLM은 최종 숫자 점수를 만들지 않는다 — strength를 포함해 어떤 수치도 점수 계산에 직접 들어가지 않는다 ③ Evidence 없는 Signal은 점수에 반영하지 않는다 ④ Score는 raw count가 아니라 **opportunity 대비 rate + saturation**으로 계산해 대화 길이·반복 횟수에 의한 왜곡을 막는다 ⑤ 아직 코드를 구현하지 않는다 ⑥ 사용자 승인이 필요한 항목은 **[결정 필요]**로 명시한다.

---

## 0. 이 문서를 읽는 법

- **[결정함]**: 확정된 사항. Phase 구현 시 그대로 따른다.
- **[결정 필요]**: 아직 승인이 필요한 사항 — §22에 **이번 개정 이후에도 남은 것만** 모았다.
- **[긴장관계]**: 두 요구사항이 충돌하거나 해석 여지가 있어 이 문서가 먼저 지적하는 사항.
- 파일 경로·줄 번호는 `docs/analysis_v1.md` 작성 시점 커밋(`dd6061a`) 기준이다.

---

## 1. 개정 이력 요약

### 1.1 1차 개정 — `docs/implementation_review_v2.md` 반영 (strength 제거, 2-Stage Compute, 저장정책 분리, Postgres 확정, 사주 shared package 우선, invariant test, idempotency, Preview/Paid 비용 분리) — 상세는 이전 버전 §1 참조, 이하 전부 반영된 상태로 통합 작성됨.

### 1.2 2차 개정 (이번) — 사용자 최종 결정 확정 + 추가 수정

| 항목 | 1차 개정까지 | 이번 개정 |
|---|---|---|
| DB 클라이언트 | Postgres 계열, 클라이언트 미정 | **Postgres + Prisma로 확정**(§5.3) |
| Screenshot/업로드 개인정보 문구 | Option B 확정, 정확한 문구는 미정 | **사용자 제공 공식 문구로 확정**(§6.1) |
| 호스팅 전환 시점 | 유료 플랜 승인 필요, 시점 불명 | **개발 중 현행(Render free) 유지 → 실결제 공개배포 직전 전환**으로 확정(§5.4) |
| 결제 Provider | 미정, 곧 결정해야 하는 것처럼 서술 | **지금 선정하지 않음** — PaymentGateway interface 우선 설계, **Phase 3 착수 시점**에 선정(§16.3) |
| PG 영수증 조회 채널 | 결정 필요 | **MVP에서 구현하지 않음**으로 확정(§16.5) |
| 사주 shared package 범위 | 범위 모호(comparison 로직 포함 여부 불명) | **만세력 계산 + 정책 adapter + golden test까지만**으로 한정, `domain/comparison`은 범위 밖(§18.2) |
| Funnel 도구 | 결정 필요 | **GA4로 확정** + 결제·분석·API비용 등 authoritative event는 **서버 DB에도 이중 기록**하는 원칙 추가(§17.4) |
| Preview 대상 구간 | "최근 chunk 1개"를 기본값 제안 | **"최근 충분한 대화 구간"**으로 확정, 결과 필드명도 `recentConversationTemperature`로 명시 분리(§13.2, §9.4) |
| Preview Narrative | 템플릿 권장 | **템플릿으로 확정**, "최근 대화 미리보기" 문구 의무화(§15.4) |
| Signal intensity enum | 미도입 권장 | **MVP 미도입으로 확정**(§9.1) |
| **Score 계산식** | signalType 고정 가중치 × **raw 개수** | **signalType 고정 가중치 × opportunity 대비 rate × saturation** — 대화 길이·무한 반복에 의한 왜곡 원천 차단(§9, 신규 핵심 설계) |
| **TypeScript 강제 메커니즘** | "컴파일러가 강제한다"고만 서술 | **tsconfig 경계·adapter 타입 부여 지점을 구체적으로 명시**해 강제가 실제로 성립하는 지점을 확정(§5.1) |
| **Preview vs Paid Deep 결과** | 같은 개념(Temperature 등)을 신뢰도만 다르게 라벨링 | **서로 다른 필드명**(`recentConversationTemperature`/`relationshipTemperature` 등)으로 스키마 레벨에서 분리, UI 문구도 범위가 다름을 명시(§12.4) |

---

## 2. 총괄 요약

2.0의 엔진은 1.0의 **파서 위에** 짓는다. 1.0에서 버릴 것은 "점수를 만드는 방식"이고, 지킬 것은 "텍스트를 구조화하는 방식"(`parseChat.js`/`dateUtils.js`/`speakerLabels.js`)이다.

이번 개정까지 반영된 2.0 엔진의 핵심 성격은 다섯 문장으로 요약된다.

1. **LLM은 "무슨 행동이 있었는가"만 분류한다. 그 행동이 몇 점인지는 코드가 정한다.** 숫자(strength 포함)는 LLM 출력에 존재하지 않는다.
2. **반복 횟수를 그대로 점수에 곱하지 않는다.** 같은 signalType이 관찰된 "기회 대비 비율(rate)"을 코드가 계산하고, 그 비율에도 점근적 saturation을 적용한다 — 대화가 길다고, 혹은 같은 행동이 많이 나온다고 점수가 선형으로 치솟지 않는다.
3. **분석은 비용 순서대로 2단계로 나뉜다.** 결제 전에는 "최근 충분한 대화 구간"만 싸게 분석하고, 결제 후에만 전체 대화 + Trend + Turning Point를 분석한다. 같은 chunk를 두 번 분석하지 않는다.
4. **무료 미리보기와 유료 정밀분석은 서로 다른 질문에 답한다.** 전자는 "요즘 어때?"(최근 대화 온도), 후자는 "우리 관계는 전체적으로 어때?"(관계온도) — 두 숫자는 이름부터 다르고, 다를 수 있다는 사실을 감춘다.
5. **모든 저장은 기간이 있다.** 원문은 저장하지 않고, 분석 결과도 무료(24시간)/유료(최대 30일) TTL로 자동 소멸한다.

---

## 3. 1.0 → 2.0 기능 매핑

*(1차 개정 내용과 동일, 변경 없음)*

| # | 1.0 기능 | 2.0 대응 | 판정 | 근거 |
|---|---|---|---|---|
| 1 | 카톡 텍스트 파싱 (16종 패턴) | Standard Message Model의 입력 소스 | **재사용** | `parseChat.js` |
| 2 | 날짜 파싱·컨텍스트 전파 | Trend Engine 기간 분할의 기초 | **재사용** | `dateUtils.js` |
| 3 | 화자 익명화(줄머리) | 개인정보 파이프라인의 1단계 | **확장 필요** | `speakerLabels.js` |
| 4 | 스크린샷 OCR | Screenshot Quick Analysis 입력 경로 | **재설계 필요** | §6.1 |
| 5 | 로컬 휴리스틱 채점(`analyzeLocal.js`) | 폐기 — 부품은 Code Feature Extractor로 이관 | **부분 재사용** | §8.2 |
| 6 | Claude 단일 프롬프트 분석 | LLM Signal Extractor + 2단계 Narrative Generator | **재설계** | §9, §16 |
| 7 | 결과 정규화 | Score Engine 출력 정규화 | **패턴 재사용, 스키마 신규** | §9 |
| 8 | 결과 화면(호감도 중심) | Result Report UX (PRD §18) | **재설계** | §4 |
| 9 | 결과 이미지 공유 | 공유 카드 | **재사용 + 콘텐츠 교체** | — |
| 10 | 일일 쿼터 | Abuse Prevention + Preview/Paid 분리 쿼터 | **재설계** | §5.5 |
| 11 | 광고(AdSense) | Free Preview의 수익 보조 채널 | **재사용** | — |
| 12 | 결과 저장 기능 없음 | 분석 결과 영속 저장(TTL 기반) | **신규** | §6.5 |
| — | (1.0에 없음) | Intent 선택 | **신규** | PRD §4 |
| — | (1.0에 없음) | Core 4 / Temperature / Romance / Position | **신규** | §9, §12 |
| — | (1.0에 없음) | Trend / Turning Point | **신규 — Paid Deep 전용** | §13 |
| — | (1.0에 없음) | Free Preview / Paid Deep 2-Stage 결제 | **신규** | §16 |
| — | (1.0에 없음) | Usage Logging (Preview/Paid 분리 + GA4 이중기록) | **신규** | §17 |
| — | (1.0에 없음) | Saju Relationship Layer | **신규 — shared package로 재사용** | §18 |

---

## 4. 파일/모듈별 변경 영향도

*(1차 개정과 동일 — 이번 개정은 파일 목록이 아니라 각 파일이 담는 계산 로직을 바꾼다. 전체 표는 유지하고, 이번 개정으로 내용이 갱신된 항목만 아래 재확인한다.)*

| 파일 | 판정 | 변경 내용 (이번 개정 갱신분) |
|---|---|---|
| `server/db/**` | 🆕 | **Prisma 스키마(`schema.prisma`) + Prisma Client**로 구현. Repository interface는 Prisma Client를 감싸는 얇은 어댑터 |
| `src/components/PrivacyBadge.jsx` | 🟠 | §6.1의 **확정된 공식 문구**를 그대로 반영 |
| `src/components/LoadingStep.jsx` | 🟡 | Preview 단계 문구에 **"최근 대화 기준"**임을 명시 |
| `src/components/ResultStep.jsx` | 🔴→🆕 | `recentConversationTemperature`(Preview)와 `relationshipTemperature`(Paid)를 **서로 다른 UI 블록**으로 명확히 구분 표시(§12.4) |
| `server/engine/**` 전체 | 🆕 | TypeScript. 기존 `src/utils/*.js`는 무변경, 경계는 §5.1 |

그 외 파일 판정은 1차 개정과 동일하다.

---

## 5. 아키텍처 개요 및 선행 결정

### 5.1 TypeScript 도입 범위와 강제 메커니즘 (구체화)

**[결정함, 구체화]** "RelationshipSignal과 ValidatedSignal을 컴파일러가 강제한다"는 이전 서술은 **정확히 어디서, 어떻게** 강제되는지 명시가 빠져 있었다. 이번 개정에서 다음과 같이 확정한다.

**적용 범위**: `server/engine/**`, `server/routes/**`, `server/db/**`(Repository·Prisma 관련 코드)는 **처음부터 100% TypeScript**로 작성한다. `src/utils/*.js`, `server/*.js`(레거시), `shared/*.js`는 **한 줄도 수정하지 않고 JS로 유지**한다. 1.0 전체를 TS로 일괄 전환하지 않는다.

**JS/TS 경계가 실제로 교차하는 지점은 정확히 하나**: `server/engine/messageModel/toStandardMessages.ts`가 `src/utils/parseChat.js`의 `parseMessages()`/`getConversationMeta()`를 import하는 지점뿐이다. 이 지점에서 타입 안전성을 잃지 않기 위해:

1. `tsconfig.json`에 `"allowJs": true`를 설정해 `.js` 파일을 import 가능하게 하되, `"checkJs": false`로 두어 **건드리지 않는 레거시 JS에 새로 타입 에러가 발생하지 않게** 한다(레거시 코드에 회귀 위험을 만들지 않는 것이 최우선).
2. `parseChat.js`가 실제로 반환하는 형태(줄 167-177, 213-314 확인됨)에 맞춰 **손으로 작성한 앰비언트 타입 선언 파일**을 둔다:

```ts
// server/engine/messageModel/parseChat.d.ts
declare module "*/parseChat.js" {
  export interface RawParsedMessage {
    speaker: string;
    rawSpeaker: string;
    content: string;
    platform: "kakao" | "line" | "sms" | "generic";
    timestamp: string;
    dateMs: number | null;
    dateLabel: string;
    index: number;
  }
  export function parseMessages(text: string): RawParsedMessage[];
  export function getConversationMeta(input: string | RawParsedMessage[]): {
    platform: "kakao" | "line" | "sms" | "generic";
    spanDays: number;
    spanLabel: string;
    dateRange: { start: string; end: string } | null;
  };
}
```

3. `toStandardMessages.ts`는 이 타입 선언을 통해 **`any`를 거치지 않고** `RawParsedMessage[]`를 받아 `Message[]`로 변환한다. **이 지점부터 하위로는(Code Feature Extractor, LLM Signal Extractor, Evidence Validator, Score Engine 전부) 완전한 TS strict 모드 안에서만 동작**하므로, "`RelationshipSignal`을 `scoreEngine.ts`가 import하면 타입 에러"라는 강제는 이 서브트리 내부에서 **실제로, 전면적으로** 성립한다 — 레거시 JS와 섞이는 지점이 진입부 한 곳으로 봉쇄되어 있기 때문이다.
4. `tsconfig.json`은 `"strict": true`로 설정한다(엔진 서브트리 전체). 실행은 `tsx`로 한다(빌드 스텝 없음).

이 설계가 "권장안"으로 제시됐던 것("2.0 신규 engine/server domain부터 TypeScript를 도입하고 기존 검증 Parser JS는 수정하지 않은 채 adapter boundary에서 감싼다")을 그대로 구체화한 것이다.

### 5.2 라우팅 도입 *(변경 없음)*

React Router를 도입해 결과 화면에 실제 URL(`/r/:analysisId`)을 부여한다.

### 5.3 저장소 — Postgres + Prisma로 확정

**[결정함]** DB는 **Postgres + Prisma**로 확정한다(이전 "경량 클라이언트 vs Prisma"의 열린 선택은 종료).

| 저장 대상 | 이유 |
|---|---|
| 분석 결과(Preview/Paid 각각, TTL 적용) | 2-Stage Compute(§16)와 무료/유료 분리 서빙의 전제 조건 |
| 쿼터/어뷰징 방지 상태 | 1.0의 파일 저장은 재시작마다 초기화됨 |
| 결제 기록 + Paid Deep 실행 상태(idempotency) | Unlock 여부와 중복 실행 방지의 유일한 근거 |
| Usage 로그(Preview/Paid 원가 분리) | 비용/전환율 측정의 전제 조건 |

**설계 원칙(변경 없음, Prisma로 구체화)**: `server/engine/**`의 어떤 로직도 Prisma Client를 직접 import하지 않는다. `server/db/repositories/*.ts`에 인터페이스를 두고, `server/db/prisma/*.ts`에 Prisma 기반 구현체를 둔다.

```prisma
// server/db/prisma/schema.prisma (스케치)
model AnalysisResult {
  id                String   @id @default(cuid())
  stage2Status      Stage2Status @default(NOT_STARTED)
  analysisMode      AnalysisMode
  chunkPlan         Json
  processedChunkIds Json
  previewFields     Json
  paidFields        Json?
  previewExpiresAt  DateTime
  paidExpiresAt     DateTime?
  paymentId         String?  @unique
  createdAt         DateTime @default(now())
}

enum Stage2Status { NOT_STARTED CLAIMED RUNNING COMPLETED FAILED }
enum AnalysisMode { SNAPSHOT STANDARD DEEP }
```

```ts
// server/db/repositories/analysisResultRepository.ts — 인터페이스 (Prisma를 몰라도 되는 계층)
interface AnalysisResultRepository {
  createPreview(input: PreviewRecord): Promise<string>;
  claimForPaidStage(analysisId: string): Promise<boolean>;
  completePaidStage(analysisId: string, result: PaidRecord): Promise<void>;
  markPaidStageFailed(analysisId: string, reason: string): Promise<void>;
  findById(analysisId: string): Promise<StoredAnalysisResult | null>;
  purgeExpired(now: Date): Promise<number>;
}

// server/db/prisma/analysisResultRepository.prisma.ts — 구현체
import { prisma } from "./client";
export const prismaAnalysisResultRepository: AnalysisResultRepository = {
  async claimForPaidStage(analysisId) {
    const result = await prisma.analysisResult.updateMany({
      where: { id: analysisId, stage2Status: { in: ["NOT_STARTED", "FAILED"] } },
      data: { stage2Status: "CLAIMED" },
    });
    return result.count === 1;   // Prisma의 updateMany count로 원자적 claim 판정 (§16.3)
  },
  // ...
};
```

`claimForPaidStage()`의 원자성은 Prisma의 `updateMany`가 단일 SQL `UPDATE ... WHERE ...`로 컴파일되는 것에 의존한다 — Postgres 레벨의 행 잠금으로 동시성이 보장된다(§16.3에서 상세).

### 5.3.1 DB 장애 시 폴백 정책 (Phase 0.5, 확정)

**[결정함]** Phase 0의 첫 구현은 "Postgres 실패 시 항상 조용히 파일로 폴백"이었다 — 이는 운영에서 위험하다(Postgres 장애가 quota/usage 상태의 조용한 손실로 이어질 수 있음). Phase 0.5에서 다음으로 교체했다(`server/db/fallbackPolicy.ts`):

| DATABASE_URL | Postgres 호출 | NODE_ENV | ALLOW_FILE_DB_FALLBACK | 동작 |
|---|---|---|---|---|
| 미설정 | — | 무관 | 무관 | **파일 저장소 사용**(1.0 개발모드 호환 — 실패가 아니라 "DB 자체를 안 씀") |
| 설정됨 | 성공 | 무관 | 무관 | Postgres 결과 사용 |
| 설정됨 | 실패 | `production` | 무관 | **항상 `DatabaseUnavailableError` throw** — 파일 폴백 절대 금지 |
| 설정됨 | 실패 | 그 외 | `true` | 파일로 폴백(경고 로그) |
| 설정됨 | 실패 | 그 외 | 미설정/`true` 아님 | **`DatabaseUnavailableError` throw** — 개발환경도 명시적 옵트인 없이는 조용히 폴백하지 않음 |

`DatabaseUnavailableError`는 `server/index.js`에서 HTTP 503 + `code: "DATABASE_UNAVAILABLE"`로 변환되어 클라이언트에 명시적으로 노출된다(전역 에러 미들웨어 + `/api/analyze`·`/api/ocr-screenshots`의 로컬 catch 양쪽에서 처리). `quotaRepository.ts`/`usageLogRepository.ts` 둘 다 동일 정책을 공유한다.

**Repository 계층의 Phase 1 확장 원칙**: Phase 1에서 `analysisResultRepository`(위 스케치)를 실제로 구현할 때도 **동일한 `withFallbackPolicy()` 헬퍼를 재사용**한다 — 특히 결제 상태(`claimForPaidStage` 등)는 quota보다 훨씬 더 "조용한 손실 절대 불가" 요구가 강하므로, 이 헬퍼를 임의로 다시 구현하지 않는다.

### 5.4 호스팅 — 개발 중 현행 유지, 실결제 공개배포 직전 전환

**[결정함]** 개발 단계에서는 **현행 Render free tier를 그대로 유지**한다. 콜드스타트·디스크 휘발성 문제는 개발 중에는 치명적이지 않다(Postgres를 쓰므로 디스크 휘발성 문제는 이미 §5.3에서 해소됨 — 남는 문제는 콜드스타트뿐이고, 이는 실사용자 트래픽이 없는 개발 단계에서는 감수 가능).

전환 시점: **실결제 공개 배포 직전**, 다음을 함께 전환한다:
- Render free tier → 유료 플랜(콜드스타트 제거)
- 개발용 Postgres 인스턴스 → 프로덕션 등급 Postgres

이로써 "언제 전환할지"는 확정됐다. "어느 플랜/어느 Postgres 벤더로 전환할지"는 그 시점의 트래픽 예상치에 따라 결정할 사안이라 지금 확정하지 않는다(§22.2에 예정된 결정으로 남긴다).

**[결정함]** 개발 단계 Postgres는 **로컬 Docker**로 확정됐다(`docker-compose.yml`). 마이그레이션은 `server/db/prisma/migrations/`에 커밋하고(오프라인에서 `prisma migrate diff --from-empty`로 생성, §23.5), 실제 DB에는 `npm run db:migrate:deploy`로 적용한다.

### 5.5 사용자 식별 전략 (쿼터 재설계) *(변경 없음)*

서버 발급 HttpOnly 쿠키 세션 + IP 레이트리밋 + 결제 건은 별도 Unlock Token 트랙.

### 5.6 CORS — allowlist로 확정 (Phase 0.5)

**[결정함]** 1.0의 `cors()` 전면 허용(analysis_v1.md §4.13)을 폐기하고 `server/corsConfig.ts`의 allowlist로 교체했다.

- Origin 헤더가 없는 요청(동일 출처 브라우저 탐색, curl, 서버 간 호출)은 항상 허용 — CORS는 애초에 브라우저의 교차 출처 fetch만 규율하므로 동일 출처 동작에는 영향이 없다.
- 개발(`NODE_ENV !== 'production'`)에서는 Vite 기본 오리진(`http://localhost:5173`, `http://127.0.0.1:5173`)이 항상 포함된다.
- 프로덕션에서는 `ALLOWED_ORIGINS`(콤마 구분) 환경변수에 명시된 오리진만 허용되고, 개발 오리진은 포함되지 않는다.
- 거부는 에러가 아니라 `Access-Control-Allow-Origin` 헤더를 생략하는 방식(`callback(null, false)`)으로 처리한다 — 실제 브라우저는 이를 보고 프론트 JS의 응답 읽기를 차단하지만, 서버 자체는 여전히 200을 반환한다(요청을 아예 거부하는 게 아니라 "읽기 권한을 안 준다"는 CORS 스펙의 정상 동작).

---

## 6. 개인정보 처리 구조 재설계 (Phase 0 Blocker)

### 6.1 업로드/스크린샷 개인정보 고지 — 공식 문구 확정

**[결정함, 문구 확정]** 다음 문구를 `PrivacyBadge.jsx`와 `/privacy` 페이지의 **공식 고지 문구**로 확정한다. TXT 업로드와 Screenshot 두 입력 경로 모두에 공통 적용한다(사용자 제공 문구가 "업로드한 대화 파일과 캡처"로 양쪽을 함께 지칭하고 있음).

> 업로드한 대화 파일과 캡처는 분석을 위해 서버 및 AI 처리 서비스로 전송됩니다. 원본 파일은 분석 후 보관하지 않습니다.
> 이름·전화번호·이메일 등 일부 개인정보를 가리지만 모든 개인정보가 완전히 제거된다고 보장할 수는 없습니다.
> 유료 리포트는 익명화된 분석 결과와 필요한 일부 대화 발췌가 최대 30일 보관될 수 있습니다.

이 문구가 실제 구현과 정확히 대응하도록 다음을 보장한다:
- "원본 파일은 분석 후 보관하지 않습니다" → Raw TXT/Screenshot은 요청 처리 중 메모리에만 존재, 디스크·로그 미기록(§6.5 Raw 계층과 정확히 일치)
- "이름·전화번호·이메일 등 일부 개인정보를 가리지만... 완전히 제거된다고 보장할 수는 없습니다" → `redactNamesInBody()` + `redactContactInfo()`(§6.3)가 정확히 이 수준(알려진 화자 실명 정확매칭 + 정규식 기반 전화번호/이메일)까지만 처리한다는 사실과 일치. **"완벽하게 제거한다"는 표현은 이 문구 자체가 명시적으로 금지한다.**
- "유료 리포트는... 최대 30일 보관될 수 있습니다" → §6.5 Paid 계층의 30일 TTL과 정확히 일치

**참고**: 이 문구는 무료 Preview 결과의 보존 기간(24시간, §6.5)을 별도로 언급하지 않는다 — Paid보다 더 짧고 보호적인 정책이라 문구상 생략해도 실제 동작과 모순되지 않는다. 법무 검토에서 Preview 보존 기간도 명시하길 원하면 문구에 한 문장을 추가할 수 있으나, 이는 사소한 보강이라 별도 승인 절차 없이 진행 가능하다.

### 6.2 `nameMap` 서버 전송 최소화 *(변경 없음)*

본문 내 실명 비식별화(§6.3)가 완성되면 `nameMap`을 네트워크로 전송하지 않는다.

### 6.3 본문 내 실명 + 전화번호/이메일 비식별화 *(변경 없음)*

`speakerLabels.js`에 `redactNamesInBody()`(알려진 화자 실명 정확매칭)와 `redactContactInfo()`(전화번호/이메일 정규식)를 추가한다. 파서 자체는 무변경.

### 6.4 모바일 스크린샷 순서 변경 *(변경 없음)*

터치용 위/아래 이동 버튼 추가, `moveItem()` 재사용.

### 6.5 저장 정책 — Raw / Preview / Paid 3단 분리 *(변경 없음, §6.1 공식 문구와 정합성 재확인됨)*

| 계층 | 저장 내용 | TTL |
|---|---|---|
| **Raw** | TXT 원문, Screenshot 원본 | 저장 안 함 |
| **Free/Preview** | 익명화된 Preview Result(`recentConversationTemperature` 등, §12.4) | 최대 24시간 |
| **Paid** | 익명화된 Report JSON(`relationshipTemperature`, Trend, Turning Point) + Evidence 발췌 | 최대 30일 |

구매 복구는 signed report token으로(§16.5).

### 6.6 개인정보처리방침 페이지 *(변경 없음, §6.1 문구 반영)*

`/privacy` 페이지에 §6.1의 확정 문구 + §6.5 표를 그대로 서술한다.

---

## 7. Standard Message Model — Parser Adapter *(변경 없음)*

`parseChat.js`/`dateUtils.js`/`speakerLabels.js`는 한 줄도 수정하지 않는다. 어댑터 설계와 JS/TS 경계 처리는 §5.1로 통합됐다(중복 서술 제거).

```ts
// server/engine/messageModel/toStandardMessages.ts
import { parseMessages, getConversationMeta } from "../../../src/utils/parseChat.js"; // §5.1의 .d.ts로 타입 부여됨

interface Message {
  id: string;
  speakerId: string;
  timestamp: string | null;
  date: string | null;
  text: string;
  sourceType: "txt" | "screenshot";
  sessionId?: string;
}
```

`EnrichedMessage`(§7.1의 `responseDelaySec`/`isConversationStart`/`isConversationRestart`/`isConversationEnd`/`sessionId`)는 1차 개정과 동일 — `deepAnalysisLocal.js:107-113`의 gap 계산 이식 등.

---

## 8. Relationship Engine v2 — 전체 구조 (2-Stage, 필드명 분리 반영)

### 8.1 파이프라인 다이어그램

**[개정]** Preview/Paid 산출물의 필드명을 명시적으로 분리한다(§12.4).

```
TXT / Screenshot
  ↓ 기존 Parser(무변경) → Standard Message Model(§7) → 개인정보 비식별화(§6)
Message[] (익명화·PII 스크러빙 완료)
  ↓ server/engine/features/codeFeatureExtractor.ts   ── 전체 입력 1회 실행, LLM 아님
CodeFeatures (전체 메시지량 + opportunity 카운트, §9.1)
  ↓ chunk plan 수립(§13.2) — "최근 충분한 구간"과 "그 외 구간"을 미리 구분
  │
  ├──[STAGE 1 · Free Preview · 결제 전]────────────────────────────
  │   ↓ llmSignalExtractor.ts  ── "최근 충분한 구간" chunk만 처리
  │   RelationshipSignal[] (raw, 숫자 없음)
  │   ↓ evidenceValidator.ts
  │   RecentValidatedSignal[]
  │   ↓ scoreEngine.ts (전체 CodeFeatures 중 opportunity는 "최근 구간 한정"으로 계산, §13.2)
  │   recentConversationTemperature + recentRomanceSignal + previewInitiativeRatio + core4Preview
  │   ↓ previewNarrative.ts (코드 템플릿, LLM 없음, "최근 대화 미리보기" 문구 강제)
  │   ↓ Postgres 저장(Prisma), stage2Status='NOT_STARTED', TTL 24h
  │   ↓ 응답 → Paywall
  │
  ├──[결제 완료 webhook — claim 기반 idempotency, §16.3]──────────
  │
  └──[STAGE 2 · Paid Deep · 결제 후, 정확히 1회]────────────────────
      ↓ llmSignalExtractor.ts  ── 나머지 chunk만 처리 (Stage1 처리분 재사용)
      ↓ evidenceValidator.ts (Stage1 Signal과 messageId 기준 병합)
      FullValidatedSignal[]
      ↓ scoreEngine.ts (CodeFeatures 전체 — 전체 대화 기준 opportunity)
      relationshipTemperature + romanticSignal + initiativeRatio + core4 (Preview와 다를 수 있음, 명시적으로 다른 필드명)
      ↓ trend/ (Deep 모드만)
      Trend + TurningPoint[]
      ↓ paidNarrative.ts (LLM 1회, 결제 후에만)
      ↓ Postgres 갱신, stage2Status='COMPLETED', TTL 30일
      ↓ 응답 → Full Report
```

### 8.2 Code Feature Extractor — opportunity 카운트 추가

**[개정]** `CodeFeatures`에 Score Engine의 rate 계산(§9.1)이 쓸 **opportunity 분모**를 추가한다. 전부 순수 카운트이며 LLM 호출 없음.

| CodeFeatures 필드 | 이식 원본 / 계산 방식 |
|---|---|
| `messageCountBySpeaker` | `groupBySpeaker()`(`parseChat.js:359-368`) |
| `turnInitiationCounts` | `calcMetrics()`(`analyzeLocal.js:157-166`) |
| `replyGapStats` | `calcReplyAsymmetry()`(`deepAnalysisLocal.js:100-117`) |
| `emojiRatioBySpeaker` | `analyzeLocal.js:159` |
| `topicKeywordHits` | `detectTopics()`(`analyzeLocal.js:39-46,66-77`) |
| **`opportunityCounts`(신규)** | `{ actorMessageCount, targetMessageCount, restartOpportunityCount, pairOpportunityCount }` — 화자별·pair 유형별로 "행동이 나올 수 있었던 기회 수"를 센다(§9.1) |

폐기 항목(성별 추정, 관계유형 5분류, 로컬 채점 함수)은 1차 개정과 동일.

### 8.3 LLM Signal Extractor *(변경 없음, strength 없음 + chunk 인지형 호출)*

**[결정함, Phase 0.5 — v1 호환 코드의 비상속 원칙]** Phase 0에서 `server/analyze.js`(v1 호환 레거시 엔드포인트)에 두 가지를 추가했다: ① `max_tokens: 8192`(4096에서 상향 — 실측으로 확인된 v1 프롬프트의 JSON 중간 절단 버그 수정, §23.3) ② `messages.parse()` 구조화 출력이 실패하면 레거시 `messages.create()` + 정규식 파싱으로 재시도하는 안전망. **이 둘은 명시적으로 v1 전용 회귀방지 조치이며, v2 Relationship Engine(LLM Signal Extractor 이하 전체)은 이 값과 이 패턴을 그대로 물려받지 않는다.**

- **`max_tokens`**: v2의 Signal Extraction 호출은 §14.1 스키마(청크당 최대 60개 signal, 필드가 짧고 개수 제한이 있음)를 쓰므로 v1의 프롬프트(단일 호출에 8개 가까운 장문 required 필드)와 출력 분량 자체가 다르다. v2는 자기 스키마 크기에 맞는 `max_tokens`를 Phase 1에서 새로 정하고 실측으로 검증한다 — `8192`를 기본값으로 복사해 오지 않는다.
- **레거시 정규식 폴백**: v2는 "Evidence 없는 Signal은 점수에 반영하지 않는다"는 원칙(§11) 위에 서 있다. structured output 파싱이 실패했을 때 정규식으로 원문을 다시 긁어와 강제로 채워 넣는 것은 이 원칙과 정신이 어긋난다 — 파싱 실패는 "그 청크에서 추출된 Signal이 0개"로 처리하고 Evidence Validator·Score Engine이 그 사실을 있는 그대로 반영하게 한다(재시도는 허용하되, 정규식 기반 v1 방식의 폴백 구조 자체를 이식하지 않는다).

### 8.4 이후 단계

Evidence Validator(§11), Score Engine(§9, §12), Trend/Turning Point(§13), Romance(§14), JSON Schema(§15), 2-Stage 오케스트레이션(§16)은 아래에서 설계한다.

---

## 9. Core 4 지표의 실제 구현 방식 — Opportunity Rate + Saturation (핵심 재설계)

> **⚠️ Phase 1.2 기준 stale 표시**: 아래 §9.3(saturation 공식·opportunity floor)과 §9.5(Reciprocity의 `pairOpportunityCount`)는 이후 Phase 1.1/1.2에서 실제로 다르게 구현됐다. 최신 정확한 공식·타입·수치는 **§25**를 기준으로 삼는다. 이 섹션은 "왜 opportunity-rate 방식이 필요한가"라는 설계 논리 자체는 여전히 유효하므로 historical note로 남겨둔다.

### 9.1 왜 "가중치 × raw count"가 틀렸는가

**[개정, 핵심]** 1·2차 개정까지의 설계는 `Σ count[signalType] × weight[signalType]`였다. 이것은 다음 두 가지를 왜곡한다:

1. **대화 길이 왜곡**: 100개 메시지 대화에서 후속 질문 5개(비율 5%)와 1,000개 메시지 대화에서 후속 질문 5개(비율 0.5%)는 전혀 다른 관심도를 의미하는데, raw count 방식은 둘 다 "5개"로 동일하게 취급한다.
2. **무한 반복 왜곡**: 같은 signalType이 아주 많이 관찰되면(대화가 아주 길고 정말로 그 행동이 반복되면) 점수가 상한 없이 계속 올라갈 수 있어, "이미 확실히 관심 있다"와 "약간 더 확실히 관심 있다"를 구분하지 못한다.

이를 해소하기 위해 **opportunity 대비 rate**로 정규화하고, 그 rate에 **점근적 saturation**을 적용한다.

### 9.2 Opportunity 정의

signalType마다 "이 행동이 관찰될 수 있었던 기회의 총량"을 분모로 정의한다.

| Opportunity 종류 | 정의 | 적용 예 |
|---|---|---|
| `actorMessageCount` | 발화자 본인의 메시지 수 (자기가 말할 기회가 몇 번 있었는가) | 자기개방, 감정 표현 |
| `targetMessageCount` | 상대방의 메시지 수 (상대가 반응할 소재를 몇 번 줬는가) | 후속 질문, 재언급 |
| `restartOpportunityCount` | 대화가 끊겼다가 다시 이어질 수 있었던 지점의 수(Code가 시간 간격으로 계산, §7.1) | 대화 먼저 시작, 끊긴 대화 재개 |
| `pairOpportunityCount` | 상대가 먼저 특정 행동(질문/감정표현/농담 등)을 한 횟수 — 그에 대응할 기회 | Reciprocity Pair(질문→답변 등) |

이 값들은 §8.2에서 Code Feature Extractor가 전부 코드로 계산한다(LLM 관여 없음).

### 9.3 계산 함수 — deterministic, Score Engine 내부

**[STALE — §25 참고]** 아래 스케치의 `MIN_OPPORTUNITY_FLOOR=5`(rate 억제용 floor), 정규화 안 된 `saturatedContribution`(rate=1에서 weight의 ~86.5%까지만 도달), `confidence`가 `signals.length`(evidenceCount)로 결정되는 부분은 전부 Phase 1.1/1.2에서 실제와 달라졌다. 아래는 최초 설계 스케치로만 유지한다.

```ts
// server/engine/score/core4.ts

const MIN_OPPORTUNITY_FLOOR = 5;      // 대화가 극단적으로 짧을 때 분모가 0에 가까워지는 것 방지 (튜닝 가능, §19.2에서 보정)
const SATURATION_TAU = 0.5;           // rate가 이 값 근처에서 이미 가중치의 상당 부분을 얻고, 1에 가까워질수록 증가폭이 줄어듦 (튜닝 가능)

interface SignalTypeConfig {
  signalType: string;
  weight: number;                     // 코드에 고정, LLM 관여 없음
  opportunityKind: "actorMessageCount" | "targetMessageCount" | "restartOpportunityCount" | "pairOpportunityCount";
}

/** count/opportunity를 0~1 rate로 정규화 — 길이가 달라도 비율이 같으면 같은 값이 나온다 */
function rateFor(count: number, opportunity: number): number {
  const denom = Math.max(opportunity, MIN_OPPORTUNITY_FLOOR);
  return Math.min(1, count / denom);
}

/** rate를 점근적으로 saturate — 무한히 반복돼도 weight를 절대 초과하지 않고, 1에 가까워질수록 증가폭이 줄어든다(선형 아님) */
function saturatedContribution(rate: number, weight: number): number {
  return weight * (1 - Math.exp(-rate / SATURATION_TAU));
}

function computeIndividualScore(
  signals: ValidatedSignal[],           // Evidence Validator를 통과한 것만
  actorSpeakerId: string,
  opportunities: OpportunityCounts,     // §8.2 CodeFeatures.opportunityCounts
  config: SignalTypeConfig[],
): { score: number; confidence: "low" | "medium" | "high" } {
  const byType = groupBy(signals.filter(s => s.actorSpeakerId === actorSpeakerId), s => s.signalType);
  let total = 0;
  let weightSum = 0;
  for (const cfg of config) {
    const count = byType[cfg.signalType]?.length ?? 0;
    const opportunity = opportunities[cfg.opportunityKind];
    const rate = rateFor(count, opportunity);
    total += saturatedContribution(rate, cfg.weight);
    weightSum += cfg.weight;
  }
  const score = Math.round((total / weightSum) * 100);
  const confidence = signals.length < 3 ? "low" : signals.length < 8 ? "medium" : "high";
  return { score, confidence };
}
```

**세 가지 invariant를 이 함수가 만족하는지는 §19.2에서 synthetic fixture로 검증한다**:
- 동일 비율, 대화 길이 10배 → `rateFor()`의 count/opportunity 둘 다 10배가 되므로 rate 불변 → 점수 불변
- 같은 signal 무한 반복 → rate가 1에 근접해도 `saturatedContribution()`은 `weight × (1 - e^{-1/0.5})` ≈ `weight × 0.865`에서 사실상 정체 — 100을 향해 선형으로 가지 않음
- 같은 count, 다른 opportunity → `rateFor()`가 다른 값을 반환하므로 점수가 구분됨

### 9.4 Preview와 Paid에서 opportunity가 다르게 계산됨 (Review 결정 C·사용자 지침 8과 연결)

**[결정함]** `computeIndividualScore()` 자체는 Stage 무관 공용 함수다. 그러나 **호출 시 전달되는 `opportunities`가 다르다**:
- Preview(Stage1) 호출 시: opportunity는 **"최근 충분한 구간"에 속한 메시지만 기준**으로 계산 — Code Feature Extractor가 전체 대화를 다 봤더라도, Preview 호출부는 그 구간에 한정된 opportunity 서브셋을 전달한다.
- Paid(Stage2) 호출 시: opportunity는 **전체 대화 기준**으로 계산.

이 때문에 같은 함수, 같은 코드로 계산해도 Preview와 Paid의 점수는 **자연스럽게, 그리고 의도적으로** 다를 수 있다 — 이것이 버그가 아니라 "서로 다른 범위를 분석했다"는 사실 그 자체다(§12.4에서 필드명·UI 표현으로 이어짐).

### 9.5 지표별 Code/LLM 입력 분리 *(변경 없음, opportunityKind만 추가 명시)*

| 지표 | Code 입력 | LLM Signal 입력 | opportunityKind |
|---|---|---|---|
| **Interest** | `isConversationRestart` | 후속 질문/재언급/감정확인/화제확장/구체적 관심표현/약속 후속확인 | `targetMessageCount`(대부분), `restartOpportunityCount`(재개 관련) |
| **Initiative** | `isConversationStart`/`isConversationRestart` — 순수 코드 | 새 화제 제시/약속·통화·만남 제안/대화 확장 | `restartOpportunityCount` |
| **Intimacy** | 없음 | 자기개방/취약한 이야기/일상 공유/공유 맥락/장난·애칭/미래 포함 | `actorMessageCount` |
| **Reciprocity** | Pair 시간적 근접성 | Pair 의미적 대응 여부 | `pairOpportunityCount` |

### 9.6 표현 강도(intensity) enum — MVP 미도입 확정

**[결정함]** Signal에 `intensity: "implicit"|"direct"|"explicit"` 같은 표현 강도 필드는 **MVP에서 도입하지 않는다**. Opportunity rate + saturation만으로 충분히 표현력 있는 점수가 나온다고 보고, 운영 중 실제로 부족함이 확인되면 그때 코드 고정 가중치를 가진 enum으로 재검토한다.

---

## 10. Code 계산 영역과 LLM 판단 영역 분리 (경계 규칙)

### 10.1 타입 시스템으로 강제하기 *(§5.1의 TS 경계 설계에 의해 실제로 성립함)*

```ts
// server/engine/score/scoreEngine.ts
interface ScoreEngineInput {
  codeFeatures: CodeFeatures;            // opportunityCounts 포함(§9.1)
  validatedSignals: ValidatedSignal[];   // 숫자 필드 없음. Evidence Validator를 통과한 것만.
}

export function runScoreEngine(input: ScoreEngineInput): CoreScoreResult {
  // 순수 함수. Preview/Paid 어느 쪽에서 호출되든 동일 코드 — 차이는 input의 opportunity 범위뿐(§9.4)
}
```

`RelationshipSignal`(raw)과 `ValidatedSignal`(검증 통과)은 서로 다른 타입이며, 이 구분은 **§5.1에서 확정한 JS/TS 경계 설계에 의해 `server/engine/**` 서브트리 전체에서 실제로 강제된다** — 레거시 JS와 섞이는 지점이 파서 진입부 하나로 봉쇄돼 있기 때문에, Score Engine 내부에서 raw LLM 출력을 몰래 받아들일 방법이 타입 시스템상 없다.

### 10.2 정적 검사 *(변경 없음)*

`server/engine/score/**`, `server/engine/features/**`에서 `@anthropic-ai/sdk` import를 린트로 금지.

### 10.3 책임 매핑표 *(변경 없음)*

*(1차 개정 표와 동일 — 생략 없이 유지, 내용 변경 없음)*

---

## 11. Evidence Validation *(변경 없음 — opportunity/rate 계산은 이 단계 이후에 일어나므로 검증 로직 자체는 영향 없음)*

`validateSignal()`은 strength 없이 messageIds·speakerId·category·reason만 검증한다(1차 개정과 동일). `mergeDuplicates()`도 동일 — 청크 간·Stage 간 중복을 messageId 기준으로 병합한다. Evidence Validator의 출력(`ValidatedSignal[]`)이 Score Engine의 opportunity-rate 계산(§9)에 입력될 뿐, 검증 로직 자체는 이번 개정으로 바뀌지 않는다.

---

## 12. Score Engine

### 12.1 순수성과 결정성 *(변경 없음)*

Score Engine은 순수 함수다. Preview/Paid 두 번 실행되지만 각 실행은 독립적으로 결정적이다.

### 12.2 계산 순서 *(변경 없음, 함수는 stage-agnostic — 단 아래 스케치는 §25 기준으로 파라미터가 늘었다)*

**[STALE — §25 참고]** 아래 스케치는 `reciprocityPairs`를 입력받지 않고 `temperature`를 그냥 숫자로 반환하지만, 실제로는 `runScoreEngine()`이 `reciprocityPairs`도 함께 받고 `temperature`는 `{ score: number | null; confidence }`를 반환한다(Phase 1.2, §25.4).

```ts
export function runScoreEngine(input: ScoreEngineInput): CoreScoreResult {
  const core4 = computeCore4(input);              // §9 opportunity rate + saturation
  const temperature = computeTemperature(core4);   // §12.3
  const romance = computeRomanceScore(input.validatedSignals, input.codeFeatures.opportunityCounts);  // §14
  const position = computeRelationshipPosition(temperature, romance);
  return { core4, temperature, romance, position, scoreEngineVersion: WEIGHTS_VERSION };
}
```

`runScoreEngine()` 자체는 **Preview인지 Paid인지 모른다** — 어떤 stage에서 호출됐는지는 호출부(§16.2, §16.3)의 책임이다. 이 함수가 반환하는 `temperature`는 그냥 숫자다. **사용자에게 보여줄 필드 이름을 정하는 것은 이 함수의 일이 아니라 §12.4의 일이다.**

### 12.3 Relationship Temperature 계산식 *(가중치는 변경 없음 — null 처리는 §25 참고)*

`mutualInterest × 0.40 + mutualIntimacy × 0.25 + reciprocity × 0.25 + interactionEnergy × 0.10`. `computeTemperature()` 시그니처에 `initiative`(현재 이름 `conversationInitiationRatio`)/`romance` 파라미터 없음(금지 사항의 타입 강제) — 이 부분은 변경 없음. **[STALE 아님, 그러나 보강]** Phase 1.2부터 4개 구성요소 중 일부가 `null`이면 나머지로 가중치를 재정규화하고, 커버리지가 너무 낮으면 Temperature 자체가 `null`이 된다 — §25.4 참고.

### 12.4 Preview와 Paid의 결과는 다른 이름을 가진다 (사용자 지침 8·C 핵심 반영)

**[결정함, 신규 핵심 설계]** `runScoreEngine()`이 반환하는 제네릭한 `temperature`/`romance`/`core4` 숫자를, **API·DB·UI 어디에도 그대로 노출하지 않는다.** 각 파이프라인이 스스로 이름을 붙여 감싼다:

```ts
// server/engine/pipeline/previewPipeline.ts
interface PreviewScoreResult {
  recentConversationTemperature: number;   // "최근 대화 온도" — 관계온도가 아님
  recentRomanceSignal: number;
  initiativeRatioPreview: { personA: number; personB: number };
  core4Preview: Core4Result;
  windowLabel: string;                     // 예: "최근 3주" — 어느 구간을 봤는지 UI에 그대로 노출
  confidenceLabel: "recent_window";
}

function runPreviewScoring(input: ScoreEngineInput, windowLabel: string): PreviewScoreResult {
  const raw = runScoreEngine(input);
  return {
    recentConversationTemperature: raw.temperature,
    recentRomanceSignal: raw.romance.score,
    initiativeRatioPreview: raw.core4.initiative,
    core4Preview: raw.core4,
    windowLabel,
    confidenceLabel: "recent_window",
  };
}
```

```ts
// server/engine/pipeline/paidPipeline.ts
interface PaidScoreResult {
  relationshipTemperature: number;          // "관계온도" — 전체 대화 기준
  romanticSignal: number;
  initiativeRatio: { personA: number; personB: number };
  core4: Core4Result;
  trend: Trend | null;
  turningPoints: TurningPoint[];
  confidenceLabel: "full_analysis";
}
```

**두 타입은 필드 이름이 겹치지 않는다** — `recentConversationTemperature` vs `relationshipTemperature`, `recentRomanceSignal` vs `romanticSignal`. 이렇게 하면 UI·API 코드에서 실수로 Preview 값을 "최종 관계온도"인 것처럼 표시할 방법이 타입 레벨에서 원천 차단된다(변수명 오사용은 타입이 다르므로 컴파일 에러가 난다).

**UI 표현 원칙**:
- Preview 화면(무료)은 반드시 "🌡️ 최근 대화 온도 72° (최근 3주 기준)"처럼 **범위를 함께 표기**한다.
- Paid 화면(결제 후)은 "🌡️ 관계온도 68° (전체 대화 기준)"으로 표기하며, Preview 값과 달라졌다면 "최근 미리보기(72°)보다 전체 분석에서는 조금 다르게 나타났어요"처럼 **차이를 숨기지 않고 설명**한다.
- 두 값이 "같은 개념의 정밀도 차이"가 아니라 **"다른 범위를 본 서로 다른 지표"**라는 점을 카피에 명시한다(PRD의 Data Confidence 등급 개념보다 한 걸음 더 나아간 것 — 신뢰도만 다른 게 아니라 **분석 대상 범위 자체가 다르다**).

### 12.5 가중치 버전 관리 *(변경 없음)*

`scoreEngineVersion`을 Preview·Paid 각각의 저장 레코드에 함께 저장.

---

## 13. Trend / Turning Point Engine (Paid Deep 전용)

### 13.1 적용 조건 *(변경 없음)*

`analysisMode === "deep"`일 때만, Paid Deep(Stage 2)에서만 활성화.

### 13.2 청킹 전략 — "최근 충분한 구간" 정의 확정 (사용자 지침 8 반영)

**[결정함, 이전의 결정 필요 항목 해소]** Preview가 볼 대상을 **"최근 충분한 대화 구간"**으로 확정한다. 구체 규칙:

```ts
// server/engine/pipeline/chunkPlan.ts
const MIN_PREVIEW_MESSAGES = 40;   // 이 개수 미만이면 신뢰하기 어려운 미리보기로 간주해 계속 확장
const MAX_PREVIEW_MESSAGES = 120;  // 비용 상한 — 이 이상은 확장하지 않음(대화가 아주 짧으면 전체가 곧 "최근 구간"이 됨)

function selectPreviewWindow(chunkPlan: Chunk[]): { chunks: Chunk[]; windowLabel: string } {
  // 시간상 가장 최근 chunk부터 시작해, 누적 메시지 수가 MIN_PREVIEW_MESSAGES에 도달할 때까지
  // (또는 전체 대화의 시작에 도달할 때까지) 과거 방향으로 chunk를 추가한다.
  // 누적 메시지 수가 MAX_PREVIEW_MESSAGES를 넘으면 그 시점에서 멈춘다(비용 상한).
  // windowLabel: 선택된 구간의 실제 날짜 범위를 사람이 읽을 문구로 반환 (예: "최근 3주", "최근 대화 전체")
}
```

- 대화 전체가 `MIN_PREVIEW_MESSAGES`보다 짧으면(Snapshot 모드에 가까운 경우) **전체가 곧 미리보기 구간**이 된다 — 이 경우 Preview와 Paid가 사실상 같은 입력을 보게 되므로 두 값이 거의 동일하게 나올 수 있다(이 자체도 정상이다).
- `windowLabel`은 §12.4의 `PreviewScoreResult.windowLabel`로 그대로 전달돼 UI에 노출된다 — "최근 몇 개를 봤는지"를 사용자에게 항상 알려준다는 원칙(사용자 지침 8 "반드시 '최근 대화 미리보기'로 표시")을 구체적인 날짜 라벨까지 포함해 만족한다.
- `MIN_PREVIEW_MESSAGES`/`MAX_PREVIEW_MESSAGES`의 정확한 수치(40/120)는 이 문서가 제안하는 기본값이며, §19.2 invariant test와 실제 비용 데이터로 보정 가능한 설정값이다 — 별도 승인 없이 조정 가능한 튜닝 파라미터로 취급한다.

**Paid(Stage2)**: chunk plan에서 Preview가 이미 처리한 chunk를 제외한 **나머지 전체**를 처리한다(1차 개정과 동일, 변경 없음). 두 Stage의 `ValidatedSignal[]`을 병합해 Trend Engine 입력을 만드는 절차(§11)도 변경 없음.

### 13.3 Turning Point 탐지 *(변경 없음)*

```ts
function findTurningPointCandidates(segmentScores: TemperatureBySegment[]): TurningPointCandidate[] {
  return adjacentPairs(segmentScores).filter(([prev, curr]) => {
    const delta = curr.temperature - prev.temperature;
    const sameDirectionCount = countCoreIndicatorsMovingSameDirection(prev, curr);
    return Math.abs(delta) >= 10 && sameDirectionCount >= 2;
  });
}
```

---

## 14. Romantic Signal — Opportunity Rate 반영

### 14.1 구조

**[개정]** Romance도 §9와 동일한 원칙(opportunity rate + saturation)을 적용한다. Romance/Distancing Signal에는 자연스러운 "상대가 준 기회" 개념이 약하므로, opportunity는 **전체 유효 메시지 수**를 기준으로 삼는다.

```ts
// server/engine/score/romance.ts
function computeRomanceScore(signals: ValidatedSignal[], opportunities: OpportunityCounts): RomanceResult {
  const positive = signals.filter(s => s.category === "romance" && s.direction === "positive");
  const distancing = signals.filter(s => s.category === "distancing");
  const totalMessages = opportunities.actorMessageCount + opportunities.targetMessageCount;

  const positiveRate = rateFor(positive.length, totalMessages);
  const distancingRate = rateFor(distancing.length, totalMessages);
  const score = clamp(
    saturatedContribution(positiveRate, 100) - saturatedContribution(distancingRate, 100),
    0, 100,
  );

  return {
    score,
    positiveCount: positive.length,
    ambiguousCount: signals.filter(s => s.category === "romance" && s.direction === "neutral").length,
    distancingCount: distancing.length,
  };
}
```

### 14.2 노출 게이팅 / 14.3 표시 규칙 *(변경 없음)*

Intent가 연애 관련일 때 우선 노출, family/work면 억제. 지수(Index) 표시, 확률 표현 금지.

---

## 15. JSON Schema

### 15.1 Signal Extraction Schema

**[STALE — §25 참고]** 아래 스케치의 `category` enum에 `"reciprocity"`가 남아 있으나, Phase 1.1부터 `RelationshipSignal.category`에서 `reciprocity`는 제거됐다(`interest`/`intimacy`/`romance`/`distancing` 4종만). 상호반응은 별도의 `reciprocityPairs` 배열(트리거/응답 messageId를 각각 명시하는 `ReciprocityPair`)로 보고한다 — §25.3 참고.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["relationType", "signals"],
  "properties": {
    "relationType": { "type": "string", "enum": ["romantic", "friendship", "work", "family", "ambiguous"] },
    "signals": {
      "type": "array",
      "maxItems": 60,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["signalType", "category", "direction", "actorSpeakerId", "messageIds", "reason"],
        "properties": {
          "signalType": { "type": "string" },
          "category": { "type": "string", "enum": ["interest", "intimacy", "reciprocity", "romance", "distancing"] },
          "direction": { "type": "string", "enum": ["positive", "neutral", "negative"] },
          "actorSpeakerId": { "type": "string" },
          "targetSpeakerId": { "type": "string" },
          "messageIds": { "type": "array", "items": { "type": "string" }, "minItems": 1, "maxItems": 5 },
          "reason": { "type": "string", "maxLength": 300 }
        }
      }
    }
  }
}
```

숫자 필드가 없다는 원칙은 유지된다. LLM은 "무엇이 관찰됐는가"만 반환하고, 그것이 몇 번째 관찰인지·기회 대비 얼마나 자주 나왔는지는 전부 §9의 Score Engine이 계산한다.

### 15.2 Turning Point Narrative Schema *(변경 없음)*

### 15.3 Paid Narrative Schema *(변경 없음 — 결제 후에만 호출)*

### 15.4 Preview Narrative — 코드 템플릿 확정, "최근 대화 미리보기" 문구 의무화

**[결정함, 확정]** Free Preview의 `firstVerdict`/`summaryOneLine`은 **LLM을 호출하지 않고 코드 템플릿**으로 생성하는 것으로 최종 확정한다.

```ts
// server/engine/narrative/previewNarrative.ts
function buildPreviewNarrative(score: PreviewScoreResult, topSignal: ValidatedSignal | null): PreviewNarrative {
  const temperatureBucket = bucketize(score.recentConversationTemperature);
  const romanceBucket = bucketize(score.recentRomanceSignal);
  const template = FIRST_VERDICT_TEMPLATES[temperatureBucket][romanceBucket];
  return {
    // "최근 대화 미리보기" 또는 windowLabel(예: "최근 3주")을 문구에 반드시 포함 — 하드코딩된 필수 요소
    firstVerdict: template.firstVerdict(topSignal, score.windowLabel),
    summaryOneLine: `${score.windowLabel} 기준 — ${template.summaryOneLine(topSignal)}`,
  };
}
```

모든 템플릿 문자열은 `windowLabel`을 반드시 삽입하는 위치를 갖도록 설계한다(예: "최근 3주 동안은 관심 없는 사람의 카톡은 아니었어요") — "미리보기가 전체 관계를 보고 하는 말"로 오인되지 않도록 문구 레벨에서 강제한다.

---

## 16. Free Preview / Paid Deep Analysis — 2-Stage Compute

### 16.1 불변식 *(변경 없음)*

> "결제 후 LLM을 다시 호출하지 않는다" → **"이미 수행한 분석을 중복 호출하지 않는다."**

### 16.2 Stage 1 — Free Preview

1. Parser → Standard Message Model → 개인정보 비식별화(§6)
2. Code Feature Extractor 전체 실행(§8.2, opportunityCounts 포함)
3. `selectPreviewWindow()`(§13.2)로 "최근 충분한 구간" 확정 + `windowLabel` 산출
4. LLM Signal Extractor — 그 구간의 chunk만 호출
5. Evidence Validator → `RecentValidatedSignal[]`
6. `runPreviewScoring()`(§12.4) — **구간 한정 opportunity**로 Score Engine 실행 → `PreviewScoreResult`
7. `buildPreviewNarrative()`(§15.4) — 코드 템플릿, `windowLabel` 포함
8. Prisma로 저장: `stage2Status = 'NOT_STARTED'`, `processedChunkIds`, TTL 24시간
9. 응답: `PreviewScoreResult` + Preview Narrative만 반환. Paywall 노출.

**Preview 단계의 LLM 호출은 정확히 1회(Signal Extraction, 제한된 chunk)뿐이다.**

### 16.3 결제 → Stage 2 트리거 — Idempotency + PaymentGateway Interface

**[결정함]** 결제 Provider는 **지금 선정하지 않는다.** 대신 Provider에 무관한 `PaymentGateway` interface를 먼저 설계하고, 내부 로직(claim 기반 idempotency)은 이 interface에만 의존하게 만든다.

```ts
// server/engine/payment/paymentGateway.ts — Provider 중립 인터페이스, 지금 설계
interface PaymentGateway {
  createCheckoutSession(input: {
    analysisId: string;
    amount: number;
    currency: "KRW";
  }): Promise<{ checkoutUrl: string; providerSessionId: string }>;

  /** webhook 원문 바디·헤더로 서명을 검증 — Provider마다 방식이 다르므로 구현체 안으로 격리 */
  verifyWebhookSignature(rawBody: Buffer, headers: Record<string, string>): boolean;

  /** 검증된 webhook을 표준 이벤트로 정규화 — 상위 로직은 이 표준 이벤트만 본다 */
  parseWebhookEvent(rawBody: Buffer): PaymentWebhookEvent;
}

type PaymentWebhookEvent =
  | { type: "payment.completed"; analysisId: string; providerPaymentId: string; amount: number }
  | { type: "payment.failed"; analysisId: string; providerPaymentId: string; reason: string };
```

`onPaymentConfirmed()`(idempotency 로직, 아래)는 `PaymentGateway`가 반환한 **정규화된 `PaymentWebhookEvent`만** 입력받는다 — 어떤 PG를 쓰든 이 로직은 바뀌지 않는다. **Provider 선정은 Phase 3 착수 시점에 한다**(§20).

```ts
// server/engine/paidDeep/runPaidDeepAnalysis.ts
async function onPaymentConfirmed(event: Extract<PaymentWebhookEvent, { type: "payment.completed" }>) {
  const claimed = await analysisResultRepo.claimForPaidStage(event.analysisId);   // Prisma updateMany 원자적 claim(§5.3)
  if (!claimed) return;   // 이미 실행됐거나 실행 중

  try {
    await analysisResultRepo.updateStage2Status(event.analysisId, "RUNNING");
    const stored = await analysisResultRepo.findById(event.analysisId);

    const remainingChunks = stored.chunkPlan.filter(c => !stored.processedChunkIds.includes(c.id));
    const newRawSignals = await llmSignalExtractor.run(remainingChunks, stored.codeFeatures);
    const newValidated = evidenceValidator.validateAll(newRawSignals, remainingChunks);
    const fullSignals = mergeDuplicates([...stored.previewValidatedSignals, ...newValidated]);

    const fullScoreEngineResult = runScoreEngine({ codeFeatures: stored.codeFeatures, validatedSignals: fullSignals });
    const paidScore = toPaidScoreResult(fullScoreEngineResult);   // §12.4 — relationshipTemperature 등으로 명명

    const trend = stored.analysisMode === "DEEP" ? runTrendEngine(fullSignals, stored.codeFeatures) : null;
    const paidNarrative = await narrativeGenerator.generatePaid(paidScore, trend, stored.intent);

    await analysisResultRepo.completePaidStage(event.analysisId, { paidScore, trend, paidNarrative, ttlDays: 30 });
  } catch (err) {
    await analysisResultRepo.markPaidStageFailed(event.analysisId, String(err));
  }
}
```

보장하는 것(1차 개정과 동일): webhook 중복 전송 방어, 동시 트리거 방어, 실패 재시도 시 이미 성공한 chunk 재사용.

### 16.4 응답 직렬화 *(변경 없음, 필드명만 §12.4 반영)*

```ts
async function getAnalysisResult(analysisId: string) {
  const stored = await analysisResultRepo.findById(analysisId);
  if (stored.stage2Status !== "COMPLETED") {
    return { ...stored.previewFields, stage: "preview_only" };   // PreviewScoreResult 형태
  }
  return { ...stored.previewFields, ...stored.paidFields, stage: "paid_complete" };  // Paid 필드 추가 공개
}
```

### 16.5 결제 없이 구매내역 복구 — PG 영수증 조회 채널 미구현 확정

**[결정함]** signed report token(§6.5)만으로 구매내역을 복구한다. **별도 PG 영수증 조회 채널은 MVP에서 구현하지 않는다.** Provider가 자체 제공하는 영수증 페이지가 있다면 그쪽으로 링크만 걸어두는 정도로 충분하며, 이 앱이 별도 조회 UI를 만들지 않는다.

---

## 17. Usage / 비용 측정

### 17.1 로그 스키마 *(변경 없음, Prisma 테이블로 구체화)*

```prisma
model AnalysisUsageLog {
  analysisId            String   @id
  inputType             String
  analysisMode          String
  ocrCost               Float?
  previewInputTokens    Int
  previewOutputTokens   Int
  previewCost           Float
  paidInputTokens       Int?
  paidOutputTokens      Int?
  paidCost              Float?
  totalCostPerAnalysis  Float
  signalRejectionRate   Float
  reportType            String
  paid                  Boolean  @default(false)
  converted             Boolean  @default(false)
  createdAt             DateTime @default(now())
  paidAt                DateTime?
}
```

### 17.2 Funnel — GA4 + 서버 DB 이중 기록 원칙 (확정)

**[결정함]** Funnel 이벤트 수집 도구는 **GA4로 확정**한다. 단, 다음 원칙을 명확히 한다:

> **GA4는 행동/마케팅 분석 전용이다. 결제·분석 완료·API 비용처럼 "돈이 걸린" authoritative 이벤트는 GA4에만 의존하지 않고 반드시 서버 DB(Postgres)에도 기록한다.**

| 이벤트 | GA4 | 서버 DB |
|---|---|---|
| `landing_view`/`intent_selected`/`upload_started`(순수 UX 퍼널) | ✅ | ❌ |
| `preview_viewed`/`paywall_viewed` | ✅ | ❌ (전환율 계산엔 GA4로 충분) |
| **`analysis_completed`(Preview/Paid 완료)** | ✅(참고용) | ✅ **authoritative** — `AnalysisUsageLog`에 이미 기록됨(§17.1) |
| **`payment_completed`** | ✅(참고용) | ✅ **authoritative** — `payments` 테이블(§16.3 idempotency의 근거) |
| **API 비용(토큰·`apiCostEstimate`)** | ❌ (GA4에 절대 보내지 않음) | ✅ **유일한 소스** |

이 구분의 이유: GA4는 샘플링·광고 차단 확장 프로그램·클라이언트 측 실패 등으로 이벤트 유실이 발생할 수 있는 도구다. 매출·비용 숫자가 유실 가능한 클라이언트 이벤트에 의존하면 안 되므로, **돈과 직결된 숫자는 서버가 자기 자신의 DB에 직접 쓴다.**

### 17.3 저장 위치 / 17.4 대시보드 *(변경 없음)*

---

## 18. 기존 만세력 엔진 재사용 방식

### 18.1 현황 확인 *(변경 없음)*

`~/Projects/heydaystar`에 `manseryeok`(공개 npm 패키지) 어댑터(`manseryeok-provider.ts`) + 도메인 로직(`src/domain/saju/**`, golden test) + 비교 로직(`src/domain/comparison/**`)이 존재한다.

### 18.2 Shared Package 범위 확정 — 계산 + 정책 어댑터 + Golden Test까지만

**[결정함, 범위 확정]** Shared Package(`@heydaystar/saju-core` 등)에 포함할 범위를 다음으로 **한정**한다:

| 포함 | 제외 |
|---|---|
| `manseryeok-provider.ts`(출생시각 미상 처리, 절입 경계 정책 등 HEYDAY 고유 정책 어댑터) | `src/domain/comparison/**`(두 사람 비교·서술 로직 — `compare.ts`, `describe.ts`, `sajuLensScores` 등) |
| `src/domain/saju/**`의 순수 계산 로직(오행/십신, 출생 정규화, `birth-normalization.ts`, `ten-gods.ts`, `five-elements.ts`) | `heydaystar`의 Prisma 스키마·Next.js 라우트·UI 컴포넌트 |
| Golden test 픽스처(`golden-cases.ts`, `golden.test.ts`) — **두 레포 모두 이 픽스처로 검증** | — |

**제외 이유**: `domain/comparison`은 "두 사람의 사주 특성을 어떻게 서술할지"에 대한 **HEYDAY STAR 고유의 Narrative 판단**이 섞여 있어, 카톡밀당분석기의 "관계 스타일" 서술과 반드시 같을 필요가 없다. Shared Package는 **순수 계산(사실)**까지만 공유하고, **그 계산 결과를 어떻게 이야기로 풀지(해석)**는 각 서비스가 자기 제품에 맞게 따로 만든다 — 이는 §10의 "Code(계산)와 LLM(해석) 분리" 원칙과도 결이 같다.

```ts
// heydaystar-kakao-analyzer 쪽 — shared package의 순수 계산 결과 위에 자체 Narrative를 얹는다
// server/engine/saju/sajuProvider.ts
import { calculateFourPillars, getTenGod, getBranchTenGod } from "@heydaystar/saju-core";

const localSajuProvider: SajuProvider = {
  async getRelationshipStyle(input) {
    const pillars = calculateFourPillars(/* shared package 함수 그대로 호출 */);
    // 여기서부터는 카톡밀당분석기 고유의 "관계 스타일 Narrative" 프롬프트/템플릿을 사용 — heydaystar의 domain/comparison은 참조하지 않는다
    return buildRelationshipStyleNarrative(pillars);
  },
};
```

### 18.3 추출 방식 우선순위 *(1차 개정과 동일, 변경 없음)*

1순위 Shared Package 추출(위 범위로 한정) → 2순위 provenance 명시 이식(golden test 동반) → 내부 API 호출은 채택 안 함.

### 18.4 남은 결정 — 일정 조율만

**[결정 필요, 범위는 해소됨]** 이번 개정으로 **무엇을 공유할지는 확정**됐다. 남은 것은 `heydaystar` 프로젝트 쪽 코드 소유자와의 **추출 작업 일정 조율**뿐이다(§22).

---

## 19. 테스트 전략

### 19.1 파서 회귀 테스트 *(변경 없음)*

### 19.2 Score Engine 테스트 — Invariant 우선 + 신규 3종 (Opportunity Rate 검증)

**[개정]** §9의 opportunity-rate + saturation 설계를 직접 검증하는 invariant를 추가한다. 1차 개정의 8개 예시 + 아래 3개를 합쳐 최소 12~20개 fixture로 확장한다.

| # | Invariant | 검증 방법 |
|---|---|---|
| (기존 1~8) | Interest 비감소, Reciprocity 일방향 비상승, Intimacy 비하락, Initiative ratio 이동, 친구대화 Romance 비상승, 명시적 플러팅 Romance 상승, 짧은 대화 Trend 비활성, Evidence 없는 Signal 기여 0 | 1차 개정 §19.2 그대로 유지 |
| **9(신규)** | **길이 불변성**: 동일 signalType 비율(count/opportunity)을 유지한 채 대화 길이(count·opportunity 모두)를 10배로 늘려도 해당 지표 점수는 거의 변하지 않아야 한다(허용 오차 이내) | `buildFixture({ ratio: 0.1, messageCount: 100 })` vs `buildFixture({ ratio: 0.1, messageCount: 1000 })` 비교 |
| **10(신규)** | **Saturation**: 동일 signalType의 count를 opportunity 한도까지 극단적으로 늘려도(rate→1) 해당 signalType의 기여도가 `weight`를 초과하지 않고, rate 0.5→1.0 구간의 증가폭이 rate 0→0.5 구간의 증가폭보다 작아야 한다(오목 함수 성질) | `saturatedContribution(0.5, w)`와 `saturatedContribution(1.0, w)`의 차이가 `saturatedContribution(0, w)`와 `saturatedContribution(0.5, w)`의 차이보다 작음을 확인 |
| **11(신규)** | **Rate vs Count 구분**: 두 fixture가 동일한 raw count(예: 후속 질문 5회)를 가지더라도 opportunity가 다르면(targetMessageCount 20 vs 100) 서로 다른 rate·점수가 나와야 한다 | `buildFixture({ followUpCount: 5, targetMessageCount: 20 })` vs `buildFixture({ followUpCount: 5, targetMessageCount: 100 })`의 Interest 점수가 달라야 함 |

```ts
// tests/engine/scoreEngine.invariant.test.ts
test("길이 불변성 — 동일 비율, 대화 길이 10배 → Interest 거의 불변", () => {
  const small = runScoreEngine(buildFixture({ followUpCount: 2, targetMessageCount: 20, messageCount: 100 }));
  const large = runScoreEngine(buildFixture({ followUpCount: 20, targetMessageCount: 200, messageCount: 1000 }));
  expect(Math.abs(small.core4.interest.personA - large.core4.interest.personA)).toBeLessThan(3);
});

test("saturation — rate 0.5→1.0 증가폭이 0→0.5 증가폭보다 작다", () => {
  const w = 100;
  const low = saturatedContribution(0, w);
  const mid = saturatedContribution(0.5, w);
  const high = saturatedContribution(1.0, w);
  expect(high - mid).toBeLessThan(mid - low);
});

test("동일 count, 다른 opportunity → 다른 점수", () => {
  const sparse = runScoreEngine(buildFixture({ followUpCount: 5, targetMessageCount: 100 }));
  const dense = runScoreEngine(buildFixture({ followUpCount: 5, targetMessageCount: 20 }));
  expect(dense.core4.interest.personA).toBeGreaterThan(sparse.core4.interest.personA);
});
```

### 19.3 Evidence Validator 단위 테스트 *(변경 없음)*

### 19.4 LLM 관련 테스트 *(변경 없음)*

### 19.5 결제/Idempotency 통합 테스트 *(변경 없음, PaymentGateway mock 사용)*

**[개정, 명확화]** `PaymentGateway` interface(§16.3)가 있으므로, 결제 통합 테스트는 **mock `PaymentGateway` 구현체**로 실행한다 — 실제 PG 연동 없이도 idempotency·webhook 중복·동시성 테스트 전부가 Phase 1~2 시점부터 가능하다(Provider 선정은 Phase 3 착수 시점이지만, interface가 먼저 있으므로 그 전에도 로직 테스트는 막히지 않는다).

### 19.6 Trend/Turning Point 테스트 *(변경 없음)*

---

## 20. Phase별 구현 순서와 완료조건

### Phase 0 — Stabilize / Privacy / Cost Metering

작업:
- [ ] `PrivacyBadge.jsx`에 §6.1 **확정 문구**(사용자 제공 텍스트) 반영
- [ ] `speakerLabels.js`에 `redactNamesInBody()` + `redactContactInfo()` 추가
- [ ] `anonymize.js`에서 `nameMap` 서버 전송 제거
- [ ] `ScreenshotImportPanel.jsx` 터치용 위/아래 이동 버튼
- [ ] **개발용 Postgres 인스턴스 확정 후 프로비저닝**(§5.4, 결정 필요) + **Prisma 스키마 설계**(§5.3) + `tsx` 기반 TS 서버 부트스트랩(§5.1, `.d.ts` 경계 포함)
- [ ] 새 쿼터/식별 체계 — 쿠키 세션 + IP 레이트리밋
- [ ] `AnalysisResult`/`AnalysisUsageLog` Prisma 모델 — Preview/Paid 필드 분리 구조로 처음부터 설계, TTL 삭제 배치
- [ ] GA4 연동 + 서버 DB 이중기록 원칙에 따른 authoritative 이벤트 기록 지점 설계(§17.2)
- [ ] `og-image.png` 제작·배치
- [ ] `/privacy` 페이지 신설(§6.6)
- [ ] 죽은 에러 미들웨어 제거, `mockResult.js` 삭제
- [ ] **`PaymentGateway` interface 설계**(§16.3) — Provider 구현체 없이 타입·mock만

완료조건:
1. Privacy 문구 문자열과 실제 네트워크 요청 페이로드 대조 테스트(실명·전화번호·이메일 미포함 assertion)
2. `ScreenshotImportPanel` 터치 이벤트 순서 변경 컴포넌트 테스트
3. 동일 IP 임계치 초과 시 429 반환 통합 테스트
4. `analysis_results.purgeExpired()` TTL 삭제 테스트
5. mock `PaymentGateway`로 idempotency 로직(§19.5)이 이미 테스트 가능한 상태

### Phase 1 — Core Engine (Feature → Signal → Validate → Score + Invariant Fixtures)

작업:
- [ ] `toStandardMessages.ts`, `enrich.ts` + `.d.ts` 앰비언트 타입(§5.1)
- [ ] `codeFeatureExtractor.ts` — 부품 채굴 + **opportunityCounts 계산 추가**(§8.2)
- [ ] `llmSignalExtractor.ts` + §15.1 스키마
- [ ] `evidenceValidator.ts`
- [ ] `scoreEngine.ts` — **opportunity rate + saturation 기반 Core4**(§9), Temperature(§12.3), Romance(§14)
- [ ] 레거시 파일(`analyzeLocal.js` 등) 폐기

완료조건:
1. **§19.2 Invariant Fixture 최소 12개 이상 통과** — 특히 **길이 불변성·saturation·rate-vs-count 3종은 필수**
2. Evidence Validator 단위 테스트 통과
3. `server/engine/score/**`, `server/engine/features/**`에서 `@anthropic-ai/sdk` import 시 린트 에러 확인
4. Signal Extraction 스키마 응답에 숫자 필드가 없음을 확인

### Phase 2 — Free Preview

작업:
- [ ] Intent 선택 UI
- [ ] `selectPreviewWindow()`(§13.2) — "최근 충분한 구간" 로직 + `windowLabel` 산출
- [ ] Stage1 파이프라인(`previewPipeline.ts`) — `PreviewScoreResult` 타입으로 결과 명명(§12.4)
- [ ] `previewNarrative.ts`(§15.4, 코드 템플릿, `windowLabel` 문구 강제)
- [ ] Paywall UI — "최근 대화 온도"임을 명시하는 카피
- [ ] Preview 전용 Usage 로깅

완료조건:
1. Preview 단계 LLM 호출이 정확히 1회임을 확인
2. **모든 Preview Narrative 문구에 `windowLabel`(예: "최근 3주")이 실제로 포함됨을 스냅샷 테스트로 확인**
3. Intent만 바꿔도 Core4/Temperature 숫자는 동일함을 확인
4. Preview 결과가 24시간 뒤 조회 불가능함을 확인

### Phase 3 — Payment + Paid Deep

착수 전 작업(**이 시점에 확정**):
- [ ] **결제 Provider 선정**(§16.3, §22) — 이제야 확정
- [ ] **프로덕션 호스팅/DB 플랜 전환 여부 재확인**(§5.4) — 공개 배포가 임박했다면 지금 전환

본 작업:
- [ ] 선정된 Provider로 `PaymentGateway` 구현체 작성(§16.3 interface는 Phase 0에서 이미 존재)
- [ ] `claimForPaidStage()` 등 Prisma 기반 idempotency Repository 메서드
- [ ] Stage2 파이프라인(`paidPipeline.ts`) — `PaidScoreResult` 타입으로 명명(§12.4), 나머지 chunk만 처리
- [ ] `paidNarrative.ts` + §15.3 스키마
- [ ] Paid 전용 Usage 로깅
- [ ] `ResultStep.jsx`의 Preview→Paid 전환 UI — **"관계온도"와 "최근 대화 온도"가 다른 지표임을 명시**하는 UI 블록(§12.4)
- [ ] `serializeForClient()` 필드 게이팅

완료조건:
1. 결제 통합 테스트 전체 통과(실제 선정된 Provider의 샌드박스로 재검증)
2. Stage1 처리 chunk가 Stage2 LLM 호출에 재등장하지 않음
3. Preview·Paid 값이 다를 때 UI가 이를 숨기지 않고 설명 문구를 노출함을 확인(§12.4)

### Phase 4 — Trend / Turning Point (Paid Deep 기반) *(작업/완료조건 변경 없음)*

### Phase 5 — Saju Bundle

작업:
- [ ] `@heydaystar/saju-core` shared package 추출 — **범위: 만세력 계산 + 정책 adapter + golden test까지만**(§18.2, comparison 로직 제외)
- [ ] `sajuProvider.ts` — 로컬 모듈 import 구현체, **카톡밀당분석기 고유의 관계 스타일 Narrative**를 직접 작성(heydaystar의 comparison 로직 참조 안 함)
- [ ] Bundle 결제 SKU 추가
- [ ] AI vs Saju 비교 Narrative

완료조건:
1. 카톡 Score와 사주 결과가 완전히 분리된 레코드/필드임을 코드 리뷰로 확인
2. Bundle 결제 → 두 리포트 모두 Unlock
3. Shared package 계산 결과가 `heydaystar`의 golden-case와 동일함을 테스트로 확인
4. `domain/comparison` 로직을 이 레포가 import하지 않음을 확인(범위 위반 방지)

### Phase 6 — Share / Repeat *(변경 없음)*

---

## 21. Open Questions 해소 현황 (PRD §37 + 전체 개정 반영)

| # | PRD 질문 | 이 문서의 답 |
|---|---|---|
| 1 | Screenshot OCR을 브라우저에서 처리할 수 있는가? | §6.1 — MVP는 아니오. 2.1 기술 실험으로 분리 |
| 2 | 기존 anonymize 구조를 어느 정도까지 재사용할 수 있는가? | §6.3 — 화자 인식·매핑 100% 재사용, 본문·전화번호·이메일까지 확장 |
| 3 | 본문 속 이름을 어느 수준까지 비식별화할 것인가? | §6.1 확정 문구가 정확한 한계를 명시("완전히 제거된다고 보장할 수는 없음") |
| 4 | Core 4 초기 Weight를 어떤 방식으로 테스트할 것인가? | §9, §19.2 — **Opportunity rate + saturation 설계 자체를 invariant test로 검증**, weight 값은 config로 분리해 튜닝 |
| 5 | LLM Structured Output 적용 방식 | §15 — `output_config.format`, 숫자 없는 3종 스키마 |
| 6 | Free Preview 생성 시 Paid Narrative까지 미리 생성할 것인가? | §16 — 아니오, 결제 후에만 |
| 7 | 결제 Provider | **[결정함, 지금 선정 안 함]** — interface 우선, Phase 3 착수 시점에 선정 |
| 8 | 계정 없이 구매내역 복구 | §6.5, §16.5 — signed report token만, PG 영수증 조회는 MVP 미구현 확정 |
| 9 | 만세력 엔진 재사용 방식 | §18.2 — Shared Package(계산+adapter+golden만), comparison 제외 |
| 10 | 저장소/DB | §5.3 — **Postgres + Prisma로 확정** |
| 11 | Render 구조 유지 여부 | §5.4 — 개발 중 유지, 실결제 공개배포 직전 전환으로 확정 |
| 12 | Screenshot 6장 제한 유지 여부 | 변경 근거 없음 — 유지 |
| 13 | TXT 최대 메시지 수/날짜 범위 | §13.2 — chunk plan + Preview window 규칙(40~120)으로 대체 |
| 14 | 긴 TXT LLM 비용 통제 | §13.2, §16 — 2-Stage + chunk 재사용 + opportunity 계산은 전부 코드(비용 없음) |
| 15 | 분석 결과 캐싱 정책 | §6.5 — Preview 24시간 / Paid 30일 확정 |

---

## 22. [결정 필요] 남은 항목

### 22.0 3차 개정 — 최종 확정 (더 이상 열려 있지 않음)

**[결정함, 최종]** 이전 22.1의 2개 항목이 이번 개정으로 모두 확정됐다.

1. **개발용 Postgres**: **로컬 Docker PostgreSQL + Prisma**로 확정. Raw conversation을 DB에 저장하지 않는 기존 원칙은 개발 환경에서도 동일하게 유지한다(개발용 DB라고 해서 원문 저장 금지 원칙이 완화되지 않음). 운영(프로덕션) DB/호스팅 벤더는 §5.4에 확정된 대로 실결제 공개배포 직전에 별도로 결정한다.
2. **사주 Shared Package**: **지금 구현하지 않는다.** Phase 5 착수 시점에 HEYDAY STAR의 만세력 계산 + policy adapter + golden test만(§18.2 범위 그대로) shared package로 추출한다. **그 전까지 `~/Projects/heydaystar`의 기존 코드는 일절 수정하지 않는다** — Phase 0~4 어떤 작업에서도 해당 레포를 건드리지 않는다.

이로써 이 프로젝트의 **설계 단계는 종료**되고 구현 단계로 넘어간다. 아래 22.1/22.2는 과거 기록으로만 남긴다(전부 해소됨 또는 의도적 연기).

### 22.1 (해소됨) 과거 "지금 결정 필요" 목록

~~1. 개발용 Postgres 인스턴스 선택~~ → §22.0-1에서 확정
~~2. 사주 Shared Package 추출 일정~~ → §22.0-2에서 "Phase 5까지 착수하지 않음"으로 확정(일정 자체가 Phase 5 시작 시점으로 고정됨)

### 22.2 의도적으로 나중으로 미룬 항목 (지금 결정 불필요 — 예정된 시점에 재논의)

1. **결제 Provider 선정** — Phase 3 착수 시점에 결정하기로 이미 확정됨(§16.3). 그 전까지는 `PaymentGateway` interface + mock으로 개발·테스트 진행
2. **프로덕션 호스팅 플랜/Postgres 벤더**(구체적으로 어느 플랜) — 실결제 공개배포 직전에 결정하기로 이미 확정됨(§5.4)

**이전 개정들에서 완전히 해소된 것**: DB 클라이언트(Prisma), 개발용 DB(로컬 Docker), 스크린샷 고지 문구(확정 텍스트 반영), PG 영수증 조회(미구현 확정), 사주 재사용 범위·착수 시점(Phase 5로 확정, 그 전까지 HEYDAY STAR 코드 무변경), Funnel 도구(GA4 확정), Preview chunk 선택(최근 충분한 구간으로 확정), Preview Narrative 방식(템플릿 확정), Signal intensity(MVP 미도입 확정).

---

## 23. Phase 0 구현 기록

**착수일**: 2026-09-12 · **브랜치**: `feat/v2-phase0-stabilize` (base: `main`@`dd6061a`, 보호 태그: `v1-stable`)

### 23.1 안전조치
- `git status` 확인 결과 미커밋 변경사항 없음(추적되지 않는 `docs/`, `.github/`만 존재)
- `v1-stable` 태그를 `dd6061a`(직전 커밋)에 생성
- `feat/v2-phase0-stabilize` 브랜치 생성, `main`은 무변경으로 보존

### 23.2 완료된 작업
- Postgres(로컬 Docker) + Prisma 개발환경 — `docker-compose.yml`, `server/db/prisma/schema.prisma`(DeviceQuota/AnalysisUsageLog만, Phase 1 엔진 스키마 제외), `prisma.config.ts`(Prisma 7 신규 설정 방식)
- Repository foundation — `server/db/repositories/{quotaRepository,usageLogRepository}.ts`: Postgres 우선, 연결 실패 시 파일 기반 저장으로 폴백 *(이 정책은 Phase 0.5에서 §5.3.1의 명시적 정책으로 교체됨 — 아래 23.5 참조)*
- `server/quota.js`: 저장 계층만 교체(비동기화), 쿼터 정책 로직 자체는 무변경
- 개인정보 고지 문구를 확정 텍스트로 교체(`PrivacyBadge.jsx`)
- `nameMap` 서버 전송 제거 — `anonymize.js`가 전송 직전 `scrubResultNames`(본문 내 실명)와 신규 `redactContactInfo`(전화번호/이메일)를 적용
- Screenshot 원본: 처리 후 참조 명시적 해제(`content = null`), 디스크/로그 미기록 유지
- 모바일 스크린샷 순서 변경 — 터치용 ▲▼ 버튼 추가(`ScreenshotImportPanel.jsx`)
- `server/analyze.js`, `server/ocrScreenshots.js`: `output_config.format`(zod) 구조화 출력 적용, 레거시 정규식 파싱은 안전망으로만 유지
- 사용량/비용 로깅 — 두 LLM 호출 지점에 `response.usage` 기록 배관 연결(Postgres 우선, 파일 폴백)
- `og-image.png` 신규 생성(1200×630, 그라디언트 placeholder — 디자인 자산 아님, §23.4 참조)
- `server/index.js`의 죽은 에러 미들웨어(구 30-38줄) 제거
- TypeScript 설정 — `tsconfig.json`(`allowJs`+`checkJs:false`, `server/**` 한정), `tsx`로 서버 실행 전환. 파서 3종은 무변경

### 23.3 실측으로 발견·수정한 실이슈 (설계 문서에는 없던 것)
1. **Zod 스키마의 optional 필드 48개 → API가 24개 초과 거부**(`400 Schemas contains too many optional parameters`). 필드를 대부분 required로 변경해 해결.
2. **`max_tokens: 4096`이 실제로 구조화 출력 JSON을 중간에 자름**(`Unterminated string in JSON`) — analysis_v1.md가 이론적으로 지적했던 위험이 실측에서 재현됨. `8192`로 상향 + `messages.parse()` 실패 시 레거시 `messages.create()`+정규식으로 재시도하는 안전망 추가로 해결. 수정 후 동일 입력으로 성공 확인(§23.4).

### 23.4 검증 결과 — 별도 최종 보고 참조
lint/test/build 결과, 회귀 확인 내역, 미해결 문제는 이 턴의 최종 사용자 보고에 상세 기재했다(문서 중복을 피하기 위해 여기서는 요약만 유지).

### 23.5 Phase 0.5 — 조건부 승인 후속 작업

Phase 0 조건부 승인에 따라 다음 6개 작업을 추가로 완료했다.

1. **Postgres 실제 CRUD 검증 준비** — `prisma migrate diff --from-empty`로 오프라인 생성한 초기 마이그레이션(`server/db/prisma/migrations/20260912000000_init/`), `npm run db:verify`(migrate deploy + synthetic CRUD), `server/db/postgresCrud.integration.test.ts`(DATABASE_URL 없으면 자동 skip). Docker가 없는 이 샌드박스에서는 실행 자체는 못 했고 스크립트/테스트만 준비됨 — 실제 실행은 사용자 환경에서 필요(§ 최종 보고 "실제 PostgreSQL 검증에 필요한 정확한 실행 명령" 참조)
2. **DB 폴백 정책 전면 수정** — §5.3.1에 정책 확정. `server/db/fallbackPolicy.ts`(`withFallbackPolicy`, `DatabaseUnavailableError`), `quotaRepository.ts`/`usageLogRepository.ts` 양쪽이 이를 사용하도록 교체, `server/index.js`가 이 에러를 503으로 변환. 3가지 시나리오(dev+플래그on/off, production) 전부 실제 서버 기동으로 라이브 검증함
3. **CORS allowlist** — `server/corsConfig.ts`. 라이브 검증: 동일출처(헤더 없음)→허용, 허용 오리진→헤더 포함, 비허용 오리진→헤더 없이 200(브라우저가 차단)
4. **Screenshot 모바일 리오더 컴포넌트 테스트** — `src/components/ScreenshotImportPanel.test.jsx`(React Testing Library + jsdom, ▲▼ 실제 클릭으로 순서 변경 + 경계 비활성화 검증)
5. **v1 `max_tokens: 8192`의 비상속 원칙** — §8.3에 명시
6. **v1 구조화출력 레거시 폴백의 비상속 원칙** — §8.3에 명시

이번 작업으로 새로 추가된 devDependency: `@testing-library/react`, `jsdom`. 새 npm script: `db:migrate:deploy`, `db:verify`.

---

## 24. Phase 1 구현 기록

**착수일**: 2026-09-13 · **브랜치**: `feat/v2-phase1-relationship-engine` (base: `feat/v2-phase0-stabilize`@`afe9dca`, 태그: `v2-phase0-complete`)

### 24.1 범위

§20 Phase 1(Core Engine)의 작업 목록을 그대로 구현했다: Standard Message Model 어댑터, Code Feature Extractor, LLM Signal Extractor, Evidence Validator, Score Engine(Opportunity Rate + Saturation 기반 Core4/Temperature/Romance). 전부 `server/engine/**` 아래 신규 코드이며, 기존 파일 중 실제로 수정한 것은 `package.json`(`typecheck` 스크립트 추가)뿐이다. `analyzeLocal.js`/`deepAnalysisLocal.js`는 **삭제하지 않았다** — §20 작업 목록의 "레거시 파일 폐기" 문구와 달리, 이 둘은 아직 v1 UI(`App.jsx`의 1차 로컬 점수 미리보기, API 실패 폴백)가 실제로 참조하는 살아있는 경로이고, 새 엔진은 아직 어떤 라우트에도 연결되지 않았다(라우트 연결은 Phase 2 `previewPipeline.ts`의 일). 지금 지우면 기존 기능이 대체 없이 깨지므로, 삭제는 Phase 2에서 새 엔진이 실제로 그 자리를 대신할 때로 미뤘다 — "Phase 2 이후에는 들어가지 마라"는 이번 턴의 지시와도 일치하는 판단이다.

### 24.2 설계 문서와 다르게 구현한 부분 (실측/실험으로 확인된 것)

1. **§5.1의 `declare module '*/parseChat.js'` 앰비언트 타입 경계는 실제로 동작하지 않는다.** `tsc --noEmit`으로 직접 확인: relative import(`'../../../src/utils/parseChat.js'`)는 `allowJs`가 켜져 있으면 실제 `.js` 파일로 먼저 해석되고, 와일드카드 앰비언트 모듈 선언은 무시된다(에러: "has no exported member named 'RawParsedMessage'"). 대신 `server/engine/messageModel/parseChatShim.ts`에서 `parseMessages`/`getConversationMeta`를 import한 뒤 `as unknown as <T>`로 캐스팅해 타입을 부여하는 방식으로 교체했다 — 경계 지점은 §5.1의 의도(파서 진입부 한 곳으로 봉쇄)와 동일하게 유지된다.
2. **§10.2의 `no-restricted-imports` oxlint override는 동작하지 않는다.** oxlint 1.69의 설정 스키마 자체가 이 규칙을 `DummyRule`로 등록해 두었다 — 실제로 `server/engine/score/`에 `@anthropic-ai/sdk` import를 넣고 override 설정으로 lint를 돌려봤지만 아무 진단도 나오지 않았다(직접 확인함). 대신 `server/engine/importBoundary.test.ts`가 `score/**`, `features/**`의 모든 `.ts` 소스를 문자열 검사해 같은 것을 강제한다 — `npm test`에 포함되어 항상 실행된다.
3. **Initiative는 LLM Signal 없이 순수 코드로만 계산한다.** PRD §8.2/§9.5는 Initiative에 "새 화제 제시/약속 제안/대화 확장" 같은 LLM 시그널도 기여한다고 적었지만, Evidence Model(PRD §13)의 `category` enum에는 애초에 `interest/intimacy/reciprocity/romance/distancing` 5종만 있고 "initiative"는 없다. 새 카테고리를 만들지 않고, Initiative는 `turnInitiationCounts`(대화 시작/재개 코드 카운트)만으로 계산했다 — PRD가 흔들리는 지점(카테고리 스키마 vs Initiative 입력표)을 스키마 쪽을 기준으로 해소한 것이다. Phase 2/3에서 실제 데이터로 부족하다고 판단되면 카테고리를 늘리는 결정이 필요하다(**남은 결정 사항**으로 아래 §24.4에 기록).

### 24.3 완료조건 검증 결과 (§20 Phase 1)

1. **Invariant Fixture** — `server/engine/score/scoreEngine.invariant.test.ts`에 17개 테스트(요구한 12~20개 범위 안). 길이 불변성·saturation(농도 검증 포함)·rate-vs-count 3종 필수 항목 전부 포함. 전부 통과.
2. **Evidence Validator 단위 테스트** — `server/engine/signals/evidenceValidator.test.ts`(9개), 전부 통과.
3. **`@anthropic-ai/sdk` import 금지** — 위 24.2-2 참조. `server/engine/importBoundary.test.ts`로 강제, 통과.
4. **Signal Extraction 스키마에 숫자 필드 없음** — `server/engine/signals/schema.test.ts`가 zod 스키마 내부(`_def.type`)를 재귀적으로 순회해 `number` 타입이 하나도 없음을 확인. `strength` 필드 자체가 스키마에 없음(§13 RelationshipSignal 타입에도 없음).

`npm test`(vitest) 88 passed / 2 skipped, `npm run typecheck`(신규 스크립트, `tsc --noEmit`) 0 errors, `npm run lint`(oxlint) Phase 1 코드에서 경고 0건(기존 파일의 사전 존재 경고 7건은 무변경), `npm run build`(vite) 정상.

### 24.4 남은 결정 사항 (Phase 2 착수 전 확인 필요)

1. **Initiative의 LLM 시그널 기여 여부** — 24.2-3 참조. 현재는 코드 전용. PRD의 원래 의도(새 화제 제시 등)를 살리려면 Evidence Model에 6번째 category를 추가하거나, 기존 `interest` 카테고리의 signalType 중 일부를 Initiative 계산에도 재사용하는 설계가 필요하다 — Phase 2에서 Preview UX를 붙이기 전에 결정.
2. **Reciprocity의 정확한 수식** — PRD §8.4의 `Balance × EvidenceCoverage × InteractionQuality`를 `Balance × rawAvg`(opportunity-rate 점수 평균)로 단순화했다(PRD 스스로 "세부 수식은 실제 데이터 테스트 후 보정"이라 명시한 부분). 실제 대화 데이터로 보정 필요.
3. **InteractionEnergy 공식** — PRD §9.3이 후보만 나열하고 공식을 정하지 않은 부분을 `참여 균형 0.6 + 세션 다양성 0.4`로 1차 구현했다(`temperature.ts`). 튜닝 대상.
4. **Weight 값(weights.ts) 전체** — 코드 고정값이지만 전부 제품 휴리스틱이며 실측 데이터 없음. §19.2 invariant test는 "방향성"만 검증하고 정확한 숫자를 검증하지 않는다.

> **후속 갱신**: 위 1~4 중 2번(Reciprocity 수식)은 Phase 1.1/1.2에서 완전히 재설계됐고(pair 기반, §25.3), 3번(InteractionEnergy)도 Phase 1.2에서 공식이 교체됐다(§25.4). 1번(Initiative)과 4번(Weight 값)은 Phase 1.2 시점에도 여전히 열려 있는 문제다.

---

## 25. Phase 1.1 / 1.2 — Score Calibration & Missing Evidence 최종 구현 기준

**이 섹션이 §9/§12/§14보다 우선한다.** 아래는 실제 코드(`server/engine/score/**`, `server/engine/signals/**`)를 기준으로 작성했다. §9/§12/§14는 최초 설계 스케치로만 남겨두고 위쪽에 개별적으로 stale 표시를 해두었다.

### 25.0 두 차례의 재감사로 무엇이 바뀌었는가

- **Phase 1.1(Score Calibration)**: (1) saturation 함수가 rate=1에서도 weight의 100%에 도달하지 못하던 문제를 정규화로 수정, (2) opportunity floor(5)를 제거해 데이터가 적다는 이유만으로 점수 자체를 낮추지 않게 함(대신 confidence 분리), (3) Reciprocity를 "독립적인 두 rate + balance 배율" 방식에서 실제 trigger/response pair 추적 방식으로 재설계, (4) Initiative를 `conversationInitiationRatio`로 개명, (5) InteractionEnergy에서 세션 수 항을 제거.
- **Phase 1.2(Missing Evidence & Calibration)**: (1) `score: number` 였던 모든 지표를 `score: number | null`로 바꿔 "opportunity 자체가 부족해 판단 불가"(null)와 "opportunity는 있었는데 관찰되지 않음"(실제 0)을 구분, (2) confidence 계산에서 evidenceCount(관찰된 개수)를 완전히 제거 — confidence는 오직 "얼마나 판단할 기회가 있었는가"만 본다, (3) Reciprocity의 한쪽 방향이 판단 불가일 때 그 방향과 overall을 모두 null로 만듦(억지 0 금지), (4) Relationship Temperature가 null인 구성요소를 0으로 취급하지 않고 남은 가중치로 재정규화, 커버리지가 너무 낮으면 Temperature 자체를 null로 반환, (5) `topic_expansion` pairType을 Reciprocity 점수 계산에서 제외(추출·Evidence 보존은 유지).
- **Phase 1.3(Reciprocity Pair-Type Coverage Audit)**: Phase 1.2가 놓친 잔여 버그 하나를 수정. Directional Reciprocity가 opportunity=0인 pairType까지 weight denominator에 포함시키고 있어서, question_response 하나만 opportunity가 있고 나머지 4종은 opportunity=0인 대화가 100% 응답해도 점수가 34점(question_response의 weight share) 근방에 묶였다 — "관찰 불가능했던 차원"이 "관찰됐는데 실패함"처럼 취급된 것이다. opportunity=0 pairType을 분자·분모 양쪽에서 완전히 제외하도록 수정했고, directional confidence도 단순 평균 대신 `totalOpportunity`(관찰 가능했던 pairType들의 opportunity 합)와 `pairTypeCoverage`(관찰 가능했던 weight 비중)라는 두 축으로 재설계했다 — §25.3 참고.

### 25.1 Metric Result 타입

```ts
// server/engine/score/types.ts
export type Confidence = 'insufficient' | 'low' | 'medium' | 'high'

export interface IndividualScore {
  score: number | null   // null = opportunity 자체가 판단하기에 부족했음
  confidence: Confidence // 'insufficient' ⇔ score === null, 항상 함께 움직인다
}
```

`score`와 `confidence`는 완전히 분리된 계산 경로를 갖는다 — confidence가 score에 곱해지는 지점은 코드 어디에도 없다.

### 25.2 Confidence 최종 규칙

```ts
// server/engine/score/confidence.ts
const MIN_JUDGEABLE_OPPORTUNITY = 5   // 이 미만이면 score=null, confidence='insufficient'
const HIGH_OPPORTUNITY = 15
const HIGH_MESSAGE_COUNT = 40
const HIGH_SESSION_COUNT = 2

function computeConfidence({ opportunity, messageCount, sessionCount }): Confidence {
  if (opportunity < MIN_JUDGEABLE_OPPORTUNITY) return 'insufficient'
  const strong = opportunity >= HIGH_OPPORTUNITY && messageCount >= HIGH_MESSAGE_COUNT && sessionCount >= HIGH_SESSION_COUNT
  if (strong) return 'high'
  const medium = opportunity >= HIGH_OPPORTUNITY || (messageCount >= HIGH_MESSAGE_COUNT && sessionCount >= HIGH_SESSION_COUNT)
  return medium ? 'medium' : 'low'
}
```

`evidenceCount`(관찰된 signal/pair 개수)는 입력 파라미터에 아예 없다 — signal이 0개여도 opportunity·message·session이 충분하면 `medium`/`high`가 나올 수 있다. `MIN_JUDGEABLE_OPPORTUNITY=5`는 Phase 1이 쓰던 rate floor(5)와 같은 숫자를 재사용했지만 용도가 다르다: 이제는 rate 계산을 왜곡하지 않고(`rateFor`는 `max(opportunity,1)`만 씀), "점수를 보고할지 말지"만 결정한다.

### 25.3 Reciprocity 최종 설계 — 5개 Pair + weight

```ts
// server/engine/signals/reciprocityTypes.ts
type ReciprocityPairType =
  'question_response' | 'mutual_disclosure' | 'emotional_empathy'
  | 'joke_reciprocation' | 'plan_response' | 'topic_expansion'   // 6종 추출

interface ReciprocityPair {
  pairType: ReciprocityPairType
  initiatorSpeakerId: string
  responderSpeakerId: string
  triggerMessageIds: string[]
  responseMessageIds: string[]
  reason: string
}
```

Evidence Validator가 messageId 존재, `initiator≠responder`, 시간순서(모든 response index > 모든 trigger index), 인접범위(gap≤20메시지 & 동일 세션)를 검증한다.

**점수 계산 대상은 5개 pairType뿐**(`topic_expansion` 제외, Phase 1.2 §25.0):

| pairType | weight | opportunity(trigger) |
|---|---:|---|
| question_response | 34 | initiator의 `?` 포함 메시지 수 |
| mutual_disclosure | 22 | initiator의 `self_disclosure` intimacy 시그널 수 |
| emotional_empathy | 22 | initiator의 `vulnerable_emotion_share` intimacy 시그널 수 |
| joke_reciprocation | 11 | initiator의 `playful_teasing_or_nickname` intimacy 시그널 수 |
| plan_response | 11 | initiator의 plan-proposal 정규식 매칭 메시지 수 |

(`topic_expansion`은 계속 추출·검증되어 Evidence로는 남지만, opportunity 정의가 없어 — initiator 전체 메시지 수를 쓰는 건 개념적으로 틀림 — 점수 weight에서는 제외했다. 전용 "새 화제 도입" 시그널이 생기면 재도입 예정, `weights.ts`의 TODO 참고.)

최종 수식 (Phase 1.3 — Pair-Type Coverage Audit로 갱신):

**[Phase 1.3에서 발견·수정된 버그]** 이전 구현은 opportunity=0인 pairType도 weight denominator에 그대로 포함시켰다. 그 결과 question_response(weight 34)만 opportunity가 있고 나머지 4종이 전부 opportunity=0인 대화에서, question_response에 100% 응답해도 점수가 34점 근방에 묶였다 — 관찰이 애초에 불가능했던 4개 차원이 "관찰됐는데 실패함"처럼 취급된 것. 지금은 opportunity=0인 pairType을 분자·분모 양쪽에서 완전히 제외한다.

```
방향별(initiator, responder 고정):
  availablePairs = { cfg ∈ RECIPROCITY_PAIR_CONFIG(5종) | computePairOpportunity(cfg.pairType, initiator) > 0 }

  if availablePairs가 비어있음 (전부 opportunity=0):
    → { score: null, confidence: 'insufficient' }   // 판단 근거 자체가 없음

  else:
    total = Σ_{cfg ∈ availablePairs} saturatedContribution(rateFor(count_cfg, opportunity_cfg), cfg.weight)
    availableWeightSum = Σ_{cfg ∈ availablePairs} cfg.weight
    score = round(total / availableWeightSum × 100)

    totalOpportunity = Σ_{cfg ∈ availablePairs} opportunity_cfg
    pairTypeCoverage = availableWeightSum / 100   // 5종 전체 weight 대비 "관찰 가능했던" 비중
    confidence = computeDirectionalConfidence({ totalOpportunity, pairTypeCoverage, messageCount, sessionCount })

overall:
  if (방향A.score === null || 방향B.score === null) → { score: null, confidence: 'insufficient' }
  else → { score: round(harmonicMean(방향A.score, 방향B.score)), confidence: weaker(방향A.conf, 방향B.conf) }
```

`computeDirectionalConfidence`(신규, `score/reciprocity.ts`):

```ts
const HIGH_PAIRTYPE_COVERAGE = 0.5   // 전체 weight의 절반 이상을 커버해야 "넓다"고 봄

function computeDirectionalConfidence({ totalOpportunity, pairTypeCoverage, messageCount, sessionCount }): Confidence {
  const broadCoverage = pairTypeCoverage >= HIGH_PAIRTYPE_COVERAGE
  const strong = broadCoverage && totalOpportunity >= HIGH_OPPORTUNITY && messageCount >= HIGH_MESSAGE_COUNT && sessionCount >= HIGH_SESSION_COUNT
  if (strong) return 'high'
  const medium = totalOpportunity >= HIGH_OPPORTUNITY || (messageCount >= HIGH_MESSAGE_COUNT && sessionCount >= HIGH_SESSION_COUNT)
  return medium ? 'medium' : 'low'
}
```

`HIGH_OPPORTUNITY`/`HIGH_MESSAGE_COUNT`/`HIGH_SESSION_COUNT`는 `score/confidence.ts`가 export하는 값(15/40/2)을 그대로 재사용한다 — 일반 Confidence와 다른 임계값 집합을 새로 만들지 않았다.

세 가지가 타입/공식 레벨에서 구분된다:
- **`opportunity=0`(그 pairType은 애초에 관찰 불가)** → 분자·분모 모두에서 제외. 전체 5종이 다 이러면 방향 자체가 `null`/`'insufficient'`.
- **`opportunity>0`인데 관찰된 pair가 0개** → 분모에는 포함되고 분자에 0을 기여 — 진짜 "낮은 점수"로 반영(예: question_response만 100% 응답해도 mutual_disclosure가 opportunity는 있는데 무반응이면 100점이 아니라 그보다 낮게 나온다).
- **좁은 커버리지(pairType 1~2개만 관찰 가능)** → 점수는 정상 계산되지만(0~100 스케일 그대로 사용), confidence는 `'medium'`을 넘지 못한다 — opportunity 총량이 아무리 많아도 마찬가지.

### 25.4 Relationship Temperature — Missing-Metric 처리

```
components = [
  { score: mutualInterest,   weight: 0.40 },   // 한쪽이라도 null이면 mutualInterest는 null
  { score: mutualIntimacy,   weight: 0.25 },   // 위와 동일 원리
  { score: reciprocity,      weight: 0.25 },   // §25.3의 overall
  { score: interactionEnergy, weight: 0.10 },  // 아래 참고
]
available = components.filter(c => c.score !== null)
availableWeight = Σ available.weight

if (availableWeight < 0.5) return { score: null, confidence: 'insufficient' }   // MIN_TEMPERATURE_WEIGHT_COVERAGE = 0.5

temperature = round(Σ available(score × weight) / availableWeight)
confidence = available.confidence 중 가장 약한 것
```

`mutualInterest`/`mutualIntimacy`는 `harmonicMean(A,B)`인데, A 또는 B 중 하나라도 null이면 결과도 null(0으로 취급하지 않음) — 실제 0(둘 다 판단 가능했고 관찰된 게 0인 경우)은 여전히 harmonicMean이 정상적으로 0을 반환한다.

**InteractionEnergy 최종 공식** (`temperature.ts`, 절대 `sessionCount × 5` 방식 아님):

```
ParticipationBalance = clamp(2·min(countA,countB)/(countA+countB), 0, 1)
TurnTakingRate = (인접 메시지 쌍 중 화자가 바뀐 비율)   // features/codeFeatureExtractor.ts의 turnAlternationRate, 길이 무관
opportunity(IE) = countA + countB (전체 메시지 수) → 5 미만이면 IE도 null
IE = round(clamp((ParticipationBalance×0.5 + TurnTakingRate×0.5) × 100, 0, 100))
```

### 25.5 남은 문제 (Phase 2 전)

1. `topic_expansion`의 opportunity를 대체할 전용 LLM 시그널이 아직 없음.
2. `question_response`/`plan_response`의 opportunity가 여전히 정규식 코드 proxy(LLM 검증 아님).
3. Confidence 임계값(5/15/40/2)과 Temperature 커버리지 임계값(0.5)이 튜닝되지 않음.
4. Initiative(`conversationInitiationRatio`)는 여전히 코드 전용 — LLM 시그널 기여 여부 미정.
5. Reciprocity 결합 공식(harmonicMean)은 이번에 새로 도입되어 실증 근거 없음.

### 25.6 Calibration Scenario Fixture (§19.2 보강)

`server/engine/score/calibrationScenarios.test.ts`에 5개 synthetic 관계 시나리오(양쪽 적극적/일방형/친구형/데이터 부족/opportunity는 충분하나 무반응)를 추가했다. 정확한 점수를 하드코딩하지 않고 순서 관계만 검증한다(예: 양쪽 적극적 시나리오의 Reciprocity/Temperature가 일방형 시나리오보다 높아야 함, 데이터 부족 시나리오는 낮은 점수가 아니라 `null`/`insufficient`여야 함).

---

## 26. Phase 2 Preview 성능 메모 (구현 전 기록만)

Phase 1.2 감사 중 실제 Anthropic API로 80-message 샘플을 1회 호출(단일 chunk로 강제)해 측정한 결과:

- **약 52.7초, 약 $0.067** (model: `claude-sonnet-4-6`, input 5,699 / output 3,325 tokens)

이 수치는 **Free Preview에 그대로 쓸 수 없다** — Preview는 사용자가 결제 전에 기다리는 화면이고, Paid Deep과 같은 설정(같은 모델, 같은 청크 크기, 같은 프롬프트 분량)을 그대로 쓰면 무료 사용자 1명에게 $0.067·52초를 쓰는 셈이 되어 §16(2-Stage Compute)의 원래 취지("Preview는 비용 상한을 강하게 둔다")와 어긋난다.

**Phase 2에서 별도로 검증해야 할 것** (지금은 구현하지 않음, 기록만):

1. **최근 40~60 메시지만** 분석 대상으로 삼는 `selectPreviewWindow()`(§13.2)의 실제 latency/cost 재측정 — 80개가 아니라 40~60개 기준으로 다시 벤치마크.
2. **Preview 전용 모델**을 별도 환경변수로 설정 가능하게(예: `ANTHROPIC_PREVIEW_MODEL` — 현재 `ANTHROPIC_MODEL`은 Paid/legacy 경로와 공유) — 더 저렴한 모델(예: haiku 계열)로 Preview 품질이 허용 가능한지 실측 필요.
3. **더 짧은 structured output**을 Preview 전용으로 설계 — 지금의 Signal Extraction 스키마(청크당 최대 60 signals + 40 pairs)는 Paid Deep 기준이며, Preview는 더 적은 `maxItems`로 별도 스키마를 둘 수 있는지 검토.
4. Preview 경로의 latency/cost를 실측해 **Paid Deep과 별도로 벤치마크 문서화**.

**설계 원칙(지금 확정, 코드는 Phase 2에서)**: `llmSignalExtractor.ts`의 `LlmSignalExtractorOptions.model`/`maxOutputTokens`는 이미 호출부가 오버라이드할 수 있는 구조다 — Phase 2의 Preview 파이프라인은 이 옵션을 통해 Paid Deep과 **다른 model/token budget을 환경설정으로 분리**해서 넘기면 된다(새 인터페이스 설계 불필요, 기존 옵션을 다른 값으로 호출하기만 하면 됨). 단, 그 "다른 값"이 실제로 무엇이어야 하는지(모델명, 토큰 budget, 청크 크기)는 위 1~4번 실측 없이는 정할 수 없다.

---

## 27. Phase 2 구현 기록

**착수일**: 2026-09-13 · **브랜치**: `feat/v2-phase2-free-preview` (base: `feat/v2-phase1-relationship-engine`, 태그: `v2-phase1-complete`)

### 27.1 범위

§20 Phase 2의 작업 목록을 구현했다: Intent 선택 UI, `selectPreviewWindow()`(§13.2), Stage1 파이프라인(`previewPipeline.ts`, `PreviewScoreResult` 명명), `previewNarrative.ts`(코드 템플릿), Paywall UI(1차 — 잠금 안내만, 실제 결제는 Phase 3), Preview 전용 Usage 로깅. 이번 턴의 지시("Phase 3 결제/Paid Deep, Trend/Turning Point, 사주에는 들어가지 마라")에 따라 그 세 영역은 건드리지 않았다.

신규 파일:
- `server/engine/intent/types.ts`, `shared/intentOptions.js` — `AnalysisIntent` (PRD §4)
- `server/engine/pipeline/{types,analysisMode,chunkPlan,topSignal,previewPipeline}.ts` — Stage1 오케스트레이션
- `server/engine/narrative/previewNarrative.ts` — §15.4 코드 템플릿
- `server/db/repositories/analysisResultRepository.ts` + `AnalysisResult` Prisma 모델/마이그레이션(`20260913000000_phase2_analysis_result`) — §6.5 Preview TTL(24h) 저장
- `server/previewAnalyze.ts`, `server/index.js`의 `POST /api/preview` — 라우트 계층
- `src/components/{IntentStep,PreviewResultStep}.jsx`, `src/utils/previewApi.js` — 프론트엔드
- `src/App.jsx` — 기존 로컬 휴리스틱(`analyzeLocal.js`) 기반 제출 흐름을 새 엔진 호출로 교체

### 27.2 설계 문서와 다르게 구현/보강한 부분

1. **`PreviewScoreResult`는 §12.4의 스케치보다 풍부하다.** §12.4는 `recentConversationTemperature: number`처럼 평평한 숫자로 스케치했는데, 이는 Phase 1.2의 Missing-Evidence 재설계(§25) 이전 버전이다. Phase 1.2 이후 모든 지표는 `score: number | null` + 독립적인 `confidence`를 갖는 `IndividualScore`이므로, 그대로 평평하게 만들면 "판단 불가"(null)와 "관찰했지만 0"이라는 §25의 핵심 구분이 Preview 응답에서 사라진다. `server/engine/pipeline/types.ts`는 그 구분을 보존하도록 `IndividualScore`/`RomanceResult`/`Core4Result` 원본 타입을 그대로 감싸는 방식으로 설계했다.
2. **Preview 전용 `maxOutputTokens`를 도입하지 않았다 — 오히려 실측으로 위험성을 확인했다.** §26은 "Preview는 더 저렴한/짧은 설정을 써야 한다"고 제안했지만, 정확한 숫자는 실측 필요라고 명시했다. 처음에는 `2048`을 추정치로 넣었는데, `samples/01-romantic-some.txt`(32줄, 청크 1개) 기준 실제 Anthropic API 호출로 검증한 결과 **구조화 출력 JSON이 중간에 잘리는 문제**(`Unterminated string in JSON`)가 재현됐다 — analysis_v1.md/§23.3이 v1의 `max_tokens: 4096`에서 지적했던 것과 정확히 같은 실패 모드가, 그보다 더 낮은 상한에서 다시 나타난 것이다. 이 실패는 조용히 "Signal 0개"로 처리되므로(§8.3의 의도된 동작) 실제로 점수가 전부 0/판단불가로 나오기 전까지는 겉으로 드러나지 않았다. 최종적으로 `maxOutputTokens`는 **명시적으로 설정하지 않음**(`llmSignalExtractor.ts` 자신의 측정된 기본값 4096을 그대로 물려받음)으로 확정했고, `ANTHROPIC_PREVIEW_MAX_OUTPUT_TOKENS` 환경변수로만 나중에 실측된 값을 넣을 수 있게 남겨뒀다. §26의 1~4번 실측 항목은 여전히 미해결로 남는다.
3. **Preview 전용 Usage 로깅은 §17.1의 `analysisId` 키 스키마로 이전하지 않고, Phase 0의 단순 per-call 로그(`AnalysisUsageLog`, `callSite` 문자열 컬럼)에 `callSite: "relationship_preview"`를 추가하는 방식으로 구현했다.** §17.1의 스키마(`previewCost`/`paidCost`/`reportType`/`converted`를 한 행에 같이 두는 구조)는 Paid Deep이 실제로 존재해야 의미가 있다 — 지금 마이그레이션하면 `paidInputTokens` 등 컬럼이 영구히 null인 채로 남는다. Phase 3에서 결제/Paid Deep이 실제로 붙을 때 이 스키마 전환을 함께 하는 것으로 미룬다(`usageLogRepository.ts`의 `UsageLogEntry.callSite` 타입 주석에 기록).
4. **Intent → topSignal 우선순위(`topSignal.ts`)는 이번 턴에 새로 설계한 매핑이다.** PRD §4는 "Intent가 결과 우선순위를 바꾼다"는 원칙만 정의하고 구체적인 매핑은 정의하지 않았다. `INTENT_CATEGORY_PRIORITY`는 각 Intent가 어떤 `SignalCategory`(interest/intimacy/romance/distancing)를 먼저 찾는지의 1차 초안이며, 실사용 데이터로 보정이 필요한 튜닝 대상이다(다른 가중치 상수들과 같은 성격).
5. **`windowLabel`의 구체적인 구간 라벨(며칠/1주/2주/한 달 등) 임계값은 §13.2에 없던 값이라 이번에 새로 정의했다** (`server/engine/pipeline/chunkPlan.ts`) — MIN/MAX_PREVIEW_MESSAGES(40/120)와 같은 성격의 튜닝 가능한 placeholder.
6. **`shared/intentOptions.js`를 `server/engine/intent/types.ts`가 import한다 — §5.1이 "JS/TS 경계는 정확히 하나(parseChatShim.ts)"라고 못박은 것의 두 번째 예외다.** Intent 값은 프론트엔드·라우트·엔진이 동일하게 알아야 하는 순수 데이터(로직 없음)라서, 손으로 따로 타이핑하면 두 곳의 값이 조용히 어긋날 수 있는 위험이 생긴다. `server/engine/intent/types.ts`의 주석에 이 예외를 기록해뒀다.

### 27.3 완료조건 검증 결과 (§20 Phase 2)

실제 Anthropic API 키로 `samples/01-romantic-some.txt`를 `POST /api/preview`에 라이브로 전송해 검증했다(mock이 아님):

1. **Preview 단계 LLM 호출이 정확히 1회** — `server/engine/pipeline/previewPipeline.test.ts`의 mock 기반 테스트로 확인, 라이브 호출에서도 32줄 대화가 청크 1개(=extractor 호출 1회)로 처리됨을 확인.
2. **모든 Preview Narrative 문구에 windowLabel이 포함됨** — `server/engine/narrative/previewNarrative.test.ts`가 3×3 버킷 조합 + insufficient 케이스 전부에서 `windowLabel` 포함 여부를 스냅샷 형태로 검증(9+1개 케이스 전부 통과). 라이브 응답에서도 `firstVerdict`/`summaryOneLine`에 실제로 포함됨을 확인.
3. **Intent만 바꿔도 Core4/Temperature 숫자는 동일함** — `previewPipeline.test.ts`가 같은 입력에 `romantic_interest`/`friendship_change` 두 Intent로 각각 실행해 `recentConversationTemperature`/`core4Preview`/`recentRomanceSignal`이 완전히 동일함(`toEqual`)을, 반면 `topSignal.category`는 Intent에 따라 달라짐(romance vs interest)을 함께 검증했다.
4. **Preview 결과가 24시간 뒤 조회 불가능함** — `analysisResultRepository.test.ts`가 `previewExpiresAt`를 과거로 조작한 레코드에 대해 `findById()`가 `null`을 반환함을 확인(물리적 삭제 여부와 무관하게 읽기 경로에서부터 차단, 파일 헤더 주석 참고). Postgres 없는 이 샌드박스에서는 파일 폴백 경로로 검증했고, Prisma 경로는 `findById()`가 동일한 `isExpired()` 체크를 공유하므로 로직상 동일하다(실제 Postgres 통합 검증은 `postgresCrud.integration.test.ts`처럼 사용자 환경에서 `DATABASE_URL`이 살아있을 때 필요 — §23.5와 동일한 제약).

`npm test`(vitest) 168 passed / 2 skipped, `npm run typecheck` 0 errors, `npm run lint`(oxlint) 신규 경고 0건(기존 7건 무변경), `npm run build`(vite) 정상 — 오히려 번들 모듈 수가 60→43개로 줄었다(로컬 휴리스틱 폴백 청크가 메인 제출 흐름에서 더 이상 즉시 로드되지 않게 됨).

### 27.4 의도적으로 남겨둔 것 (Phase 3 이전 결정 필요)

1. **`src/utils/analyzeLocal.js`/`deepAnalysisLocal.js`, `src/components/ResultStep.jsx`(및 그 하위 — `AffectionTrendChart`/`CriticalMomentBubbles`/`DeepMetricsPanel`/`ResultShareActions`)는 삭제하지 않았다.** `App.jsx`의 제출 흐름은 이제 이 파일들을 참조하지 않지만(빌드 결과 확인됨), 파일 자체는 남아 있다 — §24.1이 예고했던 "새 엔진이 실제로 그 자리를 대신하면 삭제"의 시점이 이번이 맞지만, 이번 턴 지시("Phase 2만 구현하고 Phase 3 이후에는 들어가지 마라")의 안전한 해석은 진짜 삭제(대규모 파일 제거 + 회귀 위험)보다 "새 경로로 교체하되 기존 파일은 다음 정리 턴에 맡긴다"라고 판단했다. `server/analyze.js`와 `/api/analyze` 라우트도 같은 이유로 남겨뒀다(v1 호환 경로, 현재는 프론트엔드 어디에서도 호출하지 않음).
2. **Paywall UI는 "잠금 안내 + 비활성 버튼"까지만 구현했다.** 결제 자체는 Phase 3(`PaymentGateway` interface + Provider 선정) 소관이므로, `PreviewResultStep.jsx`의 "전체 리포트 보기" 버튼은 의도적으로 `disabled`다.
3. **§26의 Preview 전용 모델/토큰/청크 실측(1~4번)은 여전히 미해결.** 27.2-2에서 확인했듯 섣부른 축소는 위험하다는 것만 이번에 실증됐다.
4. **Initiative의 LLM 시그널 기여 여부(§24.4-1)는 그대로 코드 전용으로 유지했다.** Phase 2가 실제로 Preview UX를 붙였지만, 이 결정을 바꿀 새로운 근거는 없었다.
