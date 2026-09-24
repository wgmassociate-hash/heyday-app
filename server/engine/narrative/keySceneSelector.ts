// Phase 2.4 item 12 — "AI가 눈여겨본 핵심 장면 2개". Upgrades the single free
// Evidence (topSignal.ts's selectTopSignal, still used for the primary pick)
// to up to two, each paired with the actual anonymized excerpt it's grounded
// in (not just the LLM's `reason` paraphrase) — spec: "가능하면 실제
// 익명화된 대화 excerpt도 함께 보여준다". The second scene is deliberately
// picked to differ in meaning from the first (different signalType, preferring
// a different category too) — spec: "같은 signalType 두 개가 반복되지
// 않도록".
import type { AnalysisIntent } from '../intent/types.js'
import { rankBySalience, selectTopSignal } from '../pipeline/topSignal.js'
import type { SignalCategory, ValidatedSignal } from '../signals/types.js'

export interface KeyScene {
  title: string
  cueLabel: string
  excerpts: Array<{ speakerId: string; text: string }>
  /** Compact fallback retained for older clients. */
  speakerId: string
  excerpt: string
  interpretation: string
  signalType: string
  category: SignalCategory
}

export type MessageLookup = Map<string, { speakerId: string; text: string }>

const MAX_SCENES = 2
const MAX_EXCERPT_MESSAGES = 3
const EXCERPT_MAX_LENGTH = 80

const SCENE_TITLE: Record<string, string> = {
  remembers_past_detail: '지나간 말을 기억해 다시 꺼낸 순간',
  follows_up_on_plan: '말로 끝내지 않고 다음을 챙긴 순간',
  checks_on_feelings: '당신의 마음부터 살핀 순간',
  follow_up_question: '한마디를 흘려보내지 않은 순간',
  specific_interest_expression: '관심이 구체적인 말이 된 순간',
  revives_conversation: '멈췄던 대화를 다시 움직인 순간',
  expands_topic: '짧게 끝날 이야기를 더 이어간 순간',
  includes_partner_in_future: '앞으로의 장면에 상대를 넣은 순간',
  self_disclosure: '조금 더 안쪽의 이야기를 꺼낸 순간',
  vulnerable_emotion_share: '쉽게 말하기 어려운 마음을 내보인 순간',
  shared_context_reference: '둘만 아는 맥락이 다시 등장한 순간',
  playful_teasing_or_nickname: '편한 장난 속 친밀감이 드러난 순간',
  daily_life_share: '평범한 하루를 자연스럽게 나눈 순간',
}

const CATEGORY_TITLE: Record<SignalCategory, string> = {
  romance: '마음이 조금 더 선명하게 드러난 순간',
  interest: '상대를 향한 관심이 보인 순간',
  intimacy: '두 사람 사이의 편안함이 드러난 순간',
  distancing: '대화의 거리가 느껴진 순간',
}

const CATEGORY_CUE_LABEL: Record<SignalCategory, string> = {
  romance: '호감 가능성',
  interest: '관심의 단서',
  intimacy: '친밀감의 단서',
  distancing: '거리감의 단서',
}

/** Short "관찰 → 의미" interpretation line per catalogued signalType
 * (server/engine/score/weights.ts). Freeform romance/distancing signalTypes
 * (LLM-invented, no fixed catalogue — signals/prompt.ts) fall back to the
 * per-category default below instead of a per-signalType entry. */
