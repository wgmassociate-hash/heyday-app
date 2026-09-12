# 카톡밀당분석기 2.0 — Implementation Plan Review / Decision Memo

- 대상: `docs/implementation_plan_v2.md`
- 상태: **조건부 승인**
- 목적: 구현 착수 전 제품·비용·개인정보 관점에서 핵심 결정을 고정한다.

## 1. 승인하는 설계

다음은 그대로 유지한다.

- `parseChat.js`, `dateUtils.js`, `speakerLabels.js`는 재작성하지 않고 Adapter로 감싼다.
- `analyzeLocal.js`, `deepAnalysisLocal.js`의 단순 계수/통계 로직만 선별 재사용하고 기존 임의 점수 로직은 폐기한다.
- `RelationshipSignal`과 `ValidatedSignal`을 타입으로 분리한다.
- Score Engine에서 LLM SDK import를 금지한다.
- Structured Output / JSON Schema를 사용한다.
- Evidence가 실제 `messageId`를 참조하지 못하면 Signal을 폐기한다.
- Intent에 따라 Narrative 우선순위는 달라져도 Core Score는 달라지지 않는다.

## 2. 변경 결정 A — LLM `strength 1~3`를 점수에 사용하지 않는다

LLM이 최종 점수를 직접 만들지 않더라도 `strength: 1|2|3`이 Score에 곱해지면 사실상 LLM이 점수를 조정하는 구조가 된다.

### 결정

- `strength`는 Score 계산에서 제거한다.
- 가능하면 Signal Schema에서도 제거한다.
- Signal은 `signalType`, `actor`, `target`, `messageIds`, `direction`, `reason` 중심으로 추출한다.
- 점수 가중치는 **코드에 고정된 signalType별 Weight**를 사용한다.
- 같은 Signal이 반복되는 정도, 시점, 상호 Pair 여부 등은 코드가 계산한다.
- 표현 강도를 꼭 구분해야 하면 숫자 대신 `implicit | direct | explicit` 같은 제한된 Enum을 쓰고, 해당 Enum의 Weight는 코드가 정한다.

핵심 원칙:

> LLM은 "무슨 행동이 있었는가"를 분류한다.  
> 그 행동이 점수에 얼마나 반영되는지는 코드가 결정한다.

## 3. 변경 결정 B — "LLM 1회"가 아니라 "메시지당 의미분석 1회"를 원칙으로 한다

긴 TXT 전체를 물리적으로 한 번의 API 호출에 넣는 방식은 비용·누락·컨텍스트 문제를 만든다.

### 결정

- Deep 분석은 필요 시 chunking한다.
- 각 메시지는 원칙적으로 한 번의 semantic extraction 경로만 거친다.
- 시간구간별 Trend를 계산하기 위해 같은 원문을 다시 LLM에 보내지 않는다.
- Chunk에서 추출한 ValidatedSignal을 timestamp/messageId 기준으로 기간별 재분류하고 Trend는 코드가 계산한다.
- Chunk overlap은 문맥 보존에 필요한 최소 범위만 허용하고, 중복 Signal은 messageId 기반으로 제거한다.

즉 PRD의 "구간마다 Core Engine 적용"은:

> 동일하게 추출된 Feature/Signal을 기간별로 재집계하여 동일 Score Engine을 적용한다.

로 해석한다.

## 4. 변경 결정 C — 무료/유료 Narrative를 미리 한 번에 모두 생성하지 않는다

수익화를 목표로 하는 서비스에서 모든 무료 사용자에게 Paid용 LLM Output까지 미리 생성하면 결제전환율이 낮을 때 원가가 과도하게 발생한다.

### 결정: 2단계 Compute

### Stage 1 — Free Preview

비용 상한을 강하게 둔다.

- Parser + Code Feature는 전체 입력에 수행
- Semantic 분석은 제한된 대표 구간/샘플에만 수행하거나 저비용 Preview Budget을 사용
- 한 줄 Verdict
- 기본 관계지표 Preview
- Initiative
- Signal 1개 정도
- Paywall

