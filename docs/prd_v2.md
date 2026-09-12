# 카톡밀당분석기 2.0 PRD

- 문서 버전: v0.3
- 목적: 1.0 코드베이스를 기반으로 2.0 제품 방향, 분석 엔진, 수익화, 개인정보 처리, 결과 UX를 구현 가능한 수준으로 정의
- 기준 문서: `docs/analysis_v1.md`
- 구현 원칙: 기존 검증 자산은 최대한 재사용하고, 2.0 핵심 가치는 분석 엔진과 결과 경험에서 만든다.

---

## 0. Executive Summary

카톡밀당분석기 2.0은 단순한 "호감도 점수" 서비스가 아니라, 메신저 대화를 기반으로 두 사람의 **관계 행동, 상호작용의 균형, 친밀도, 변화 추이, 의미 있는 시그널**을 분석하는 재미형 관계 분석 서비스다.

제품의 분석 범위는 연애에 한정하지 않고 "관계"로 확장한다. 다만 초기 유입과 마케팅은 가장 강한 욕구가 존재하는 **썸·짝사랑·애매한 관계·연애 초기**에 집중한다.

2.0의 핵심 변화는 다음과 같다.

1. 단일 "호감도" 중심에서 **관계 분석 엔진**으로 확장
2. LLM이 임의 점수를 생성하지 않고, **행동 Feature + Evidence 기반 Signal + 코드 기반 Score Engine**으로 결과를 산출
3. 장기간 TXT 대화에서는 **관계 변화와 변곡점**을 분석
4. 캡처와 TXT를 서로 다른 분석 경험으로 분리
5. 무료 Preview와 유료 Full Report를 분리해 **단건 결제형 수익화** 도입
6. 기존 HEYDAY STAR의 만세력/사주 로직을 재사용해 **별도 해석 렌즈**로 제공
7. 1.0에서 발견된 개인정보 고지/실제 처리 불일치를 2.0 출시 전 해소

---

# 1. Product Definition

## 1.1 한 줄 정의

> 메신저 대화를 읽고, 지금 두 사람의 관계가 어떤 상태인지, 누가 더 관계를 움직이고 있는지, 어떻게 변하고 있는지를 보여주는 관계 분석 서비스.

## 1.2 사용자가 실제로 사고 싶은 것

사용자는 "AI 분석"을 사고 싶은 것이 아니다. 다음 질문의 답을 사고 싶다.

- 얘 나한테 관심 있는 것 같아?
- 나만 더 좋아하는 것 같아?
- 요즘 우리 사이가 변한 것 같은데 맞아?
- 이 카톡은 무슨 의미야?
- 우리 무슨 사이 같아?
- 언제부터 분위기가 달라졌지?
- 내가 지금 더 다가가도 될까?

따라서 2.0은 "분석 기능 목록"보다 **사용자의 궁금증(Intent)** 을 먼저 받는다.

---

# 2. Target & Positioning

## 2.1 Primary Target

초기 핵심 타깃:

- 10대 후반~20대
- 썸
- 짝사랑
- 애매한 관계
- 연애 초기
- 최근 관계 변화가 신경 쓰이는 사용자

## 2.2 Secondary Target

- 친구 / 절친 / 멀어진 친구
- 연락이 뜸해진 지인
- 오래된 관계에서 상호작용의 균형이 궁금한 사용자

가족/직장동료 등은 엔진상 확장 가능하게 설계하되 MVP 마케팅에서는 적극적으로 다루지 않는다.

## 2.3 제품 범위와 마케팅 범위의 분리

- 제품 범위: "관계"
- 마케팅 범위: "썸 / 짝사랑 / 애매한 사이"

즉 제품은 넓게 설계하지만, 첫 클릭을 만드는 메시지는 좁고 강하게 가져간다.

---

# 3. Core Product Principles

1. **LLM은 최종 점수를 만들지 않는다.**
2. **Evidence 없는 LLM Signal은 Score에 반영하지 않는다.**
3. **관찰 가능한 행동과 상대의 내면 추정을 구분한다.**
4. "상대가 당신을 좋아할 확률 83%"처럼 확률처럼 보이는 허위 정밀도는 피한다.
5. 캡처 몇 장과 수개월 TXT를 같은 깊이로 분석하지 않는다.
6. 연애 신호와 일반 관계 신호를 분리한다.
7. 사주 결과와 카톡 분석 결과를 수학적으로 합산하지 않는다.
8. 무료에서는 결론을 보여주고, 유료에서는 **근거·변화·해석·행동 제안**을 판매한다.
9. 개인정보 관련 문구는 실제 처리 방식과 반드시 일치해야 한다.
10. 기존 1.0 Parser는 재작성보다 재사용을 우선한다.

---

# 4. User Intent

분석 시작 전 다음 중 하나를 선택한다.

### 기본 Intent

