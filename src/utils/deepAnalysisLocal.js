import {
  normalizeDeepAnalysis,
  normalizeTimeline,
  normalizeCriticalMoments,
} from '../../shared/normalizeAnalysis.js'
import { formatSpanLabel, weekKey, DAY_MS } from './dateUtils.js'

const EMOTION_WORDS = /보고\s?싶|설레|좋아|사랑|기대|고마|미안|보고파|그리워|💕|❤|🥰|😍/
const TENSION_WORDS = /갑자기|왜|뭐야|\.{2,}|…|긴장|어색/
const HUMOR_WORDS = /ㅋㅋ|ㅎㅎ|웃|개웃|ㅋㅋㅋ/

function tokenize(text) {
  return text.replace(/[^\w가-힣]/g, ' ').split(/\s+/).filter((w) => w.length > 1)
}

function formatGap(minutes) {
  if (minutes < 60) return `${Math.round(minutes)}분`
  if (minutes < 1440) return `${Math.round(minutes / 60)}시간`
  if (minutes < 10080) return `${Math.round(minutes / 1440)}일`
  return `${Math.round(minutes / 10080)}주`
}

function calcTextMirroring(messages, speakers) {
  if (speakers.length < 2 || messages.length < 4) {
    return {
      score: 45,
      label: '텍스트 미러링',
      interpretation: '대화량이 적어 미러링 패턴을 충분히 측정하기 어렵습니다.',
      evidence: [],
    }
  }

  const [a, b] = speakers
  const aMsgs = messages.filter((m) => m.speaker === a)
  const bMsgs = messages.filter((m) => m.speaker === b)

  const aStyle = {
    emoji: aMsgs.filter((m) => /[ㅋㅎ~💕❤]/u.test(m.content)).length / aMsgs.length,
    avgLen: aMsgs.reduce((s, m) => s + m.content.length, 0) / aMsgs.length,
    tokens: new Set(aMsgs.flatMap((m) => tokenize(m.content))),
  }
  const bStyle = {
    emoji: bMsgs.filter((m) => /[ㅋㅎ~💕❤]/u.test(m.content)).length / bMsgs.length,
    avgLen: bMsgs.reduce((s, m) => s + m.content.length, 0) / bMsgs.length,
    tokens: new Set(bMsgs.flatMap((m) => tokenize(m.content))),
  }

  const lenSim = 1 - Math.abs(aStyle.avgLen - bStyle.avgLen) / Math.max(aStyle.avgLen, bStyle.avgLen, 1)
  const emojiSim = 1 - Math.abs(aStyle.emoji - bStyle.emoji)
  const shared = [...aStyle.tokens].filter((t) => bStyle.tokens.has(t))
  const vocabSim = shared.length / Math.max(aStyle.tokens.size, bStyle.tokens.size, 1)

  let echoCount = 0
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1]
    const curr = messages[i]
    if (prev.speaker !== curr.speaker) {
      const pt = tokenize(prev.content)
      const ct = tokenize(curr.content)
      if (pt.some((t) => ct.includes(t))) echoCount++
    }
  }
  const echoSim = echoCount / Math.max(messages.length - 1, 1)
  const score = Math.round((lenSim * 0.25 + emojiSim * 0.25 + vocabSim * 0.3 + echoSim * 0.2) * 100)

  const evidence = []
  for (let i = 1; i < messages.length && evidence.length < 3; i++) {
    const prev = messages[i - 1]
    const curr = messages[i]
    if (prev.speaker !== curr.speaker && /ㅋㅋ|ㅎㅎ|~/.test(prev.content) && /ㅋㅋ|ㅎㅎ|~/.test(curr.content)) {
      evidence.push(`${prev.speaker} 「${prev.content.slice(0, 20)}」 → ${curr.speaker} 「${curr.content.slice(0, 20)}」`)
    }
  }
  if (shared.length > 0 && evidence.length < 3) {
    evidence.push(`공통 어휘: ${shared.slice(0, 4).join(', ')}`)
  }

  const level = score >= 70 ? '높은' : score >= 45 ? '중간' : '낮은'
  return {
    score,
    label: '텍스트 미러링',
    interpretation: `두 사람의 말투·어휘 유사도가 ${level} 수준(${score}점)입니다. ${score >= 60 ? '무의식적 rapport(라포) 형성 신호로, 심리적으로 편안함을 느끼고 있을 가능성이 있습니다.' : '아직 말투가 다르거나 거리감이 남아 있는 단계입니다.'}`,
    evidence,
  }
}

