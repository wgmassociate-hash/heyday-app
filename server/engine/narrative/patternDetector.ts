// Phase 2.4 item 8 — "AI가 발견한 관계 패턴 2~4개". This is the Phase's
// centerpiece: combining validated signals + reciprocity pairs + Core4 into
// several distinct, evidence-grounded observations instead of one generic
// line. Every detector below either cites something actually present in
// `validatedSignals`/`reciprocityPairs`/`core4Preview`, or is one of the two
// guaranteed structural fallbacks (initiation, expansion) that are always
// truthful because they're built straight from Code features that exist for
// every conversation. No detector invents a fact not backed by its inputs
// (spec: "근거 없는 패턴을 생성하지 않는다").
import type { ValidatedReciprocityPair } from '../signals/reciprocityTypes.js'
import type { ValidatedSignal } from '../signals/types.js'
import type { Core4Result, RomanceResult } from '../score/types.js'

export interface RelationshipPattern {
  key: string
  text: string
}

// Guaranteed floor of 2 patterns comes from initiationPattern/expansionPattern
// below, which never return null — see their own comments.
const MAX_PATTERNS = 4
const INITIATION_GAP_THRESHOLD = 0.15

function countBySignalType(signals: ValidatedSignal[], types: string[]): number {
  return signals.filter((s) => types.includes(s.signalType) && s.direction === 'positive').length
}

function dominantSpeaker(signals: ValidatedSignal[], types: string[]): '나' | '상대방' | null {
  const selfCount = signals.filter((s) => types.includes(s.signalType) && s.actorSpeakerId === '나').length
  const otherCount = signals.filter((s) => types.includes(s.signalType) && s.actorSpeakerId === '상대방').length
  if (selfCount === 0 && otherCount === 0) return null
  if (selfCount === otherCount) return null
  return selfCount > otherCount ? '나' : '상대방'
}

function memoryPattern(signals: ValidatedSignal[]): RelationshipPattern | null {
  const types = ['remembers_past_detail', 'follows_up_on_plan']
  if (countBySignalType(signals, types) === 0) return null
  const who = dominantSpeaker(signals, types)
  const subject = who === '나' ? '당신이' : who === '상대방' ? '상대가' : '두 사람이'
  return { key: 'memory', text: `${subject} 이전에 나눈 이야기를 기억하고 다시 묻는 장면이 있어요.` }
}

function romanceSignalPattern(romance: RomanceResult): RelationshipPattern | null {
  if (romance.distancingCount > romance.positiveCount && romance.distancingCount > 0) {
    return { key: 'romance', text: '호감 신호보다는 거리를 두려는 듯한 표현이 조금 더 눈에 띄어요.' }
  }
  if (romance.positiveCount > 0) {
    return { key: 'romance', text: '호감을 짐작하게 하는 표현이 대화 속에 섞여 있어요.' }
  }
  return null
}

const EMOTIONAL_INTIMACY_TYPES = ['self_disclosure', 'vulnerable_emotion_share']
const PLAYFUL_INTIMACY_TYPES = ['playful_teasing_or_nickname', 'shared_context_reference', 'daily_life_share']

function intimacyStylePattern(signals: ValidatedSignal[]): RelationshipPattern | null {
  const emotional = countBySignalType(signals, EMOTIONAL_INTIMACY_TYPES)
  const playful = countBySignalType(signals, PLAYFUL_INTIMACY_TYPES)
  if (emotional === 0 && playful === 0) return null
  if (emotional >= playful) {
    return { key: 'intimacy_style', text: '두 사람은 장난보다는 감정이나 자기 이야기를 나누는 방식으로 친밀감을 쌓아가는 편이에요.' }
  }
  return { key: 'intimacy_style', text: '두 사람은 감정 표현보다는 장난과 공동 관심사로 친밀감을 만드는 편이에요.' }
}

const INTEREST_EXPRESSION_TYPES = ['follow_up_question', 'checks_on_feelings', 'specific_interest_expression']

function interestExpressionPattern(signals: ValidatedSignal[]): RelationshipPattern | null {
  if (countBySignalType(signals, INTEREST_EXPRESSION_TYPES) === 0) return null
  const who = dominantSpeaker(signals, INTEREST_EXPRESSION_TYPES)
  const subject = who === '상대방' ? '상대는' : '당신은'
  return { key: 'interest_expression', text: `${subject} 상대의 말에 후속 질문을 이어가거나 감정을 챙기는 행동이 보여요.` }
}

