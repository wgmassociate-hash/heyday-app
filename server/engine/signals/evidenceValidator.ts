// Phase 1 / 1.1 — Evidence Validator (docs/prd_v2.md §13, docs/implementation_plan_v2.md §11).
// "Evidence 없는 Signal은 Score에 반영하지 않는다" — this is the one place
// that rule is enforced. Nothing downstream (score/**) accepts a
// RelationshipSignal (or, since Phase 1.1, a ReciprocityPair) that hasn't
// been through here.
import type { EnrichedMessage } from '../messageModel/types.js'
import type { ReciprocityPair, ValidatedReciprocityPair } from './reciprocityTypes.js'
import type { RelationshipSignal, ValidatedSignal } from './types.js'

export interface ValidationRejection {
  signal: RelationshipSignal
  reason:
    | 'empty_message_ids'
    | 'unknown_message_id'
    | 'unknown_actor_speaker'
    | 'unknown_target_speaker'
    | 'actor_equals_target'
}

export interface ValidationResult {
  validated: ValidatedSignal[]
  rejected: ValidationRejection[]
}

function validateOne(
  signal: RelationshipSignal,
  messageById: Map<string, EnrichedMessage>,
  knownSpeakerIds: Set<string>,
): ValidationRejection | null {
  if (signal.messageIds.length === 0) return { signal, reason: 'empty_message_ids' }
  for (const id of signal.messageIds) {
    if (!messageById.has(id)) return { signal, reason: 'unknown_message_id' }
  }
  if (!knownSpeakerIds.has(signal.actorSpeakerId)) {
    return { signal, reason: 'unknown_actor_speaker' }
  }
  if (signal.targetSpeakerId && !knownSpeakerIds.has(signal.targetSpeakerId)) {
    return { signal, reason: 'unknown_target_speaker' }
  }
  if (signal.targetSpeakerId && signal.targetSpeakerId === signal.actorSpeakerId) {
    return { signal, reason: 'actor_equals_target' }
  }
  return null
}

/** Two signals are the same observation if they agree on everything that
 * matters for scoring — same type/category/direction/actor pointing at the
 * same evidence. Chunk overlap (docs/implementation_plan_v2.md §16.2's
 * `selectPreviewWindow` re-processing at Stage2, or plain chunk overlap) can
 * otherwise double-count one real event. */
function dedupeKey(signal: RelationshipSignal): string {
  const sortedIds = [...signal.messageIds].sort().join(',')
  return [signal.signalType, signal.category, signal.direction, signal.actorSpeakerId, signal.targetSpeakerId ?? '', sortedIds].join('|')
}

export function validateSignals(
  rawSignals: RelationshipSignal[],
  messages: EnrichedMessage[],
  chunkId: string,
): ValidationResult {
  const messageById = new Map(messages.map((m) => [m.id, m]))
  const knownSpeakerIds = new Set(messages.map((m) => m.speakerId))

  const validated: ValidatedSignal[] = []
  const rejected: ValidationRejection[] = []

  for (const signal of rawSignals) {
    const rejection = validateOne(signal, messageById, knownSpeakerIds)
    if (rejection) {
      rejected.push(rejection)
      continue
    }
    validated.push({ ...signal, chunkId })
  }

  return { validated, rejected }
}

/** Merges ValidatedSignal[] from multiple chunks/stages, collapsing exact
 * duplicates (see dedupeKey) into one — keeps the first occurrence. */
export function mergeDuplicates(signals: ValidatedSignal[]): ValidatedSignal[] {
  const seen = new Set<string>()
  const merged: ValidatedSignal[] = []
  for (const signal of signals) {
    const key = dedupeKey(signal)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(signal)
  }
  return merged
}

// ---------------------------------------------------------------------------
// Phase 1.1 — ReciprocityPair validation (Score Calibration audit finding #3)
// ---------------------------------------------------------------------------

export interface PairValidationRejection {
  pair: ReciprocityPair
  reason:
    | 'empty_trigger_or_response'
    | 'unknown_message_id'
    | 'unknown_speaker'
    | 'same_speaker'
    | 'invalid_order'
    | 'out_of_range'
}