function calcReplyAsymmetry(messages, speakers, spanDays) {
  if (speakers.length < 2) {
    return {
      asymmetryScore: 30,
      label: '답장 속도 비대칭성',
      fasterSide: speakers[0] || '인물A',
      slowerSide: speakers[1] || '인물B',
      gapRatio: '1:1',
      avgReplyLabel: '',
      interpretation: '참여자가 1명이라 답장 속도 비교가 불가합니다.',
    }
  }

  const replyGaps = { [speakers[0]]: [], [speakers[1]]: [] }

  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1]
    const curr = messages[i]
    if (prev.speaker === curr.speaker) continue

    if (prev.dateMs != null && curr.dateMs != null) {
      const gapMin = (curr.dateMs - prev.dateMs) / 60000
      if (gapMin > 0 && gapMin < 14 * DAY_MS / 60000) {
        replyGaps[curr.speaker].push(gapMin)
      }
    }
  }

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
  const avg0 = avg(replyGaps[speakers[0]])
  const avg1 = avg(replyGaps[speakers[1]])

  if (avg0 == null && avg1 == null) {
    return {
      asymmetryScore: 40,
      label: '답장 속도 비대칭성',
      fasterSide: speakers[0],
      slowerSide: speakers[1],
      gapRatio: '—',
      avgReplyLabel: spanDays > 1 ? `${spanDays}일간 대화 (날짜 기반)` : '',
      interpretation: spanDays > 7
        ? `${spanDays}일에 걸친 장기 대화입니다. 며칠~몇 주 간격의 답장은 관계 온도 유지·거리두기·바쁨 등 다양한 요인으로 해석됩니다.`
        : '타임스탬프가 부족해 정밀한 답장 속도 비교가 어렵습니다.',
    }
  }

  const a0 = avg0 ?? avg1 ?? 60
  const a1 = avg1 ?? avg0 ?? 60
  const faster = a0 <= a1 ? speakers[0] : speakers[1]
  const slower = faster === speakers[0] ? speakers[1] : speakers[0]
  const fastAvg = Math.min(a0, a1)
  const slowAvg = Math.max(a0, a1)
  const ratio = slowAvg / Math.max(fastAvg, 1)
  const asymmetryScore = Math.min(95, Math.round((ratio - 1) * 35 + 20))
  const gapRatio = ratio >= 1.5 ? `${Math.round(ratio)}:1` : '1:1'

  const spanNote = spanDays > 7
    ? ` (${spanDays}일간 대화 — 장기간 패턴 반영)`
    : ''

  return {
    asymmetryScore,
    label: '답장 속도 비대칭성',
    fasterSide: faster,
    slowerSide: slower,
    gapRatio,
    avgReplyLabel: `${faster} ≈ ${formatGap(fastAvg)} / ${slower} ≈ ${formatGap(slowAvg)}${spanNote}`,
    interpretation: asymmetryScore >= 60
      ? `${faster}의 답장이 눈에 띄게 빠릅니다(격차 ${gapRatio}). ${spanDays > 7 ? '장기 대화에서도' : ''} 더 적극적 관심·대화 투자 신호일 수 있습니다.`
      : `답장 속도가 비교적 균형적입니다.${spanDays > 7 ? ` ${spanDays}일에 걸친 대화 전반에서 균형 잡힌 교류 패턴입니다.` : ''}`,
  }
}

