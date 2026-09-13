// Phase 1 / 1.1 — canonical signalType catalogue + fixed code weights
// (docs/prd_v2.md §8.1/§8.3/§8.4, docs/implementation_plan_v2.md §9.5).
//
// This is the single source of truth for which signalType/pairType strings
// the LLM Signal Extractor is instructed to use (signals/prompt.ts renders
// this into the system prompt) and how much each one is worth
// (score/core4.ts, score/reciprocity.ts). Weights are product heuristics,
// not measured facts — validated by invariant tests, not an assumed-correct
// ground truth. Expect these to move.
//
// Initiative (now `conversationInitiationRatio`, see score/types.ts) is
// deliberately NOT represented here: it's Code-only (turnInitiationCounts),
// and the Evidence Model has no category to put an LLM signal for it in.
//
// Reciprocity (Phase 1.1) moved OFF this per-signalType weight mechanism —
// see RECIPROCITY_PAIR_CONFIG below, which weights ReciprocityPair.pairType
// instead of a RelationshipSignal.signalType, because reciprocity now
// requires a validated trigger/response link rather than a standalone label.
//
// Romance and Distancing are handled differently again (score/romance.ts):
// every positive `category: "romance"` signal counts equally toward one
// pooled rate, and every `category: "distancing"` signal toward another —
// no per-signalType weight table.
import type { OpportunityCounts } from '../features/types.js'
import type { SignalCategory } from '../signals/types.js'
import type { ReciprocityPairType } from '../signals/reciprocityTypes.js'

export const WEIGHTS_VERSION = 'core4-v3-null-aware'

export interface SignalTypeConfig {
  signalType: string
  category: SignalCategory
  weight: number
  opportunityKind: keyof OpportunityCounts
  /** Short Korean description rendered into the LLM system prompt. */
  description: string
}

export const INTEREST_SIGNAL_CONFIG: SignalTypeConfig[] = [
  { signalType: 'follow_up_question', category: 'interest', weight: 25, opportunityKind: 'targetMessageCount', description: '상대 이야기에 대한 후속 질문' },
  { signalType: 'remembers_past_detail', category: 'interest', weight: 20, opportunityKind: 'targetMessageCount', description: '이전에 상대가 한 이야기를 기억하고 재언급함' },
  { signalType: 'checks_on_feelings', category: 'interest', weight: 15, opportunityKind: 'targetMessageCount', description: '상대의 감정·상태를 확인함' },
  { signalType: 'expands_topic', category: 'interest', weight: 15, opportunityKind: 'targetMessageCount', description: '상대가 꺼낸 대화 주제를 확장함' },
  { signalType: 'revives_conversation', category: 'interest', weight: 10, opportunityKind: 'restartOpportunityCount', description: '끊긴 대화를 자발적으로 다시 이어감' },
  { signalType: 'specific_interest_expression', category: 'interest', weight: 10, opportunityKind: 'targetMessageCount', description: '상대에 대한 구체적인 관심을 표현함' },
  { signalType: 'follows_up_on_plan', category: 'interest', weight: 5, opportunityKind: 'targetMessageCount', description: '이전 계획·약속을 먼저 후속 확인함' },
]

export const INTIMACY_SIGNAL_CONFIG: SignalTypeConfig[] = [
  { signalType: 'self_disclosure', category: 'intimacy', weight: 25, opportunityKind: 'actorMessageCount', description: '자기 자신에 대해 개방적으로 이야기함' },
  { signalType: 'vulnerable_emotion_share', category: 'intimacy', weight: 20, opportunityKind: 'actorMessageCount', description: '감정적으로 취약한 이야기를 나눔' },
  { signalType: 'daily_life_share', category: 'intimacy', weight: 15, opportunityKind: 'actorMessageCount', description: '개인적인 일상을 공유함' },
  { signalType: 'shared_context_reference', category: 'intimacy', weight: 15, opportunityKind: 'actorMessageCount', description: '둘만 아는 맥락·과거 사건을 언급함' },
  { signalType: 'playful_teasing_or_nickname', category: 'intimacy', weight: 10, opportunityKind: 'actorMessageCount', description: '장난·놀림·애칭 등 친밀한 언어를 사용함' },
  { signalType: 'includes_partner_in_future', category: 'intimacy', weight: 15, opportunityKind: 'actorMessageCount', description: '미래 계획이나 개인적 상황에 상대를 포함시킴' },
]

