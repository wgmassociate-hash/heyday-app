// Phase 1 / 1.1 — Signal Extraction Schema (docs/implementation_plan_v2.md §15.1).
// No numeric fields anywhere — see signals/types.ts for why.
import { z } from 'zod'

// Phase 1.1: 'reciprocity' removed — see reciprocityTypes.ts / ReciprocityPairSchema.
export const SignalCategorySchema = z.enum(['interest', 'intimacy', 'romance', 'distancing'])
export const SignalDirectionSchema = z.enum(['positive', 'neutral', 'negative'])

export const RelationshipSignalSchema = z.object({
  signalType: z.string(),
  category: SignalCategorySchema,
  direction: SignalDirectionSchema,
  actorSpeakerId: z.string(),
  // Required (not .optional()) rather than following the PRD sketch's
  // omission from `required` — Anthropic's structured-output mode wants
  // every property populated; Phase 0 hit a hard "too many optional
  // parameters" API rejection doing this the other way (analyzeSchema.ts).
  // An empty string means "no specific target" (e.g. a self-directed signal).
  targetSpeakerId: z.string(),
  messageIds: z.array(z.string()).min(1).max(5),
  reason: z.string().max(300),
})

export const ReciprocityPairTypeSchema = z.enum([
  'question_response',
  'mutual_disclosure',
  'emotional_empathy',
  'joke_reciprocation',
  'plan_response',
  'topic_expansion',
])

// Phase 1.1: a ReciprocityPair must name both sides of the exchange —
// `triggerMessageIds` (what the initiator said) and `responseMessageIds`
// (how the responder reacted) — so evidenceValidator.ts can check the claim
// is real (ordering, distinct speakers, adjacency) instead of trusting a
// standalone "this was a reciprocity signal" label.
export const ReciprocityPairSchema = z.object({
  pairType: ReciprocityPairTypeSchema,
  initiatorSpeakerId: z.string(),
  responderSpeakerId: z.string(),
  triggerMessageIds: z.array(z.string()).min(1).max(5),
  responseMessageIds: z.array(z.string()).min(1).max(5),
  reason: z.string().max(300),
})

export const SignalExtractionResponseSchema = z.object({
  relationType: z.enum(['romantic', 'friendship', 'work', 'family', 'ambiguous']),
  signals: z.array(RelationshipSignalSchema).max(60),
  reciprocityPairs: z.array(ReciprocityPairSchema).max(40),
})

export type SignalExtractionResponse = z.infer<typeof SignalExtractionResponseSchema>
