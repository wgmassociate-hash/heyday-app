import {
  normalizeDeepAnalysis,
  normalizeTimeline,
  normalizeCriticalMoments,
} from './normalizeAnalysis.js'

export const RELATION_LABELS = {
  romantic: {
    tag: (score) => score >= 75 ? '썸·호감 진행 중' : score >= 55 ? '관심 형성 단계' : '가벼운 호감 신호',
    scoreLabel: '호감 점수',
    reportTitle: '연애 심층 심리 분석 리포트',
    solutionTitle: '연애 솔루션 & 전략',
  },
  friendship: {
    tag: () => '친구·동료 관계',
    scoreLabel: '친밀도 점수',
    reportTitle: '대화 심층 분석 리포트',
    solutionTitle: '관계 유지 & 소통 팁',
  },
  work: {
    tag: () => '업무·협업 관계',
    scoreLabel: '협업 친밀도',
    reportTitle: '업무 대화 심층 분석',
    solutionTitle: '협업 & 커뮤니케이션 팁',
  },
  family: {
    tag: () => '가족·지인 관계',
    scoreLabel: '친밀도 점수',
    reportTitle: '대화 심층 분석 리포트',
    solutionTitle: '소통 개선 팁',
  },
  ambiguous: {
    tag: () => '관계 유형 불명확',
    scoreLabel: '대화 활성도',
    reportTitle: '대화 패턴 심층 분석',
    solutionTitle: '소통 개선 제안',
  },
}

const VALID_TYPES = new Set(['romantic', 'friendship', 'work', 'family', 'ambiguous'])

/**
 * @param {object} raw Claude JSON 응답
 * @param {number} messageCount
 */
export function enrichResult(raw, messageCount) {
  const type = VALID_TYPES.has(raw.relationType) ? raw.relationType : 'ambiguous'
  const labels = RELATION_LABELS[type]
  const totalScore = Math.min(100, Math.max(0, Number(raw.totalScore) || 0))

  return {
    totalScore,
    relationType: type,
    relationTag: raw.relationTag || labels.tag(totalScore),
    scoreLabel: labels.scoreLabel,
    reportTitle: labels.reportTitle,
    solutionTitle: labels.solutionTitle,
    dominance: raw.dominance || '주도권 분석 불가',
    dominanceDetail: {
      personA: raw.dominanceDetail?.personA ?? 50,
      personB: raw.dominanceDetail?.personB ?? 50,
      personALabel: raw.dominanceDetail?.personALabel ?? '사용자A',
      personBLabel: raw.dominanceDetail?.personBLabel ?? '사용자B',
    },
    detectedTopics: Array.isArray(raw.detectedTopics) ? raw.detectedTopics : [],
    psychologySummary: raw.psychologySummary || raw.aiSummary || '',
    aiSummary: raw.aiSummary || '분석 요약을 생성하지 못했습니다.',
    solution: raw.solution || '',
    metrics: raw.metrics ?? {},
    deepMetrics: normalizeDeepAnalysis(raw),
    affectionTimeline: normalizeTimeline(raw.affectionTimeline),
    criticalMoments: normalizeCriticalMoments(raw.criticalMoments),
    conversationMeta: raw.conversationMeta ?? null,
    messageCount,
    source: 'claude',
  }
}
