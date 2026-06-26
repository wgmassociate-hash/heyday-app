/** @typedef {'romantic'|'friendship'|'work'|'family'|'ambiguous'} RelationType */
/** @typedef {'approach'|'tension'|'warmth'|'distance'|'confession'|'humor'|'turning_point'} MomentType */

/**
 * @typedef {object} AnalysisResult
 * @property {number} totalScore
 * @property {RelationType} relationType
 * @property {string} relationTag
 * @property {string} scoreLabel
 * @property {string} reportTitle
 * @property {string} solutionTitle
 * @property {string} dominance
 * @property {object} dominanceDetail
 * @property {string[]} detectedTopics
 * @property {string} psychologySummary
 * @property {string} aiSummary
 * @property {string} solution
 * @property {object} metrics
 * @property {object} deepMetrics
 * @property {object[]} affectionTimeline
 * @property {object[]} criticalMoments
 * @property {number} messageCount
 * @property {string} [source]
 */

export const DEFAULT_DEEP_METRICS = {
  textMirroring: {
    score: 50,
    label: '텍스트 미러링',
    interpretation: '상대의 말투·표현을 따라 하는 정도를 측정합니다.',
    evidence: [],
  },
  replySpeedAsymmetry: {
    asymmetryScore: 50,
    label: '답장 속도 비대칭성',
    fasterSide: '인물A',
    slowerSide: '인물B',
    gapRatio: '1:1',
    interpretation: '누가 더 빠르게 답장하는지의 격차입니다.',
  },
}

export const MOMENT_TYPE_LABELS = {
  approach: { label: '관심 신호', color: 'brand', icon: '👀' },
  tension: { label: '긴장·밀당', color: 'amber', icon: '⚡' },
  warmth: { label: '온기·친밀', color: 'rose', icon: '🔥' },
  distance: { label: '거리두기', color: 'slate', icon: '🧊' },
  confession: { label: '감정 표출', color: 'violet', icon: '💗' },
  humor: { label: '유머·편안함', color: 'sky', icon: '😂' },
  turning_point: { label: '관계 전환점', color: 'emerald', icon: '🔄' },
}

/**
 * @param {object} raw
 */
export function normalizeDeepAnalysis(raw) {
  const tm = raw.deepMetrics?.textMirroring ?? {}
  const rsa = raw.deepMetrics?.replySpeedAsymmetry ?? {}

  return {
    textMirroring: {
      score: clamp(Number(tm.score) || 50, 0, 100),
      label: tm.label || '텍스트 미러링',
      interpretation: tm.interpretation || DEFAULT_DEEP_METRICS.textMirroring.interpretation,
      evidence: Array.isArray(tm.evidence) ? tm.evidence.slice(0, 5) : [],
    },
    replySpeedAsymmetry: {
      asymmetryScore: clamp(Number(rsa.asymmetryScore) || 50, 0, 100),
      label: rsa.label || '답장 속도 비대칭성',
      fasterSide: rsa.fasterSide || '인물A',
      slowerSide: rsa.slowerSide || '인물B',
      gapRatio: rsa.gapRatio || '1:1',
      avgReplyLabel: rsa.avgReplyLabel || '',
      interpretation: rsa.interpretation || DEFAULT_DEEP_METRICS.replySpeedAsymmetry.interpretation,
    },
  }
}

/**
 * @param {object[]} timeline
 */
export function normalizeTimeline(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return [
      { period: '초반', score: 40, label: '관계 형성기', trend: 'stable', insight: '' },
      { period: '중반', score: 55, label: '교감 심화', trend: 'up', insight: '' },
      { period: '현재', score: 65, label: '최근 흐름', trend: 'up', insight: '' },
    ]
  }

  return timeline.slice(0, 8).map((t) => ({
    period: t.period || '구간',
    score: clamp(Number(t.score) || 50, 0, 100),
    label: t.label || '',
    trend: ['up', 'down', 'stable'].includes(t.trend) ? t.trend : 'stable',
    insight: t.insight || '',
  }))
}

/**
 * @param {object[]} moments
 */
export function normalizeCriticalMoments(moments) {
  if (!Array.isArray(moments)) return []

  return moments.slice(0, 6).map((m) => ({
    speaker: m.speaker || '인물A',
    quote: m.quote || '',
    timestamp: m.timestamp || '',
    momentType: MOMENT_TYPE_LABELS[m.momentType] ? m.momentType : 'warmth',
    psychologicalInsight: m.psychologicalInsight || m.insight || '',
    impactScore: clamp(Number(m.impactScore) || 5, 1, 10),
  }))
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}