export interface PairValidationResult {
  validated: ValidatedReciprocityPair[]
  rejected: PairValidationRejection[]
}

/** How far apart (in message count) a trigger and its response may be and
 * still count as one exchange, and whether crossing a session boundary is
 * allowed at all. Tunable placeholder, same spirit as enrich.ts's
 * RESTART_GAP_MINUTES/SESSION_GAP_MINUTES. */
const MAX_PAIR_MESSAGE_GAP = 20

function validateOnePair(
  pair: ReciprocityPair,
  indexById: Map<string, number>,
  sessionById: Map<string, string | undefined>,
  knownSpeakerIds: Set<string>,
): PairValidationRejection | null {
  if (pair.triggerMessageIds.length === 0 || pair.responseMessageIds.length === 0) {
    return { pair, reason: 'empty_trigger_or_response' }
  }
  for (const id of [...pair.triggerMessageIds, ...pair.responseMessageIds]) {
    if (!indexById.has(id)) return { pair, reason: 'unknown_message_id' }
  }
  if (!knownSpeakerIds.has(pair.initiatorSpeakerId) || !knownSpeakerIds.has(pair.responderSpeakerId)) {
    return { pair, reason: 'unknown_speaker' }
  }
  if (pair.initiatorSpeakerId === pair.responderSpeakerId) {
    return { pair, reason: 'same_speaker' }
  }

  const triggerIndexes = pair.triggerMessageIds.map((id) => indexById.get(id) as number)
  const responseIndexes = pair.responseMessageIds.map((id) => indexById.get(id) as number)
  const lastTriggerIndex = Math.max(...triggerIndexes)
  const firstResponseIndex = Math.min(...responseIndexes)

  // Time order: every response message must come strictly after every
  // trigger message.
  if (firstResponseIndex <= lastTriggerIndex) {
    return { pair, reason: 'invalid_order' }
  }

  const gap = firstResponseIndex - lastTriggerIndex
  const lastTriggerId = pair.triggerMessageIds[triggerIndexes.indexOf(lastTriggerIndex)]
  const firstResponseId = pair.responseMessageIds[responseIndexes.indexOf(firstResponseIndex)]
  const sameSession = sessionById.get(lastTriggerId) === sessionById.get(firstResponseId)

  if (gap > MAX_PAIR_MESSAGE_GAP || !sameSession) {
    return { pair, reason: 'out_of_range' }
  }

  return null
}

export function validateReciprocityPairs(
  rawPairs: ReciprocityPair[],
  messages: EnrichedMessage[],
  chunkId: string,
): PairValidationResult {
  const indexById = new Map(messages.map((m, i) => [m.id, i]))
  const sessionById = new Map(messages.map((m) => [m.id, m.sessionId]))
  const knownSpeakerIds = new Set(messages.map((m) => m.speakerId))

  const validated: ValidatedReciprocityPair[] = []
  const rejected: PairValidationRejection[] = []

  for (const pair of rawPairs) {
    const rejection = validateOnePair(pair, indexById, sessionById, knownSpeakerIds)
    if (rejection) {
      rejected.push(rejection)
      continue
    }
    validated.push({ ...pair, chunkId })
  }

  return { validated, rejected }
}

function pairDedupeKey(pair: ReciprocityPair): string {
  const triggerIds = [...pair.triggerMessageIds].sort().join(',')
  const responseIds = [...pair.responseMessageIds].sort().join(',')
  return [pair.pairType, pair.initiatorSpeakerId, pair.responderSpeakerId, triggerIds, responseIds].join('|')
}

/** Same purpose as mergeDuplicates(), for ReciprocityPair[] — collapses a
 * pair re-extracted from an overlapping chunk. */
export function mergeDuplicatePairs(pairs: ValidatedReciprocityPair[]): ValidatedReciprocityPair[] {
  const seen = new Set<string>()
  const merged: ValidatedReciprocityPair[] = []
  for (const pair of pairs) {
    const key = pairDedupeKey(pair)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(pair)
  }
  return merged
}
