// Phase 1 — canonical signalType catalogue + fixed code weights
// (docs/prd_v2.md §8.1/§8.3/§8.4, docs/implementation_plan_v2.md §9.5).
//
// This is the single source of truth for which signalType strings the LLM
// Signal Extractor is instructed to use (signals/prompt.ts renders this list
// into the system prompt) and how much each one is worth (score/core4.ts).
// Weights are product heuristics, not measured facts — see
// docs/implementation_plan_v2.md §19.2/§21 row 4: validated by invariant
// tests, not by an assumed-correct ground truth. Expect these to move.
//
// Initiative is deliberately NOT represented here: docs/implementation_plan_v2.md
// §9.5 marks it "Code 입력 — 순수 코드" and its ratio comes straight from
// features/codeFeatureExtractor.ts's turnInitiationCounts. The Evidence Model
// (docs/prd_v2.md §13) also has no "initiative" category to put an LLM signal
// in, so giving Initiative its own weighted LLM signals would need a category
// the schema doesn't have — this is a scope decision, not an oversight.
//
// Romance and Distancing are handled differently again (score/romance.ts):
// every positive `category: "romance"` signal counts equally toward one
// pooled rate, and every `category: "distancing"` signal counts equally
// toward another — no per-signalType weight table, matching
// docs/implementation_plan_v2.md §14.1's computeRomanceScore().
import type { OpportunityCounts } from '../features/types.js'
import type { SignalCategory } from '../signals/types.js'

export const WEIGHTS_VERSION = 'core4-v1'

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

export const RECIPROCITY_SIGNAL_CONFIG: SignalTypeConfig[] = [
  { signalType: 'question_answered_or_reciprocated', category: 'reciprocity', weight: 30, opportunityKind: 'pairOpportunityCount', description: '질문에 구체적으로 답하거나 역질문함' },
  { signalType: 'mutual_self_disclosure', category: 'reciprocity', weight: 20, opportunityKind: 'pairOpportunityCount', description: '자기개방에 자기개방으로 화답함' },
  { signalType: 'empathy_response_to_emotion', category: 'reciprocity', weight: 20, opportunityKind: 'pairOpportunityCount', description: '감정 표현에 공감·질문으로 반응함' },
  { signalType: 'joke_reciprocated', category: 'reciprocity', weight: 10, opportunityKind: 'pairOpportunityCount', description: '농담에 농담으로 반응함' },
  { signalType: 'plan_accepted_or_countered', category: 'reciprocity', weight: 10, opportunityKind: 'pairOpportunityCount', description: '약속 제안을 수용하거나 대안을 제시함' },
  { signalType: 'topic_expanded_by_partner', category: 'reciprocity', weight: 10, opportunityKind: 'pairOpportunityCount', description: '상대가 꺼낸 화제 제시에 확장으로 반응함' },
]

export const ALL_SCORED_SIGNAL_CONFIG: SignalTypeConfig[] = [
  ...INTEREST_SIGNAL_CONFIG,
  ...INTIMACY_SIGNAL_CONFIG,
  ...RECIPROCITY_SIGNAL_CONFIG,
]