function scoreChunk(chunk, baseScore) {
  const emo = chunk.filter((m) => EMOTION_WORDS.test(m.content)).length
  const len = chunk.reduce((s, m) => s + m.content.length, 0) / chunk.length
  const emoji = chunk.filter((m) => /[ㅋㅎ~💕❤😍]/u.test(m.content)).length
  return Math.min(95, Math.round(baseScore + emo * 12 + len * 0.3 + emoji * 5))
}

function buildTimelineByDate(messages, relationType, spanDays) {
  const dated = messages.filter((m) => m.dateMs != null)
  const scoreLabel = relationType === 'romantic' ? '호감도' : '친밀도'

  if (dated.length < 2) return buildTimelineFallback(messages, relationType)

  const minMs = Math.min(...dated.map((m) => m.dateMs))
  const maxMs = Math.max(...dated.map((m) => m.dateMs))

  /** @type {Map<string, object[]>} */
  const buckets = new Map()

  for (const msg of dated) {
    let key, label
    if (spanDays <= 3) {
      key = new Date(msg.dateMs).toDateString()
      label = msg.dateLabel || key
    } else if (spanDays <= 21) {
      key = weekKey(msg.dateMs)
      const d = new Date(msg.dateMs)
      label = `${d.getMonth() + 1}/${d.getDate()} 주`
    } else {
      const d = new Date(msg.dateMs)
      key = `${d.getFullYear()}-${d.getMonth() + 1}`
      label = `${d.getFullYear()}.${d.getMonth() + 1}월`
    }
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push({ ...msg, bucketLabel: label })
  }

  const sorted = [...buckets.entries()].sort((a, b) => {
    const ta = a[1][0].dateMs
    const tb = b[1][0].dateMs
    return ta - tb
  })

  let prevScore = 40
  return sorted.map(([key, chunk], i) => {
    const score = scoreChunk(chunk, 35 + i * 6)
    const emo = chunk.filter((m) => EMOTION_WORDS.test(m.content)).length
    const trend = score > prevScore + 3 ? 'up' : score < prevScore - 3 ? 'down' : 'stable'
    prevScore = score

    const period = chunk[0].bucketLabel || key
    const phaseLabels = spanDays > 21
      ? ['초기 국면', '중반 전개', '관계 심화', '후반/현재']
      : ['초반', '중반', '후반', '최근']

    return {
      period,
      score,
      label: phaseLabels[i] || (i === sorted.length - 1 ? '현재' : `구간 ${i + 1}`),
      trend,
      insight: emo > 0
        ? `${period} — ${scoreLabel} ${score}점, 감정 표현 ${emo}회`
        : `${period} — 일상 교류 중심 (${chunk.length}개 메시지)`,
    }
  })
}

function buildTimelineFallback(messages, relationType) {
  const chunkSize = Math.max(3, Math.ceil(messages.length / 4))
  const chunks = []
  for (let i = 0; i < messages.length; i += chunkSize) {
    chunks.push(messages.slice(i, i + chunkSize))
  }
  const scoreLabel = relationType === 'romantic' ? '호감도' : '친밀도'
  return chunks.map((chunk, i) => ({
    period: `구간 ${i + 1}`,
    score: scoreChunk(chunk, 35 + i * 8),
    label: i === chunks.length - 1 ? '최근' : `파트 ${i + 1}`,
    trend: 'stable',
    insight: `${scoreLabel} 추정 구간 (${chunk.length}개 메시지, 날짜 정보 없음)`,
  }))
}

function buildTimeline(messages, relationType, spanDays) {
  return buildTimelineByDate(messages, relationType, spanDays)
}

function classifyMoment(content) {
  if (EMOTION_WORDS.test(content)) return 'confession'
  if (TENSION_WORDS.test(content)) return 'tension'
  if (HUMOR_WORDS.test(content)) return 'humor'
  if (/만나|볼래|약속|밥|먹을래/.test(content)) return 'approach'
  if (/ㅇㅇ|응|ㅋ$/.test(content) && content.length <= 6) return 'distance'
  return 'warmth'
}