export const ALL_SCORED_SIGNAL_CONFIG: SignalTypeConfig[] = [
  ...INTEREST_SIGNAL_CONFIG,
  ...INTIMACY_SIGNAL_CONFIG,
]

export interface ReciprocityPairDescription {
  pairType: ReciprocityPairType
  description: string
}

/** Full catalogue of all 6 pairTypes, for the LLM prompt (signals/prompt.ts)
 * — the model is asked to extract `topic_expansion` pairs too (for Evidence),
 * even though RECIPROCITY_PAIR_CONFIG below excludes it from scoring. */
export const RECIPROCITY_PAIR_CATALOGUE: ReciprocityPairDescription[] = [
  { pairType: 'question_response', description: '질문에 구체적으로 답하거나 역질문함' },
  { pairType: 'mutual_disclosure', description: '자기개방에 자기개방으로 화답함' },
  { pairType: 'emotional_empathy', description: '감정 표현에 공감·질문으로 반응함' },
  { pairType: 'joke_reciprocation', description: '농담·장난에 농담으로 반응함' },
  { pairType: 'plan_response', description: '약속 제안을 수용하거나 대안을 제시함' },
  { pairType: 'topic_expansion', description: '상대가 꺼낸 화제 제시에 확장으로 반응함 (참고용 Evidence로만 수집 — 점수에는 반영되지 않음)' },
]

export interface ReciprocityPairConfig {
  pairType: ReciprocityPairType
  weight: number
  description: string
  /** Which LLM-detected intimacy signalType (if any) doubles as the
   * "trigger opportunity" count for this pairType — see
   * score/reciprocity.ts's computePairOpportunity(). `null` means the
   * opportunity is a Code-only structural proxy instead (features/types.ts). */
  triggerSignalType: string | null
}

/**
 * Phase 1.2 (audit finding #5): `topic_expansion` is excluded here.
 * Its only available opportunity denominator (initiator's total message
 * count, computePairOpportunity()) is conceptually wrong — it isn't "how
 * many times did the initiator introduce a new topic", just "how many
 * messages did they send at all", which makes the resulting rate
 * meaningless as a reciprocity measure. The pairType is still extracted and
 * evidence-validated (evidenceValidator.ts, reciprocityTypes.ts) so it can
 * be shown as Evidence or reintroduced later — TODO(Phase 2+): once a real
 * "introduces a new topic" trigger signalType is defined, add
 * `topic_expansion` back here with a proper opportunity and re-normalize.
 *
 * Weights below are the original 6-pairType weights (30/20/20/10/10)
 * proportionally rescaled from 90 to sum to 100, rounded to whole numbers
 * (the largest, question_response, absorbs the +1 rounding remainder).
 */
export const RECIPROCITY_PAIR_CONFIG: ReciprocityPairConfig[] = [
  {
    pairType: 'question_response',
    weight: 34,
    description: '질문에 구체적으로 답하거나 역질문함',
    triggerSignalType: null, // Code proxy: initiator's question-mark-containing message count
  },
  {
    pairType: 'mutual_disclosure',
    weight: 22,
    description: '자기개방에 자기개방으로 화답함',
    triggerSignalType: 'self_disclosure',
  },
  {
    pairType: 'emotional_empathy',
    weight: 22,
    description: '감정 표현에 공감·질문으로 반응함',
    triggerSignalType: 'vulnerable_emotion_share',
  },
  {
    pairType: 'joke_reciprocation',
    weight: 11,
    description: '농담·장난에 농담으로 반응함',
    triggerSignalType: 'playful_teasing_or_nickname',
  },
  {
    pairType: 'plan_response',
    weight: 11,
    description: '약속 제안을 수용하거나 대안을 제시함',
    triggerSignalType: null, // Code proxy: initiator's plan-proposal-pattern message count
  },
]
