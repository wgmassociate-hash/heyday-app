// Phase 1 — Evidence Validator (docs/prd_v2.md §13, docs/implementation_plan_v2.md §11).
// "Evidence 없는 Signal은 Score에 반영하지 않는다" — this is the one place
// that rule is enforced. Nothing downstream (score/**) accepts a
// RelationshipSignal that hasn't been through here.
import type { EnrichedMessage } from '../messageModel/types.js'
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