const INTERPRETATION_COPY: Record<string, string> = {
  remembers_past_detail: '이전에 나눈 이야기를 기억했다가 다시 확인했어요. 한 번 듣고 흘려보내지 않았다는 점에서 지속적인 관심의 단서로 볼 수 있어요.',
  follows_up_on_plan: '이전의 약속이나 계획을 먼저 챙겼어요. 말로만 끝내지 않고 관계의 다음 흐름을 이어가려 했다는 점을 눈여겨봤어요.',
  checks_on_feelings: '안부 질문 자체는 일상적일 수 있지만, 자신의 이야기보다 상대의 감정이나 상태를 먼저 확인했다는 점을 눈여겨봤어요.',
  follow_up_question: '상대의 말을 짧게 받고 끝내지 않고, 후속 질문으로 관심을 이어갔어요. 질문 하나만으로 특별한 감정을 단정할 수는 없지만 대화를 지속하려는 행동이에요.',
  specific_interest_expression: '막연한 반응보다 상대를 향한 관심을 구체적인 말로 표현했어요. 표현이 얼마나 반복되는지도 함께 살펴볼 만해요.',
  revives_conversation: '한번 멈춘 대화를 먼저 다시 열었어요. 관계를 계속 이어가고 싶을 때 나타날 수 있는 행동이지만, 반복되는지 함께 보는 것이 좋아요.',
  expands_topic: '상대가 꺼낸 화제를 짧게 닫지 않고 자연스럽게 넓혔어요. 평범해 보이는 대화에서도 참여 의지를 확인할 수 있는 부분이에요.',
  includes_partner_in_future: '앞으로의 계획이나 일상 속 장면에 상대를 자연스럽게 포함했어요. 실제 일정이 구체화되는지까지 보면 의미를 더 정확히 판단할 수 있어요.',
  self_disclosure: '자신의 이야기를 한 단계 더 열어 보여줬어요. 편안함과 신뢰의 단서일 수 있지만, 이것만으로 관계의 성격을 단정하지는 않아요.',
  vulnerable_emotion_share: '쉽게 꺼내기 어려운 감정을 공유했어요. 상대를 안전하게 느끼고 있다는 단서일 수 있으므로, 해결책보다 공감으로 반응하는 편이 자연스러워요.',
  shared_context_reference: '둘만 이해할 수 있는 과거나 맥락을 다시 불러왔어요. 함께 쌓인 기억이 대화 속에서 자연스럽게 작동하는 장면이에요.',
  playful_teasing_or_nickname: '장난이나 애칭을 주고받을 만큼 편한 분위기가 드러났어요. 다만 평소 대화 습관일 수도 있어 다른 단서와 함께 보는 것이 좋아요.',
  daily_life_share: '특별한 사건이 아닌 평범한 하루를 자연스럽게 나눴어요. 작은 일상을 공유하는 빈도가 관계의 편안함을 보여줄 수 있어요.',
}

const CATEGORY_FALLBACK_COPY: Record<SignalCategory, string> = {
  romance: '호감을 짐작하게 하는 표현이 담겼어요. 이 장면 하나만으로 마음을 단정할 수는 없지만, 다른 행동과 함께 살펴볼 만한 단서예요.',
  interest: '상대에게 관심을 기울이는 행동이 담겼어요. 한 번의 표현보다 비슷한 행동이 반복되는지를 함께 보는 것이 좋아요.',
  intimacy: '두 사람 사이의 편안함이 드러났어요. 친밀함이 곧 연애 감정을 뜻하는 것은 아니므로 관계의 다른 단서와 함께 봐주세요.',
  distancing: '대화에서 거리를 두려는 듯한 표현이 보였어요. 당시 상황이나 말투의 영향일 수도 있으므로 한 장면만으로 결론 내리지는 않는 것이 좋아요.',
}

function interpretationFor(signal: ValidatedSignal): string {
  return INTERPRETATION_COPY[signal.signalType] ?? CATEGORY_FALLBACK_COPY[signal.category]
}

function truncate(text: string): string {
  const trimmed = text.trim()
  return trimmed.length > EXCERPT_MAX_LENGTH ? `${trimmed.slice(0, EXCERPT_MAX_LENGTH)}…` : trimmed
}

function toScene(signal: ValidatedSignal, messages: MessageLookup): KeyScene | null {
  const excerpts = signal.messageIds
    .map((messageId) => messages.get(messageId))
    .filter((message): message is { speakerId: string; text: string } => Boolean(message?.text.trim()))
    .slice(0, MAX_EXCERPT_MESSAGES)
    .map((message) => ({ speakerId: message.speakerId, text: truncate(message.text) }))

  const firstExcerpt = excerpts[0]
  if (!firstExcerpt) return null
  return {
    title: SCENE_TITLE[signal.signalType] ?? CATEGORY_TITLE[signal.category],
    cueLabel: CATEGORY_CUE_LABEL[signal.category],
    excerpts,
    speakerId: firstExcerpt.speakerId,
    excerpt: firstExcerpt.text,
    interpretation: interpretationFor(signal),
    signalType: signal.signalType,
    category: signal.category,
  }
}

export function selectKeyScenes(intent: AnalysisIntent, signals: ValidatedSignal[], messages: MessageLookup): KeyScene[] {
  if (signals.length === 0) return []

  const primary = selectTopSignal(intent, signals)
  const scenes: KeyScene[] = []
  const usedSignalTypes = new Set<string>()

  if (primary) {
    const scene = toScene(primary, messages)
    if (scene) {
      scenes.push(scene)
      usedSignalTypes.add(primary.signalType)
    }
  }

  if (scenes.length < MAX_SCENES) {
    const primaryCategory = primary?.category
    const ranked = rankBySalience(signals).filter((s) => !usedSignalTypes.has(s.signalType))
    // Prefer a genuinely different category first (a different "kind" of
    // story), falling back to merely a different signalType within the same
    // category if that's all the conversation offered.
    const differentCategory = ranked.find((s) => s.category !== primaryCategory)
    const candidate = differentCategory ?? ranked[0]
    const scene = candidate ? toScene(candidate, messages) : null
    if (scene) scenes.push(scene)
  }

  return scenes.slice(0, MAX_SCENES)
}