function momentInsight(type, content, relationType) {
  const insights = {
    approach: '관계를 한 단계 진전시키려는 **적극적 접근** 신호입니다.',
    tension: '**밀당·긴장감**이 형성된 순간입니다.',
    warmth: '**정서적 온기**가 교환된 구간입니다.',
    distance: '짧고 절제된 답장 — **거리두기·바쁨** 신호일 수 있습니다.',
    confession: '**감정 노출**이 이루어진 핵심 순간입니다.',
    humor: '**유머 공유**는 심리적 안전지대 형성의 지표입니다.',
    turning_point: '대화 흐름이 바뀐 **관계 전환점**입니다.',
  }
  const base = insights[type] || insights.warmth
  return relationType !== 'romantic' ? base.replace(/호감|썸|설렘/g, '친밀감') : base
}

function extractCriticalMoments(messages, relationType) {
  return messages
    .map((m) => {
      let impact = 3
      if (EMOTION_WORDS.test(m.content)) impact += 4
      if (/만나|볼래|약속|밥|영화|데이트/.test(m.content)) impact += 3
      if (TENSION_WORDS.test(m.content)) impact += 2
      if (m.content.length > 25) impact += 1
      if (HUMOR_WORDS.test(m.content)) impact += 1
      return { ...m, impact, momentType: classifyMoment(m.content) }
    })
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 5)
    .map((m) => ({
      speaker: m.speaker,
      quote: m.content,
      timestamp: m.fullLabel || m.timestamp || m.dateLabel || '',
      momentType: m.momentType,
      psychologicalInsight: momentInsight(m.momentType, m.content, relationType),
      impactScore: Math.min(10, m.impact),
    }))
}

function buildPsychologySummary(relationType, mirroring, asymmetry, timeline, moments, meta) {
  if (!timeline?.length) {
    return '대화 데이터가 부족해 심층 요약을 생성하지 못했습니다.'
  }
  const last = timeline[timeline.length - 1]
  const first = timeline[0]
  const delta = last.score - first.score
  const trendWord = delta > 15 ? '뚜렷한 상승' : delta > 5 ? '완만한 상승' : delta < -5 ? '하락' : '안정'
  const spanNote = meta?.spanDays > 1
    ? `${meta.spanLabel}(${meta.dateRange?.start || ''}~${meta.dateRange?.end || ''})에 걸친 `
    : ''

  const momentQuote = moments[0]?.quote
    ? `특히 「${moments[0].quote.slice(0, 30)}${moments[0].quote.length > 30 ? '…' : ''}」`
    : ''

  return [
    `${spanNote}대화 분석 — 텍스트 미러링 ${mirroring.score}점.`,
    `답장 속도: ${asymmetry.fasterSide} 우위(${asymmetry.gapRatio}). ${asymmetry.avgReplyLabel}.`,
    `기간별 ${trendWord} 추세(${first.score}→${last.score}점, ${timeline.length}구간).`,
    momentQuote ? `${momentQuote} — 관계의 핵심 포인트.` : '',
  ].filter(Boolean).join(' ')
}

/**
 * @param {object[]} messages
 * @param {string[]} speakers
 * @param {string} relationType
 * @param {object} [meta]
 */
export function buildDeepAnalysis(messages, speakers, relationType, meta = {}) {
  const spanDays = meta.spanDays || 0
  const textMirroring = calcTextMirroring(messages, speakers)
  const replySpeedAsymmetry = calcReplyAsymmetry(messages, speakers, spanDays)
  const affectionTimeline = buildTimeline(messages, relationType, spanDays)
  const criticalMoments = extractCriticalMoments(messages, relationType)
  const psychologySummary = buildPsychologySummary(
    relationType, textMirroring, replySpeedAsymmetry, affectionTimeline, criticalMoments, meta,
  )

  return {
    deepMetrics: normalizeDeepAnalysis({ deepMetrics: { textMirroring, replySpeedAsymmetry } }),
    affectionTimeline: normalizeTimeline(affectionTimeline),
    criticalMoments: normalizeCriticalMoments(criticalMoments),
    psychologySummary,
  }
}