### Stage 2 — Paid Deep Analysis

결제 완료 후 수행한다.

- 전체 허용 범위에 대한 chunked Signal Extraction
- Evidence 전체
- Trend
- Turning Point
- Deep Narrative
- Action Suggestion

Preview에서 이미 semantic 분석한 chunk는 재사용하여 같은 원문을 중복 호출하지 않는다.

따라서 불변식은:

> "결제 후 LLM을 다시 호출하지 않는다"가 아니라  
> **"이미 수행한 분석을 중복 호출하지 않는다"** 로 수정한다.

유료 결제 후 "정밀 분석 중" 대기 UX를 허용한다.

## 5. 변경 결정 D — 저장 정책

### Raw Input

- TXT 원문: 서버 영구 저장 금지
- Screenshot 원본: 서버 영구 저장 금지
- 처리 완료 또는 요청 종료 후 폐기
- 로그/APM/Error tracking에 원문이 남지 않도록 필터링

### Free Analysis

- 익명화된 구조화 Preview Result: 최대 24시간 TTL
- 원문/Evidence 전문은 저장하지 않음
- 운영 통계용 숫자 Metadata는 Content 없이 장기 보관 가능

### Paid Analysis

- 익명화된 Report JSON + 필요한 Evidence 발췌만 저장
- 초기 TTL: 30일
- Raw 전체 대화는 저장하지 않음
- 구매 복구는 signed report token/receipt id 등으로 설계
- Repeat Analysis용 장기 비교에는 원문이 아니라 Core Metric/Trend Snapshot만 사용

90일 Evidence 저장은 MVP에서는 채택하지 않는다.

## 6. 변경 결정 E — Screenshot 개인정보 처리

MVP에서 Browser OCR을 필수조건으로 두지 않는다. 한국어 OCR 품질과 모바일 성능 때문에 2.0 출시를 지연시킬 가능성이 크다.

### MVP 권장

- 현재 OCR 경로를 유지 가능
- 단, Screenshot 원본이 서버/외부 AI에 전송되는 사실을 정확히 고지
- OCR 완료 후 원본 폐기
- OCR text에 대해 이름/전화번호/이메일 등 비식별화 후 Relationship Engine으로 전달
- `nameMap`은 가능한 한 client에 남기고 서버에는 A/B speaker id만 전달
- 본문 속 이름 치환도 known speaker name 기준으로 수행
- "모든 개인정보를 완벽하게 제거한다"는 표현 금지

Browser OCR은 2.1 기술 실험으로 분리한다.

## 7. 변경 결정 F — 사주 엔진 재사용

HEYDAY STAR 서비스에 내부 API를 새로 만들어 런타임 의존성을 만드는 방안은 MVP 우선안으로 채택하지 않는다.

이유:

- 한 서비스 장애가 다른 서비스에 전파됨
- 배포/인증/버전 관리가 늘어남
- 아직 두 서비스가 안정적인 공용 플랫폼 단계가 아님

### 우선순위

1. 가능하면 만세력 계산/정책 Adapter + Golden Test를 별도 shared package로 추출
2. shared package화 비용이 과도하면 MVP에서는 검증된 Adapter를 provenance/version 명시와 함께 이식하고 Golden Test로 동일성을 고정
3. 이후 공용 package로 통합

핵심은 "동일 계산 규칙이 서로 다르게 진화하는 것"을 막는 것이다.

사주 통합 때문에 Relationship Engine/결제 출시를 늦추지 않는다.

## 8. 변경 결정 G — 점수 검증은 Exact Ground Truth보다 Invariant Test를 우선한다

Core 4의 초기 Weight는 과학적 사실이 아니라 제품용 heuristic이다.

따라서 Phase 1 완료조건에 다음 테스트 Fixture를 추가한다.

예시:

- 상호 질문/후속 질문을 추가하면 Interest가 내려가면 안 된다.
- 한쪽의 일방 질문만 늘어나면 Reciprocity가 올라가면 안 된다.
- 양쪽 자기개방이 증가하면 Intimacy가 내려가면 안 된다.
- 한쪽만 선톡을 반복하면 Initiative ratio가 그쪽으로 이동해야 한다.
- 동일한 친구 대화에서 Romantic Signal이 높게 튀면 안 된다.
- 명시적 플러팅/단둘이 만남 제안을 추가하면 Romantic Signal이 올라가야 한다.
- 모든 입력이 짧으면 Deep Trend가 생성되면 안 된다.
- Evidence가 없는 Signal을 제거했을 때 해당 Signal의 Score 기여도는 0이어야 한다.

최소 12~20개의 synthetic scenario fixture를 만든다.

## 9. 변경 결정 H — 저장소

결제와 Report 복구가 들어가는 시점부터 Render의 휘발성 파일 저장소를 사용하지 않는다.

### 결정

- 영속 데이터는 Postgres 계열 저장소로 이동한다.
- Vendor는 구현 시 교체 가능하도록 Repository interface 뒤에 둔다.
- 저장 대상은 Metadata, Payment state, Report snapshot, Aggregate metrics 중심이다.
- Raw conversation은 DB에 저장하지 않는다.

## 10. 변경 결정 I — 결제 구조

Provider에 제품 로직이 종속되지 않도록 `PaymentGateway` interface를 둔다.

MVP Flow:

`Free Preview → Paywall → Payment → Paid Deep Analysis → Full Report`

결제 성공 webhook/idempotency를 기준으로 Paid Analysis를 한 번만 실행한다.

Paid Analysis 실패 시 재시도 가능하되 동일 payment/analysis id에서 중복 과금 또는 중복 분석이 발생하지 않아야 한다.

## 11. Unit Economics 필수 로그

Preview와 Paid Deep을 분리해 각각 측정한다.

필수 지표:

- preview_input_tokens
- preview_output_tokens
- preview_cost
- paid_input_tokens
- paid_output_tokens
- paid_cost
- OCR cost
- total_cost_per_analysis
- preview_to_checkout
- checkout_to_payment
- payment_to_report_success
- paid_gross_margin

무료 분석 원가가 결제전환율을 고려했을 때 감당 가능한지 판단할 수 있어야 한다.

## 12. Phase 순서 수정

### Phase 0 — Stabilize / Privacy / Cost Metering
개인정보, Screenshot Flow, mobile reorder, quota, usage, storage foundation

### Phase 1 — Core Engine
Feature → Signal → Validate → Score + invariant fixtures

### Phase 2 — Free Preview
저비용 Preview 분석 + Paywall UX

### Phase 3 — Payment + Paid Deep
실결제/테스트결제 → 전체 Signal/Evidence → Full Report

### Phase 4 — Trend / Turning Point
Paid Deep 기반 시계열 분석

### Phase 5 — Saju Bundle
만세력 공용화/이식 + AI vs Saju

### Phase 6 — Share / Repeat
공유카드 + 이전 분석 비교

Trend가 Paid 핵심 가치이므로 Phase 3/4는 상황에 따라 병렬 또는 순서를 합칠 수 있다.

---

# Claude에 요청할 수정

현재 `docs/implementation_plan_v2.md`를 이 Decision Memo에 맞춰 업데이트하라.

특히 반드시 수정할 것:

1. LLM `strength`의 Score 기여 제거
2. "LLM 1회"를 chunked single semantic pass 원칙으로 변경
3. Free/Paid Narrative 선생성 구조를 2-stage compute로 변경
4. Raw/Preview/Paid 저장기간 분리
5. Screenshot 개인정보 실제 Flow와 고지 일치
6. 사주 internal API 우선안을 shared module/package 우선안으로 변경
7. Invariant-based synthetic fixture 추가
8. Postgres 영속 저장소 구조
9. Payment idempotency 및 Paid Deep 1회 실행
10. Preview/Paid 원가 분리 로깅

수정 후 아직 구현하지 말고,
문서 마지막에 **남아 있는 [결정 필요] 항목만 다시 목록화**해서 제시하라.