const RECIPROCITY_HIGH = 60
const RECIPROCITY_LOW = 30

function reciprocityStylePattern(reciprocity: Core4Result['reciprocity']): RelationshipPattern | null {
  if (reciprocity.score === null || reciprocity.confidence === 'insufficient') return null
  if (reciprocity.score >= RECIPROCITY_HIGH) {
    return { key: 'reciprocity_style', text: '질문이나 감정 표현에 서로 잘 반응해주는 편이에요.' }
  }
  if (reciprocity.score < RECIPROCITY_LOW) {
    return { key: 'reciprocity_style', text: '아직은 한쪽이 조금 더 반응을 이끌어가는 편이에요.' }
  }
  return null
}

/** Guaranteed non-null (always has something truthful to say from Code
 * alone) — one of the two structural fallbacks that keep the total count at
 * MIN_PATTERNS even when the LLM signal catalogue above stayed quiet. */
function initiationPattern(core4: Core4Result): RelationshipPattern {
  const self = core4.conversationInitiationRatio.ratioBySpeaker['나'] ?? 0.5
  const other = core4.conversationInitiationRatio.ratioBySpeaker['상대방'] ?? 0.5
  const gap = self - other
  if (Math.abs(gap) < INITIATION_GAP_THRESHOLD) {
    return { key: 'initiation', text: '대화 시작은 두 사람이 비슷하게 나눠서 하는 편이에요.' }
  }
  return gap > 0
    ? { key: 'initiation', text: '당신이 먼저 대화를 여는 장면이 조금 더 많아요.' }
    : { key: 'initiation', text: '상대가 먼저 대화를 여는 장면이 조금 더 많아요.' }
}

const PLAN_PAIR_TYPES = ['plan_response']
const EXPANSION_ROMANCE_HINT_TYPES = ['plan_response']

/** The other guaranteed fallback — truthful either way (present or absent),
 * since "확장 행동이 아직 많지 않다" is itself a real, evidence-grounded
 * observation (spec §12's own second example is exactly this kind of line).*/
function expansionPattern(pairs: ValidatedReciprocityPair[], signals: ValidatedSignal[]): RelationshipPattern {
  const hasPlanPair = pairs.some((p) => PLAN_PAIR_TYPES.includes(p.pairType))
  const hasPlanSignal = signals.some((s) => s.direction === 'positive' && EXPANSION_ROMANCE_HINT_TYPES.includes(s.signalType))
  if (hasPlanPair || hasPlanSignal) {
    return { key: 'expansion', text: '대화가 실제 약속이나 다음 행동으로 이어지는 장면이 있어요.' }
  }
  return { key: 'expansion', text: '대화는 자연스럽지만 만남이나 다음 행동으로 확장되는 장면은 아직 많지 않아요.' }
}

export function buildRelationshipPatterns(input: {
  validatedSignals: ValidatedSignal[]
  reciprocityPairs: ValidatedReciprocityPair[]
  core4Preview: Core4Result
  recentRomanceSignal: RomanceResult
}): RelationshipPattern[] {
  const { validatedSignals, reciprocityPairs, core4Preview, recentRomanceSignal } = input

  const ranked = [
    memoryPattern(validatedSignals),
    romanceSignalPattern(recentRomanceSignal),
    intimacyStylePattern(validatedSignals),
    interestExpressionPattern(validatedSignals),
    reciprocityStylePattern(core4Preview.reciprocity),
  ].filter((p): p is RelationshipPattern => p !== null)

  const guaranteed = [initiationPattern(core4Preview), expansionPattern(reciprocityPairs, validatedSignals)]

  const seenText = new Set<string>()
  const patterns: RelationshipPattern[] = []
  for (const candidate of [...ranked, ...guaranteed]) {
    if (patterns.length >= MAX_PATTERNS) break
    if (seenText.has(candidate.text)) continue
    seenText.add(candidate.text)
    patterns.push(candidate)
  }

  // ranked entries are evidence-grounded and always preferred, but the floor
  // of 2 must hold even if fewer than 2 ranked detectors fired — guaranteed[]
  // above is appended last for exactly that reason, so `patterns` is already
  // length-bounded to [2, MAX_PATTERNS].
  return patterns
}