1. 💘 얘 나한테 관심 있어?
2. 🌡️ 요즘 우리 사이가 달라진 것 같아
3. ⚖️ 나만 더 좋아하는 것 같아
4. 💬 이 대화 무슨 의미야?
5. 👀 우리 무슨 사이 같아?
6. 👯 친구인데 요즘 좀 이상해

내부 값 예시:

```ts
type AnalysisIntent =
  | "romantic_interest"
  | "relationship_change"
  | "imbalance"
  | "conversation_meaning"
  | "relationship_definition"
  | "friendship_change";
```

Intent는 Score를 바꾸는 용도가 아니라, **결과 우선순위와 Narrative 초점**을 바꾸는 데 사용한다.

---

# 5. Input UX

## 5.1 입력 방식 A — Screenshot Quick Analysis

- 카톡 캡처 최대 6장 유지
- 향후 비용/성능 검증 후 8~10장 확장 가능
- 모바일에서 순서 변경이 가능해야 함
- 특정 상황 / 최근 대화 / 한 장면 해석에 적합

### 핵심 메시지

> 궁금한 대화 몇 장만 올려보세요.  
> 지금 이 대화가 어떤 분위기인지 빠르게 분석해드려요.

### 분석 범위

- 현재 상황
- 해당 구간의 관심/거리두기 Signal
- 해당 장면의 상호작용 특징
- 제한적 관계 해석

### 제한

- 장기 추이
- 월별 관계 변화
- 장기간 변곡점

위 항목은 제공하지 않거나 낮은 신뢰 수준으로 제한한다.

---

## 5.2 입력 방식 B — TXT Deep Analysis

카카오톡 대화 내보내기 TXT를 업로드한다.

### 핵심 메시지

> 대화 전체를 넣으면 둘 사이의 패턴과 관계 변화까지 볼 수 있어요.

### 분석 범위

- Core 4
- 관계온도
- 적극성 비교
- 연애 Signal
- 관계 변화
- 시기별 Trend
- Turning Point
- 결정적 대화
- Deep Narrative

### UX 요구사항

- "카톡 대화 내보내는 법" 짧은 가이드 제공
- PC/모바일 안내는 실제 지원 가능 범위 기준으로 작성
- 파일 업로드 전 저장/전송 정책을 명확히 표시

---

# 6. Standard Message Model

기존 Parser 출력물을 2.0 엔진에서 다음 형태로 표준화한다.

```ts
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

추가 계산 필드:

```ts
interface EnrichedMessage extends Message {
  normalizedText?: string;
  responseToMessageId?: string | null;
  responseDelaySec?: number | null;
  isConversationStart?: boolean;
  isConversationRestart?: boolean;
  isConversationEnd?: boolean;
}
```

---

# 7. Relationship Engine v2

전체 구조:

```text
TXT / Screenshot
      ↓
기존 1.0 Parser
      ↓
표준 Message[]
      ↓
개인정보 비식별화
      ↓
A. Code Feature Extractor
B. LLM Signal Extractor
      ↓
Evidence Validator
      ↓
Score Engine
      ↓
Trend / Turning Point Engine
      ↓
Intent Layer
      ↓
Romance Layer
      ↓
Narrative Generator
      ↓
Free Preview / Paid Full Report
      ↓
