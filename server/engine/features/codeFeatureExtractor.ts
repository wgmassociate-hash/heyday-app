// Phase 1 — Code Feature Extractor (docs/implementation_plan_v2.md §8.2, §9).
// Pure counting over EnrichedMessage[]. No LLM SDK import allowed in this
// directory — enforced by server/engine/importBoundary.test.ts (§10.2).
import type { EnrichedMessage } from '../messageModel/types.js'
import { TOPIC_RULES } from './topicRules.js'
import type { CodeFeatures, OpportunityCounts, ReplyGapStat, TopicHit } from './types.js'

const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/u
const QUESTION_PATTERN = /[?？]/

function speakerIdsOf(messages: EnrichedMessage[]): string[] {
  const seen: string[] = []
  for (const m of messages) {
    if (!seen.includes(m.speakerId)) seen.push(m.speakerId)
  }
  return seen
}

function computeReplyGapStats(messages: EnrichedMessage[], speakerIds: string[]) {
  const bySpeaker: Record<string, ReplyGapStat> = {}
  for (const id of speakerIds) bySpeaker[id] = { avgMinutes: null, sampleCount: 0 }

  const sums: Record<string, number> = {}
  for (const m of messages) {
    if (m.responseDelaySec == null) continue
    const stat = bySpeaker[m.speakerId]
    sums[m.speakerId] = (sums[m.speakerId] ?? 0) + m.responseDelaySec / 60
    stat.sampleCount += 1
  }
  for (const id of speakerIds) {
    if (bySpeaker[id].sampleCount > 0) {
      bySpeaker[id].avgMinutes = sums[id] / bySpeaker[id].sampleCount
    }
  }
  return bySpeaker
}

function computeTopicHits(messages: EnrichedMessage[]): TopicHit[] {
  const allText = messages.map((m) => m.text).join('\n')
  return TOPIC_RULES.map(({ id, label, pattern }) => {
    const globalFlags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
    return {
      id,
      label,
      count: allText.match(new RegExp(pattern.source, globalFlags))?.length ?? 0,
    }
  }).filter((t) => t.count > 0)
}

/** Restart opportunities: every non-first gap point that reached
 * enrich.ts's RESTART_GAP_MINUTES threshold — i.e. every message that came
 * back as isConversationStart (excluding the very first message) or
 * isConversationRestart. Shared across both directions of a pair. */
function computeRestartOpportunityCount(messages: EnrichedMessage[]): number {
  let count = 0
  for (let i = 0; i < messages.length; i++) {
    if (i === 0) continue
    if (messages[i].isConversationStart || messages[i].isConversationRestart) count += 1
  }
  return count
}

export function extractCodeFeatures(messages: EnrichedMessage[]): CodeFeatures {
  const speakerIds = speakerIdsOf(messages)

  const messageCountBySpeaker: Record<string, number> = {}
  const turnInitiationCounts: Record<string, number> = {}
  const emojiCountBySpeaker: Record<string, number> = {}
  const questionMessageCountBySpeaker: Record<string, number> = {}
  for (const id of speakerIds) {
    messageCountBySpeaker[id] = 0
    turnInitiationCounts[id] = 0
    emojiCountBySpeaker[id] = 0
    questionMessageCountBySpeaker[id] = 0
  }

  for (const m of messages) {
    messageCountBySpeaker[m.speakerId] += 1
    if (m.isConversationStart || m.isConversationRestart) turnInitiationCounts[m.speakerId] += 1
    if (EMOJI_PATTERN.test(m.text)) emojiCountBySpeaker[m.speakerId] += 1
    if (QUESTION_PATTERN.test(m.text)) questionMessageCountBySpeaker[m.speakerId] += 1
  }

  const emojiRatioBySpeaker: Record<string, number> = {}
  for (const id of speakerIds) {
    emojiRatioBySpeaker[id] = messageCountBySpeaker[id] > 0
      ? emojiCountBySpeaker[id] / messageCountBySpeaker[id]
      : 0
  }

  return {
    speakerIds,
    messageCountBySpeaker,
    turnInitiationCounts,
    replyGapStatsBySpeaker: computeReplyGapStats(messages, speakerIds),
    emojiRatioBySpeaker,
    questionMessageCountBySpeaker,
    topicHits: computeTopicHits(messages),
    sessionCount: new Set(messages.map((m) => m.sessionId).filter(Boolean)).size,
    restartOpportunityCount: computeRestartOpportunityCount(messages),
  }
}

/**
 * Opportunity denominators for one (actor, target) direction of a pair —
 * the input `computeIndividualScore()` (score/core4.ts) needs per signalType
 * (§9.3). `pairOpportunityCount` uses `target`'s question-like messages as a
 * code-only proxy for "how many times did the target hand the actor a chance
 * to reciprocate" (§9.2) — a coarse approximation, not the same thing as an
 * LLM-detected reciprocity signal.
 */
export function computeOpportunities(
  features: CodeFeatures,
  actorSpeakerId: string,
  targetSpeakerId: string,
): OpportunityCounts {
  return {
    actorMessageCount: features.messageCountBySpeaker[actorSpeakerId] ?? 0,
    targetMessageCount: features.messageCountBySpeaker[targetSpeakerId] ?? 0,
    restartOpportunityCount: features.restartOpportunityCount,
    pairOpportunityCount: features.questionMessageCountBySpeaker[targetSpeakerId] ?? 0,
  }
}
