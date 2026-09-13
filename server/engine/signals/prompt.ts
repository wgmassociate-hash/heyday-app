// Phase 1 — LLM Signal Extractor system prompt (docs/prd_v2.md §3, §13, §14).
// Renders weights.ts's canonical signalType catalogue into instructions so
// the vocabulary the model is asked to use and the vocabulary Score Engine
// knows how to weight never drift apart.
import { ALL_SCORED_SIGNAL_CONFIG } from '../score/weights.js'

const ROMANCE_POSITIVE_EXAMPLES = [
  '단둘이 만나려는 제안',
  '외모·매력에 대한 칭찬',
  '연애 여부 탐색',
  '보고 싶다는 표현',
  '상대를 특별하게 대우하는 표현',
  '관계 정의를 탐색하는 발언',
  '미래 상황에 상대를 포함',
  '직접적인 플러팅',
  '관계를 더 가까이 만들려는 명시적 행동',
]

const DISTANCING_EXAMPLES = [
  '반복적인 화제 차단',
  '만남 제안 회피',
  '대안 없는 거절',
  '관계에 선을 긋는 발언',
  '관계 확장 행동의 반복적 회피',
  '상대의 관계 행동에 지속적으로 최소한의 반응만 보임',
]

function renderSignalCatalogue(): string {
  const byCategory = new Map<string, string[]>()
  for (const cfg of ALL_SCORED_SIGNAL_CONFIG) {
    const list = byCategory.get(cfg.category) ?? []
    list.push(`  - "${cfg.signalType}": ${cfg.description}`)
    byCategory.set(cfg.category, list)
  }
  return [...byCategory.entries()]
    .map(([category, lines]) => `${category}:\n${lines.join('\n')}`)
    .join('\n')
}

export function buildSignalExtractionSystemPrompt(): string {
  return `당신은 두 사람의 카카오톡 대화에서 "관찰 가능한 관계 행동"만 분류하는 분석기입니다.

핵심 규칙 (반드시 지킬 것):
1. 점수·확률·퍼센트를 절대 만들지 마세요. 몇 점인지, 몇 퍼센트인지는 이 시스템이 코드로 계산합니다. 당신의 역할은 "무슨 행동이 있었는가"를 분류하는 것뿐입니다.
2. 강도(strength)를 숫자로 표현하지 마세요. 그런 필드 자체가 없습니다.
3. 실제로 대화에 존재하는 메시지에 대해서만 signal을 만드세요. messageIds는 제공된 메시지 id를 정확히 인용해야 합니다. 지어내면 안 됩니다.
4. 관찰되지 않은 신호는 만들지 마세요. 신호가 없으면 signals 배열을 비워두거나 적게 반환하는 것이 정답입니다.
5. 상대의 내면(성격, 정신 상태)을 진단하지 마세요. 실제 발화 행동만 분류하세요.

signalType은 아래 카탈로그에 있는 정확한 문자열만 사용하세요 (category별로 정리):

${renderSignalCatalogue()}

romance 카테고리는 direction: "positive"(아래 예시 같은 긍정적 연애 신호), "negative"(distancing 예시와 겹치는 거리두기 신호는 category: "distancing"으로 분류), "neutral"(애매한 신호)을 사용하세요. romance/distancing은 signalType을 자유롭게 짧은 영문 snake_case로 지어도 됩니다(카탈로그 제약 없음).

romance positive 예시: ${ROMANCE_POSITIVE_EXAMPLES.join(', ')}
distancing 예시: ${DISTANCING_EXAMPLES.join(', ')}

각 signal의 reason은 왜 이렇게 분류했는지 1문장 이내 한국어로 짧게 설명하세요. targetSpeakerId가 없는(자기 자신을 향한) signal은 빈 문자열 ""로 두세요.

JSON 스키마에 맞춰 정확히 응답하세요. 스키마 외의 필드나 숫자 점수 필드를 추가하지 마세요.`
}
