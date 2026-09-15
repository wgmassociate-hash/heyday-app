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
  speakerId: string
  excerpt: string
  interpretation: string
  signalType: string
  category: SignalCategory
}

export type MessageLookup = Map<string, { speakerId: string; text: string }>

const MAX_SCENES = 2
const EXCERPT_MAX_LENGTH = 80

/** Short "관찰 → 의미" interpretation line per catalogued signalType
 * (server/engine/score/weights.ts). Freeform romance/distancing signalTypes
 * (LLM-invented, no fixed catalogue — signals/prompt.ts) fall back to the
 * per-category default below instead of a per-signalType entry. */
const INTERPRETATION_COPY: Record<string, string> = {
  remembers_past_detail: '이전에 나온 이야기를 기억하고 다시 확인한 행동이에요. 지속적인 관심을 보여주는 단서 중 하나예요.',
  follows_up_on_plan: '이전 약속이나 계획을 먼저 챙긴 행동이에요. 관계를 이어가려는 의지로 볼 수 있어요.',
  checks_on_feelings: '상대의 감정이나 상태를 먼저 물어본 장면이에요.',
  follow_up_question: '상대의 이야기에 후속 질문을 이어간 장면이에요.',
  specific_interest_expression: '상대에 대한 구체적인 관심을 표현한 장면이에요.',
  revives_conversation: '끊겼던 대화를 먼저 다시 이어간 장면이에요.',
  expands_topic: '상대가 꺼낸 화제를 자연스럽게 넓힌 장면이에요.',
  includes_partner_in_future: '앞으로의 계획이나 일상에 상대를 자연스럽게 포함시킨 장면이에요.',
  self_disclosure: '자기 이야기를 개방적으로 나눈 장면이에요.',
  vulnerable_emotion_share: '감정적으로 취약한 이야기를 나눈 장면이에요.',
  shared_context_reference: '둘만 아는 맥락이나 과거 일을 언급한 장면이에요.',
  playful_teasing_or_nickname: '장난이나 애칭처럼 편한 친밀함이 드러난 장면이에요.',
  daily_life_share: '개인적인 일상을 편하게 공유한 장면이에요.',
}

const CATEGORY_FALLBACK_COPY: Record<SignalCategory, string> = {
  romance: '호감을 짐작하게 하는 표현이 담긴 장면이에요. 이 장면 하나만으로 호감을 단정할 수는 없지만, 참고할 만한 단서예요.',
  interest: '상대에게 관심을 보이는 행동이 담긴 장면이에요.',
  intimacy: '편한 친밀감이 드러나는 장면이에요.',
  distancing: '거리를 두려는 듯한 표현이 담긴 장면이에요.',
}

function interpretationFor(signal: ValidatedSignal): string {
  return INTERPRETATION_COPY[signal.signalType] ?? CATEGORY_FALLBACK_COPY[signal.category]
}

function truncate(text: string): string {
  const trimmed = text.trim()
  return trimmed.length > EXCERPT_MAX_LENGTH ? `${trimmed.slice(0, EXCERPT_MAX_LENGTH)}…` : trimmed
}

function toScene(signal: ValidatedSignal, messages: MessageLookup): KeyScene | null {
  const firstMessageId = signal.messageIds[0]
  const message = firstMessageId ? messages.get(firstMessageId) : undefined
  if (!message || !message.text.trim()) return null
  return {
    speakerId: message.speakerId,
    excerpt: truncate(message.text),
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