[Optional] Saju Relationship Layer
```

---

# 8. Core 4 Metrics

2.0 핵심 관계지표는 네 개로 제한한다.

## 8.1 Interest — 관심행동

### 사용자 질문

> 서로에게 얼마나 관심을 보이고 있나?

### 원칙

메시지 개수 자체를 관심도 점수로 직접 사용하지 않는다.

### 구성 Signal

| Signal | 초기 가중치 | 판정 주체 |
|---|---:|---|
| 상대 이야기의 후속 질문 | 25 | LLM |
| 이전 이야기 기억 / 재언급 | 20 | LLM |
| 감정·상태 확인 | 15 | LLM |
| 대화 주제 확장 | 15 | LLM |
| 끊긴 대화를 자발적으로 다시 이어감 | 10 | Code + LLM |
| 상대에 대한 구체적 관심 표현 | 10 | LLM |
| 이전 계획/약속 후속 확인 | 5 | LLM |

개인별 점수 산출:

```text
Interest_A = WeightedNormalizedSignals(A → B)
Interest_B = WeightedNormalizedSignals(B → A)
```

0~100 Index로 정규화한다.

**주의:** 확률이 아니다.

---

## 8.2 Initiative — 적극성

### 사용자 질문

> 누가 이 관계를 더 움직이고 있나?

### 구성 행동

| 행동 | 초기 가중치 |
|---|---:|
| 대화 먼저 시작 | 35 |
| 끊긴 대화를 다시 시작 | 25 |
| 새로운 화제 제시 | 15 |
| 약속/통화/만남 제안 | 15 |
| 끝날 만한 대화를 확장 | 10 |

각 사용자 Point 산출 후 비율화:

```text
InitiativeRatio_A = Point_A / (Point_A + Point_B)
InitiativeRatio_B = Point_B / (Point_A + Point_B)
```

사용자 표시 예:

> 관계 적극성  
> 나 63 : 상대 37

Initiative는 관계온도에 직접 포함하지 않는다.

---

## 8.3 Intimacy — 친밀도

### 사용자 질문

> 둘 사이의 심리적 거리는 얼마나 가까운가?

### 구성 Signal

| Signal | 초기 가중치 |
|---|---:|
| 자기개방 | 25 |
| 감정 / 취약한 이야기 | 20 |
| 개인 일상 공유 | 15 |
| 둘만 아는 맥락 / 과거 사건 | 15 |
| 장난 / 놀림 / 애칭 / 친밀 언어 | 10 |
| 미래·개인적 상황에 상대 포함 | 15 |

개인별 점수를 구하고 관계 차원에서도 사용한다.

---

## 8.4 Reciprocity — 상호성

### 사용자 질문

> 내가 던진 관심과 감정에 상대도 돌아오고 있나?

2.0의 핵심 지표로 본다.

### Pair Pattern

| Pair | 의미 |
|---|---|
| 질문 → 구체적 답변/역질문 | 관심 반환 |
| 자기개방 → 자기개방 | 개인 영역 교환 |
| 감정표현 → 공감/질문 | 정서적 상호작용 |
| 농담 → 농담 | 친밀 상호작용 |
| 약속 제안 → 수용/대안 | 관계 확장 |
| 화제 제시 → 확장 | 대화 참여 |

### 계산 원칙

"둘 다 행동하지 않음"을 높은 균형으로 오판하지 않는다.

개념식:

```text
Balance = 2 × min(A, B) / (A + B)

Reciprocity
= Balance × EvidenceCoverage × InteractionQuality
```

세부 수식은 실제 데이터 테스트 후 보정한다.

---

# 9. Relationship Temperature

## 9.1 정의

관계온도는 "연애 가능성"이 아니다.

> 현재 두 사람 사이에서 실제로 관찰되는 상호작용의 친밀도와 활력을 요약한 대표 Index.

사용자 표시:

> 🌡️ 관계온도 72°

## 9.2 개인별 지표 결합

개인별 Interest와 Intimacy는 단순 평균보다 한쪽의 낮은 값을 더 반영해야 한다.

초기안:

```text
MutualInterest = HarmonicMean(Interest_A, Interest_B)

