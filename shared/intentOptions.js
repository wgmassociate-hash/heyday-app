/** Analysis Intent options (docs/prd_v2.md §4, docs/implementation_plan_v2.md
 * §20 Phase 2 "Intent 선택 UI"). Single source of truth shared across the
 * frontend Intent-selection UI (src/components/IntentStep.jsx), the
 * /api/preview route's request validation (server/index.js), and
 * server/engine/intent/types.ts (which derives the AnalysisIntent TS union
 * from this list instead of hand-duplicating the values — see that file's
 * comment for why this is a deliberate second JS/TS boundary crossing beyond
 * the one §5.1 originally described).
 *
 * Intent does not change any Score Engine number (docs/prd_v2.md §3's "LLM은
 * 최종 점수를 만들지 않는다" extends here too — Intent isn't LLM output, but
 * the same principle applies: it only re-prioritizes which already-computed
 * Evidence is surfaced first, never recomputes Core4/Temperature/Romance).
 */
export const INTENT_OPTIONS = [
  { value: 'romantic_interest', emoji: '💘', label: '얘 나한테 관심 있어?' },
  { value: 'relationship_change', emoji: '🌡️', label: '요즘 우리 사이가 달라진 것 같아' },
  { value: 'imbalance', emoji: '⚖️', label: '나만 더 좋아하는 것 같아' },
  { value: 'conversation_meaning', emoji: '💬', label: '이 대화 무슨 의미야?' },
  { value: 'relationship_definition', emoji: '👀', label: '우리 무슨 사이 같아?' },
  { value: 'friendship_change', emoji: '👯', label: '친구인데 요즘 좀 이상해' },
]

export const INTENT_VALUES = INTENT_OPTIONS.map((option) => option.value)

export function isValidIntent(value) {
  return INTENT_VALUES.includes(value)
}