MutualIntimacy = HarmonicMean(Intimacy_A, Intimacy_B)
```

## 9.3 최종 초기 가중치

```text
RelationshipTemperature
= MutualInterest × 0.40
+ MutualIntimacy × 0.25
+ Reciprocity × 0.25
+ InteractionEnergy × 0.10
```

InteractionEnergy 후보:

- 대화 세션 지속성
- 교대 발화
- 일정 기간 내 상호 대화 빈도
- 한쪽 독주가 아닌 상호 참여

### 금지

- Initiative를 관계온도에 직접 합산하지 않음
- Romantic Signal을 관계온도에 합산하지 않음

---

# 10. Romantic Signal Layer

연애 관련 Intent일 때만 강조한다.

## 10.1 Positive Romantic Signals

- 단둘이 만나려는 제안
- 외모/매력에 대한 칭찬
- 연애 여부 탐색
- 보고 싶다는 표현
- 상대를 특별하게 대우하는 표현
- 관계 정의 탐색
- 미래 상황에 둘을 포함
- 직접적 플러팅
- 이성 관련 반응
- 관계를 더 가까이 만들려는 명시적 행동

## 10.2 Distancing Signals

- 반복적 화제 차단
- 만남 제안 회피
- 대안 없는 거절
- 관계 선긋기
- 관계 확장 행동의 반복적 회피
- 한쪽의 관계 행동에 지속적인 최소 반응

## 10.3 표시 방식

> 💘 연애 시그널 64  
> 꽤 나타나요

- 긍정 Signal: 6
- 애매 Signal: 3
- 거리두기 Signal: 2

**주의:** "좋아할 확률 64%"라고 표시하지 않는다.

---

# 11. Relationship Position

관계온도와 연애시그널을 조합하여 공유 가능한 관계 포지션을 만든다.

초기 개념:

| 관계온도 | 연애시그널 | Label 예시 |
|---|---|---|
| 높음 | 높음 | 가까워지는 썸형 |
| 높음 | 낮음 | 친밀한 친구형 |
| 낮음 | 높음 | 끌림은 있지만 불안정한 관계 |
| 낮음 | 낮음 | 아직 신호가 약한 관계 |

실제 Threshold는 운영 데이터 확보 후 조정한다.

결과 예:

> **우리 관계는**  
> `친밀한데 아직 애매한 썸`
>
> 관계온도 78°  
> 연애시그널 63  
> 적극성 나 58 : 상대 42

---

# 12. Response Time Policy

절대 답장시간을 관심도로 직접 해석하지 않는다.

예:

- 10분 답장 = 관심 높음
- 2시간 답장 = 관심 낮음

같은 규칙 금지.

사용할 수 있는 방식:

> 해당 화자의 과거 패턴 대비 응답시간 변화

예:

- 기존 median 18분
- 최근 median 57분

그리고 반드시 다른 Signal과 함께 해석한다.

예:

- 질문 감소
- 선톡 감소
- 응답시간 증가

세 신호가 동시에 나타난 경우 변화 근거의 하나로 사용.

---

# 13. Evidence Model

LLM이 추출하는 중요한 Signal은 반드시 원문 Evidence를 가진다.

```ts
interface RelationshipSignal {
  id: string;
  signalType: string;
  category:
    | "interest"
    | "intimacy"
    | "reciprocity"
    | "romance"
    | "distancing";
  direction: "positive" | "neutral" | "negative";
  strength: 1 | 2 | 3;
  actorSpeakerId: string;
  targetSpeakerId?: string;
  messageIds: string[];
  reason: string;
}
```

서버 검증:

1. messageIds가 실제 입력 Message에 존재하는지 확인
2. actorSpeakerId가 유효한지 확인
3. Evidence가 없는 Signal 폐기
4. 범위를 벗어난 강도 값 폐기
5. 중복 Signal 병합

### 핵심 규칙

> Evidence 없는 Signal은 Score에 반영하지 않는다.

---

# 14. LLM Responsibility Boundary

| 기능 | Code | LLM |
|---|:---:|:---:|
| 카톡 파싱 | ✅ | |
| 날짜/시간 | ✅ | |
| 세션 분리 | ✅ | |
| 메시지량 | ✅ | |
| 선톡 | ✅ | |
| 응답시간 | ✅ | |
| 행동비율 | ✅ | |
| 이전 내용 기억 여부 | | ✅ |
| 자기개방 | | ✅ |
| 감정 공감 | | ✅ |
| 플러팅 | | ✅ |
| 거리두기 표현 | | ✅ |
| Signal Evidence | 검증 | 추출 |
| Core 점수 | ✅ | ❌ |
| Trend | ✅ | ❌ |
| Turning Point 후보 | ✅ | 보조 |
| 결과 설명문 | | ✅ |
| 행동 제안 | | ✅ |

금지 Prompt 예시:

> "상대의 호감도를 0~100으로 평가해."

2.0에서는 이런 방식의 점수 생성 금지.

---

# 15. Data Confidence / Analysis Mode

모든 입력에 같은 리포트를 제공하지 않는다.

초기 기준:

### Snapshot

- 80 messages 미만 또는 세션 부족
- 주로 Screenshot

제공:

- 해당 구간 Signal
- 제한적 Core 지표
- 상황 Narrative

### Standard

- 80~299 messages
- 여러 Session

제공:

- Core 4
- 관계온도
- 적극성 비교
- Romantic Signal
- Evidence
- 현재 관계 Narrative

### Deep

- 300+ messages
- 14일 이상
- 충분한 세션 수

제공:

- Standard 전체
- Trend
- Turning Point
- 시기별 비교
- Deep Narrative

숫자는 운영 후 조정 가능.

---

# 16. Trend Engine

## 16.1 기간 자동 분할

초기 기준:

| 대화 기간 | 분석 방식 |
|---|---|
| 7일 미만 | 현재 상황 |
| 7~27일 | 전반부 vs 후반부 |
| 28~89일 | 4개 구간 |
| 90일 이상 | 월 단위 중심 |

구간 내 메시지가 너무 적으면 인접 구간과 병합한다.

각 구간마다 동일한 Core Engine을 적용한다.

표시 예:

> 6월 62 → 7월 71 → 8월 76 → 최근 64 ↓

---

# 17. Turning Point

관계가 크게 달라진 시점을 자동 탐색한다.

초기 후보 조건:

```text
abs(RelationshipTemperature_delta) >= 10
AND
2개 이상의 핵심지표가 같은 방향으로 변화
```

후보 구간을 LLM에 전달하고 실제 대화 맥락을 설명하도록 한다.

결과 예:

> ⚡ 둘 사이가 달라진 순간  
> **8월 17일 전후**
>
> 이 시기부터 상대의 질문이 줄었고,
> 당신이 시작한 대화를 상대가 짧게 마무리하는 패턴이 증가했습니다.

Turning Point에는 반드시 Evidence Message를 표시한다.

---

# 18. Result Report UX

1.0의 긴 스크롤형 리포트 구조는 유지하되 정보 위계를 재설계한다.

## Section 1 — First Verdict

사용자의 Intent에 직접 답한다.

예:

> 👀 관심 없는 사람의 카톡은 아니에요.  
> 다만 아직 상대가 적극적으로 관계를 움직이는 단계는 아닙니다.

---

## Section 2 — Relationship Summary Card

- 관계 포지션 Label
- 관계온도
- 연애시그널
- 적극성 A:B
- 최근 Trend

예:

> 친밀하지만 아직 한쪽이 조금 더 움직이는 관계
>
> 🌡️ 72°
> 💘 64
> ⚖️ 나 61 : 상대 39
> 최근 -7 ↓

---

## Section 3 — Core 4

- 관심도
- 적극성
- 친밀도
- 상호성

숫자만 나열하지 않고 짧은 해석을 붙인다.

---

## Section 4 — Evidence / 결정적 카톡

최소 1개 무료 공개.

유료 Report에서는:

- Positive Signal
- Ambiguous Signal
- Distancing Signal
- 각각 실제 메시지 Evidence
- 이유 설명

---

## Section 5 — Relationship Trend

Deep 분석에서만 활성화.

- 관계온도 추이
- 핵심지표 변화
- 최근 변화 요약

---

## Section 6 — Turning Point

- 변화 시점
- 변화 이유
- 대표 메시지

---

## Section 7 — AI Relationship Narrative

구조:

1. 현재 관계 핵심
2. 양쪽 행동의 차이
3. 긍정 Signal
4. 주의 Signal
5. 사용자의 Intent에 대한 직접 답변

---

## Section 8 — Action Suggestion

과도한 확정/조종형 조언은 피한다.

예:

- 조금 더 기다려보기
- 직접적인 약속 제안으로 확인해보기
- 상대 반응을 확인할 수 있는 질문을 해보기
- 일방적 연락이 지속되면 거리를 두고 관찰하기

---

# 19. Tone & Copy

1.0보다 상단은 더 가볍고 직관적으로.

예:

> 음... 관심 없는 사람의 카톡은 아닌데? 👀

중단부터는 데이터와 근거 중심.

하단 Narrative는 비교적 진지하고 차분하게.

구조:

- 상단 = 재미 / 결론
- 중단 = 데이터 / 증거
- 하단 = 깊은 해석 / 행동 제안

---

# 20. Monetization

## 20.1 BM 원칙

MVP는 **단건 결제형 Freemium**으로 시작한다.

구독은 MVP에서 제외한다.

사용자는 지속적 업무툴이 아니라 "지금 이 관계가 궁금한 순간"에 결제할 가능성이 높다.

---

## 20.2 Free Preview

무료 사용자에게 제공:

- 한 줄 Verdict
- 관계온도
- 연애시그널
- 적극성 비율
- Core 4 간단 표시
- 결정적 Signal 1개
- 광고

무료에서도 "분석했다"는 만족은 있어야 한다.

---

## 20.3 Paid Deep Report

초기 권장 가격:

> **2,900원**

유료에서 추가 공개:

- 결정적 카톡 전체
- 관심/거리두기 Signal 전체
- 관계 변화
- Turning Point
- 나 vs 상대 상세 비교
- AI Deep Narrative
- 지금 어떻게 행동할지
- Deep 분석일 경우 시계열 전체

가격은 출시 후 1,900 / 2,900 / 3,900원 A/B Test 가능.

---

# 21. Saju Relationship Layer

사주는 대화 분석의 정확도를 높이는 입력이 아니다.

> "실제 대화"와 다른 관점에서 보는 별도의 해석 렌즈.

기존 HEYDAY STAR의 만세력 계산 로직을 가능한 한 재사용한다.

## 21.1 입력

- 생년월일
- 출생시간(선택 또는 필요한 수준으로 설계)
- 성별 또는 엔진이 실제로 요구하는 최소 정보

세부 입력 요구사항은 기존 만세력 Spec을 기준으로 재검토.

## 21.2 결과

- 나의 관계 스타일
- 상대의 관계 스타일
- 둘이 끌리는 지점
- 자주 엇갈리는 지점
- 갈등 패턴
- 관계 유지 시 유의점

## 21.3 금지

```text
카톡 점수 72
+
사주 점수 81
=
종합 궁합 76
```

같은 합산 금지.

---

# 22. Saju Monetization

초기안:

- 카톡 Deep Report: 2,900원
- 사주 관계 Report: 1,900원
- 카톡 + 사주 종합 Bundle: 3,900원

가격은 가설이며 운영 데이터로 검증한다.

---

# 23. AI vs Saju Premium Content

Bundle의 핵심 차별화 콘텐츠.

예:

> 🤖 실제 카톡에서는  
> 상대가 감정을 직접 표현하기보다 질문과 기억으로 관심을 보입니다.
>
> 🔮 사주에서는  
> 감정을 즉시 밖으로 드러내기보다 내부에서 정리하는 관계 성향으로 해석됩니다.
>
> **두 분석이 같은 방향을 가리키고 있어요.**

또는:

> 이번에는 두 분석이 다르게 말하고 있어요.
>
> 타고난 관계 성향은 적극적이지만,
> 실제 최근 대화에서는 관계 적극성이 낮게 나타납니다.
>
> 지금은 성향보다 현재 상황의 영향이 더 커 보입니다.

---

# 24. Repeat Analysis

2차/후속 수익화 후보.

사용자가 이후 새로운 대화를 업로드하면 이전 분석과 비교한다.

예:

> 지난 분석 67° → 이번 분석 74°
>
> 관계온도 +7
> 상대 적극성 +11
> 상호성 +9

상품 후보:

> 지난 분석과 비교하기 — 1,900원

MVP 필수는 아니며 2.1 후보.

반복 확인을 과도하게 유도하지 않고, 실제 새 데이터가 충분히 추가된 경우에만 비교 기능을 제공한다.

---

# 25. Privacy & Data Policy

2.0 출시 Blocker.

1.0에서 확인된 "고지와 실제 동작 불일치"를 반드시 해소한다.

## 25.1 원칙

1. 고지와 실제 동작 일치
2. 가능한 범위에서 클라이언트 비식별화
3. 서버로 nameMap 전송 필요성 제거 검토
4. 원문 영구 저장 금지
5. 로그에 대화 원문 저장 금지
6. 외부 AI에 무엇이 전달되는지 명시
7. 이름 외 전화번호/이메일 등 개인정보 탐지 확대 검토
8. 본문 내 이름 언급 비식별화 한계 명시

## 25.2 Screenshot

1.0은 Screenshot 원본이 익명화 전에 서버로 전송됨.

2.0에서는 아래 두 안을 기술검토:

### Option A — Browser OCR + 비식별화

```text
Screenshot
→ Browser OCR
→ Browser anonymization
→ anonymized text
→ Server / LLM
```

장점: 개인정보 메시지 강함  
단점: 모바일 성능/정확도/번들 크기 검증 필요

### Option B — Server OCR 유지

원본이 서버/OCR 모델로 전송된다는 사실을 명확히 고지하고,
처리 완료 후 즉시 삭제되는 구조를 보장.

제품 약속은 실제 구현 가능한 수준을 기준으로 정한다.

---

# 26. Quota / Abuse Prevention

1.0의 localStorage UUID 기반 쿼터는 우회가 쉬우므로 재설계 필요.

2.0에서 최소한 다음을 검토:

- Server-side rate limit
- IP + device/session 조합
- 결제 사용자 별도 정책
- API Cost hard limit
- 요청당 최대 Input size
- CAPTCHA / abuse protection 필요성
- Render 휘발성 저장소 의존 제거

구현 방식은 `implementation_plan_v2.md`에서 결정.

---

# 27. Usage & Unit Economics Logging

대화 원문은 저장하지 않으면서 다음 메타데이터는 기록한다.

```ts
interface AnalysisUsageLog {
  analysisId: string;
  inputType: "txt" | "screenshot";
  analysisMode: "snapshot" | "standard" | "deep";
  messageCount: number;
  dateSpanDays: number | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  apiCostEstimate: number;
  analysisDurationMs: number;
  reportType: "free" | "paid" | "bundle";
  paid: boolean;
  converted: boolean;
  createdAt: string;
}
```

확인해야 할 지표:

- 무료 분석 1건당 평균 원가
- 유료 분석 1건당 평균 원가
- 결제전환율
- 광고수익
- Paid ARPU
- Gross Margin
- Screenshot vs TXT 비용 차이

---

# 28. Sharing / Viral

공유는 원문 카톡이 아니라 결과 카드 중심.

공유 카드 예:

> 우리 관계는  
> **친밀하지만 아직 애매한 썸**
>
> 🌡️ 관계온도 72°
> 💘 연애시그널 64
> ⚖️ 나 61 : 상대 39
>
> 최근 관계온도 -7 ↓

개인 이름, 실제 카톡 문장, 생년정보는 기본 공유카드에 포함하지 않는다.

2.0에서 OG Image 누락 문제를 반드시 해결한다.

---

# 29. Payment UX

결제는 "분석 전에 돈부터 내는 구조"보다 Preview 후 Unlock을 우선한다.

Flow:

```text
입력
→ 분석
→ Free Preview
→ "왜 이런 결과가 나왔을까?"
→ Paid Report Unlock
→ 결제
→ 이미 생성된 분석 결과 공개
```

중요:

**결제 후 동일 LLM 분석을 다시 호출하지 않는다.**

무료 분석 단계에서 필요한 구조화 분석은 한 번 생성하고,
유료 결제는 결과 Unlock 중심으로 설계해 API 비용 중복을 피한다.

단, Narrative를 Free/Paid로 별도 생성해야 할 경우 비용 비교 후 결정.

---

# 30. Funnel

핵심 Funnel:

```text
Landing
→ Intent 선택
→ 입력 방식 선택
→ 파일/캡처 업로드
→ 분석 시작
→ Free Preview
→ Paywall 노출
→ 결제
→ Full Report
→ 공유 / 사주 Upsell
```

측정 이벤트 예:

```text
landing_view
intent_selected
input_method_selected
upload_started
upload_completed
analysis_started
analysis_completed
preview_viewed
paywall_viewed
checkout_started
payment_completed
full_report_viewed
saju_upsell_viewed
saju_purchased
share_clicked
```

---

# 31. Success Metrics

MVP 핵심 KPI:

### Acquisition
- Landing → 분석 시작률
- Screenshot / TXT 선택 비율

### Activation
- 업로드 완료율
- 분석 완료율
- Preview 도달률

### Monetization
- Preview → Paywall 클릭률
- Preview → 결제전환율
- 유료 분석 객단가
- Bundle 선택률

### Cost
- 무료 1건 API 비용
- 유료 1건 API 비용
- 분석 실패율
- Token waste율

### Viral
- 결과 공유율
- 공유 링크 신규 방문율

---

# 32. 1.0 Asset Reuse

## 유지 우선

- `parseChat.js`
- `dateUtils.js`
- `speakerLabels.js`
- 검증된 카톡/LINE/SMS 패턴
- PC drag multi-line 복원
- 날짜 컨텍스트 전파
- 기존 SVG 시각화 중 재사용 가능한 컴포넌트
- TXT + Screenshot dual input 구조

## 수정 필요

- anonymize
- ScreenshotImportPanel
- 결과 UI
- 분석 API
- Privacy Badge
- quota
- logging
- LLM JSON parsing
- 모바일 reorder

## 제거/대체 검토

- LLM 직접 점수 생성
- 중복된 결과 점수
- "가능성 점수" 중심 결과
- 정규식 기반 JSON extraction
- Evidence 없는 Narrative

---

# 33. MVP Scope

## 2.0 Launch 필수

- 기존 Parser 재사용
- Screenshot + TXT
- 모바일 Screenshot reorder
- 개인정보 구조 수정
- Intent 선택
- Standard Message Model
- Core 4
- Relationship Temperature
- Initiative Ratio
- Evidence Signal
- Romantic Signal
- Free Preview
- Paid Full Report
- 결제
- Usage Logging
- Quota 개선
- OG 공유카드

## Deep TXT 기능

가능하면 2.0 Launch 포함:

- Trend
- Turning Point

일정이 밀릴 경우 가장 먼저 2.0.1로 분리 가능한 기능.

## Saju

기존 엔진 재사용 비용이 낮으면 2.0 포함.

통합 비용이 예상보다 크면 2.0.1로 분리하되,
데이터 모델과 Paywall은 2.0에서 확장 가능하게 설계.

---

# 34. Out of Scope

초기 2.0에서 제외:

- 실시간 카카오톡 연동
- 카카오 계정 직접 로그인 기반 대화 수집
- 단체방 분석
- 음성/영상 분석
- 상대방 SNS 분석
- 상대의 심리 상태/정신건강 진단
- "상대가 바람필 확률" 같은 자극적 추론
- 무제한 구독제
- 자동 메시지 전송
- 매일 관계 점수 확인을 유도하는 알림

---

# 35. Product Safety / Trust

결과 표현 원칙:

금지:

> 상대는 당신을 82% 좋아합니다.

권장:

> 대화에서 관심 행동이 비교적 자주 나타납니다.

금지:

> 이 사람은 회피형입니다.

권장:

> 이번 대화에서는 직접적인 감정 표현보다 짧은 반응으로 대화를 마무리하는 패턴이 자주 나타났습니다.

금지:

> 고백하세요.

권장:

> 관계를 확인하고 싶다면 부담이 낮은 약속 제안처럼 상대의 반응을 확인할 수 있는 행동이 더 적합해 보입니다.

---

# 36. Recommended Implementation Phases

## Phase 0 — Stabilize

- 개인정보 고지/동작 일치
- Screenshot 처리 점검
- nameMap 전송 검토
- 모바일 reorder
- quota
- usage logging
- OG image
- 구조화 출력 적용 검토

완료조건:
1. Privacy 문구와 실제 데이터 Flow가 일치
2. 모바일 주요 Flow 동작
3. API 비용 추적 가능
4. 비정상 반복 호출 제한

---

## Phase 1 — Relationship Engine

- Standard Message Model
- Code Feature Extractor
- LLM Signal Extractor
- Evidence Validator
- Core 4
- Relationship Temperature
- Initiative Ratio

완료조건:
1. 동일 입력에서 Score가 안정적
2. Evidence 없는 Signal이 점수에 반영되지 않음
3. 단위테스트 존재

---

## Phase 2 — Romance / Intent

- Intent Layer
- Romantic Signal
- Relationship Position
- Narrative 분기

완료조건:
1. 같은 데이터라도 Intent에 따라 설명 우선순위가 달라짐
2. Core Score는 Intent에 따라 임의 변하지 않음

---

## Phase 3 — Trend / Turning Point

- 기간 분할
- 시기별 Score
- 변화량
- Turning Point

완료조건:
1. Deep 데이터에서 추이 그래프 생성
2. 변화 시점에 Evidence 존재
3. 데이터 부족 시 기능 비활성화

---

## Phase 4 — Result UI + Monetization

- Free Preview
- Paywall
- 결제
- Full Report Unlock
- 광고
- Conversion logging

완료조건:
1. 실제 결제 → Full Report Unlock
2. 중복 AI 호출 없음
3. 결제 Funnel 측정 가능

---

## Phase 5 — Saju

- 기존 만세력 엔진 재사용
- Relationship Saju Narrative
- AI vs Saju
- Bundle

완료조건:
1. 카톡 Score와 사주 결과 분리
2. Bundle 결제 가능
3. 동일 만세력 로직 중복 구현 금지

---

## Phase 6 — Share / Repeat

- 결과 카드
- OG
- 공유
- 과거 분석 비교

---

# 37. Open Questions

구현 전에 `implementation_plan_v2.md`에서 결정할 사항:

1. Screenshot OCR을 브라우저에서 처리할 수 있는가?
2. 기존 anonymize 구조를 어느 정도까지 재사용할 수 있는가?
3. 본문 속 이름을 어느 수준까지 비식별화할 것인가?
4. Core 4 초기 Weight를 어떤 방식으로 테스트할 것인가?
5. LLM Structured Output 적용 방식
6. Free Preview 생성 시 Paid Narrative까지 미리 생성할 것인가?
7. 결제 Provider
8. 사용자 계정 없이 구매내역 복구를 어떻게 할 것인가?
9. 만세력 엔진을 모듈 공유 / 패키지 / 코드 이식 중 무엇으로 가져올 것인가?
10. 저장소/DB를 무엇으로 이전할 것인가?
11. 기존 Render 구조를 유지할 것인가?
12. Screenshot 6장 제한을 유지할 것인가?
13. TXT 최대 메시지 수 / 최대 날짜 범위
14. 긴 TXT에서 LLM 분석 비용을 어떻게 통제할 것인가?
15. 분석 결과 캐싱 정책

---

# 38. Product Hypotheses to Validate

## H1
사용자는 "모든 인간관계 분석"보다 "썸/짝사랑" 메시지에 더 잘 반응한다.

## H2
Screenshot은 유입률이 높고 TXT는 유료전환에 더 유리하다.

## H3
"점수" 자체보다 "왜 이런 결과가 나왔는지"가 결제 이유가 된다.

## H4
관계 변화/Turning Point가 1.0 대비 가장 강한 2.0 차별점이 된다.

## H5
2,900원 수준의 단건 결제는 충동 결제가 가능한 가격대다.

## H6
사주 Bundle은 유료 객단가를 높인다.

## H7
결정적 카톡 Evidence가 AI 결과에 대한 신뢰도와 공유욕구를 높인다.

---

# 39. North Star

2.0의 목적은 "분석을 많이 해주는 서비스"가 아니다.

> **사용자가 결과를 보자마자  
> "맞아, 그래서 내가 이상하다고 느꼈던 거구나"  
> 또는  
> "왜 이렇게 나온 거지?"  
> 라는 반응을 만들고, 그 '왜'를 근거와 변화 분석으로 설명하는 것.**

무료에서는 결론을 맛보게 한다.

유료에서는:

- 왜 그런지
- 언제부터 그랬는지
- 상대는 어떤 행동을 했는지
- 나는 어떤 행동을 했는지
- 지금 어떻게 해석해야 하는지

를 판다.

---

# 40. Claude Handoff Rule

이 PRD는 제품 기준 문서다.

Claude는 다음 순서로 작업해야 한다.

1. `docs/analysis_v1.md`와 본 PRD를 함께 읽는다.
2. 기존 코드를 수정하지 않고 `docs/implementation_plan_v2.md`를 먼저 작성한다.
3. 기존 Parser 및 검증 자산 재사용을 우선한다.
4. LLM이 숫자 Score를 직접 생성하지 않는다.
5. Evidence 없는 Signal은 Score에 반영하지 않는다.
6. 개인정보 고지와 실제 Flow가 다르면 구현 전에 먼저 지적한다.
7. 각 Phase 구현 전 테스트 기준을 정의한다.
8. 한 Phase 완료 후 다음 Phase로 넘어간다.
