import { parseMessages, groupBySpeaker, getConversationMeta } from './parseChat.js'
import { buildDeepAnalysis } from './deepAnalysisLocal.js'

/** @typedef {'romantic' | 'friendship' | 'work' | 'family' | 'ambiguous'} RelationType */

const RELATION_LABELS = {
  romantic: {
    tag: (score) => score >= 75 ? '썸·호감 진행 중' : score >= 55 ? '관심 형성 단계' : '가벼운 호감 신호',
    scoreLabel: '호감 점수',
    reportTitle: '연애 감정 분석 리포트',
    solutionTitle: '연애 솔루션 & 팁',
  },
  friendship: {
    tag: () => '친구·동료 관계',
    scoreLabel: '친밀도 점수',
    reportTitle: '대화 관계 분석 리포트',
    solutionTitle: '관계 유지 & 소통 팁',
  },
  work: {
    tag: () => '업무·협업 관계',
    scoreLabel: '협업 친밀도',
    reportTitle: '업무 대화 분석 리포트',
    solutionTitle: '협업 & 커뮤니케이션 팁',
  },
  family: {
    tag: () => '가족·지인 관계',
    scoreLabel: '친밀도 점수',
    reportTitle: '대화 관계 분석 리포트',
    solutionTitle: '소통 개선 팁',
  },
  ambiguous: {
    tag: () => '관계 유형 불명확',
    scoreLabel: '대화 활성도',
    reportTitle: '대화 패턴 분석 리포트',
    solutionTitle: '소통 개선 제안',
  },
}

const TOPIC_RULES = [
  { id: 'gaming', label: '게임', patterns: [/게임|롤\b|발로|랭크|듀오|tft|공략|스팀|패치|챔피언|솔랭|내전/i] },
  { id: 'work', label: '업무', patterns: [/회의|업무|마감|프로젝트|출근|퇴근|보고서|일정|팀장|과장|부장|클라이언트|deadline/i] },
  { id: 'sports', label: '운동·스포츠', patterns: [/축구|야구|골프|헬스|운동|gym|농구|마라톤|등산/i] },
  { id: 'food', label: '음식·모임', patterns: [/먹|맛집|치킨|술|밥|카페|점심|저녁|치맥|회식|약속/i] },
  { id: 'study', label: '학업·시험', patterns: [/시험|과제|공부|수업|학교|대학|레포트|졸업/i] },
  { id: 'romance', label: '연애·호감', patterns: [/보고\s?싶|사랑|좋아해|설레|데이트|썸|연애|심장|키스|애인|남친|여친|플러팅|질투|보고파/i] },
  { id: 'daily', label: '일상 안부', patterns: [/뭐\s?해|잘\s?지|안녕|ㅎㅇ|수고|고생/i] },
]

const PLATONIC_SIGNALS = [
  /형\b|브로|야\s*[,!]?|ㅇㅋ|ㄱㄱ|ㄴㄴ|개웃|ㅋㅋㅋㅋ|솔랭|듀오\s?갈|같이\s?게임/i,
  /회의|업무|마감|보고서|출근|야근|프로젝트/i,
  /축구|야구|헬스|운동\s?갈/i,
]

const ROMANTIC_SIGNALS = [
  /보고\s?싶|사랑|좋아해|설레|데이트|썸|연애|심장|키스|애인|남친|여친|보고파|그리워/i,
  /❤|🥰|😍|💕|💗|🫶/,
  /오늘\s?뭐\s?해\s*\?.*(만나|보자|시간)/i,
  /잘\s?자.*(보고|꿈|생각)/i,
]

const FEMALE_NAME_HINTS = /[희영연빈나정주미소윤아린혜진은수경]/ 
const MALE_SPEECH = /(?:했냐|가자|ㄱㄱ|ㅇㅋ|형|브로|야\b|개\s|존나|ㅋㅋㅋ)/

function countMatches(text, patterns) {
  return patterns.reduce((sum, p) => sum + (p.test(text) ? 1 : 0), 0)
}

function detectTopics(allText) {
  return TOPIC_RULES
    .map(({ id, label, patterns }) => ({
      id,
      label,
      count: patterns.reduce((n, p) => {
        const matches = allText.match(new RegExp(p.source, 'gi'))
        return n + (matches?.length ?? 0)
      }, 0),
    }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
}

/**
 * @param {string[]} names
 * @param {string} allText
 * @param {{ speaker: string, content: string }[]} messages
 */
function classifyRelation(names, allText, messages) {
  const romanticScore = countMatches(allText, ROMANTIC_SIGNALS)
  const platonicScore = countMatches(allText, PLATONIC_SIGNALS)
  const workScore = detectTopics(allText).find((t) => t.id === 'work')?.count ?? 0
  const gamingScore = detectTopics(allText).find((t) => t.id === 'gaming')?.count ?? 0

  const speakers = [...new Set(messages.map((m) => m.speaker))]
  const allContents = messages.map((m) => m.content).join(' ')
  const maleSpeechRatio = messages.filter((m) => MALE_SPEECH.test(m.content)).length / Math.max(messages.length, 1)

  const likelyMalePair =
    speakers.length === 2 &&
    maleSpeechRatio > 0.25 &&
    romanticScore === 0

  const likelyFemalePair =
    speakers.length === 2 &&
    names.every((n) => FEMALE_NAME_HINTS.test(n.slice(-1))) &&
    romanticScore <= 1

  if (romanticScore >= 3) return { type: 'romantic', confidence: 'high' }
  if (romanticScore >= 1 && platonicScore < 2) return { type: 'romantic', confidence: 'medium' }

  if (workScore >= 3 && romanticScore === 0) return { type: 'work', confidence: 'high' }
  if (workScore >= 1 && platonicScore >= 2) return { type: 'work', confidence: 'medium' }

  if (likelyMalePair || likelyFemalePair) {
    if (gamingScore >= 2 || platonicScore >= 3) return { type: 'friendship', confidence: 'high' }
    if (platonicScore >= 1) return { type: 'friendship', confidence: 'medium' }
  }

  if (platonicScore >= 2 && romanticScore === 0) return { type: 'friendship', confidence: 'high' }
  if (gamingScore >= 2 && romanticScore === 0) return { type: 'friendship', confidence: 'medium' }

  if (/엄마|아빠|동생|언니|오빠|할머|할아/i.test(allText) && romanticScore === 0) {
    return { type: 'family', confidence: 'medium' }
  }

  if (romanticScore === 0 && platonicScore === 0) {
    return { type: 'ambiguous', confidence: 'low' }
  }

  return { type: 'friendship', confidence: 'low' }
}

function calcDominance(groups) {
  const entries = Object.entries(groups)
  if (entries.length < 2) {
    return {
      dominance: '대화 참여자가 1명으로 확인되어 주도권 비교가 어렵습니다',
      dominanceDetail: { personA: 50, personB: 50, personALabel: '사용자A', personBLabel: '사용자B' },
    }
  }

  const scored = entries.map(([name, data]) => ({
    label: name,
    score: data.count * 2 + data.chars * 0.1,
    count: data.count,
  }))

  scored.sort((a, b) => b.score - a.score)
  const total = scored[0].score + scored[1].score
  const personA = Math.round((scored[0].score / total) * 100)
  const personB = 100 - personA

  const leader = scored[0].label
  const ratio = personA >= 65 ? '주도권을 장악' : personA >= 55 ? '대화를 약간 주도' : '비교적 균형'

  return {
    dominance: `${leader}가 ${ratio}하고 있습니다 (발화 ${scored[0].count}회 vs ${scored[1].count}회)`,
    dominanceDetail: {
      personA,
      personB,
      personALabel: scored[0].label,
      personBLabel: scored[1].label,
    },
  }
}

function calcMetrics(messages, groups, relationType) {
  const total = messages.length
  const avgLen = messages.reduce((s, m) => s + m.content.length, 0) / Math.max(total, 1)
  const emojiCount = messages.filter((m) => /[\u{1F300}-\u{1FAFF}]|[😀-🙏]/u.test(m.content)).length
  const shortReplyCount = messages.filter((m) => m.content.length <= 4).length

  const speakers = Object.keys(groups)
  let initiativeScore = 50
  if (speakers.length >= 2) {
    const firstSpeakerCounts = {}
    for (let i = 0; i < messages.length; i++) {
      const prev = messages[i - 1]?.speaker
      const curr = messages[i].speaker
      if (i === 0 || prev !== curr) {
        firstSpeakerCounts[curr] = (firstSpeakerCounts[curr] ?? 0) + 1
      }
    }
    const counts = Object.values(firstSpeakerCounts)
    if (counts.length >= 2) {
      initiativeScore = Math.round((Math.max(...counts) / counts.reduce((a, b) => a + b, 0)) * 100)
    }
  }

  const replyScore = Math.min(100, Math.round(40 + avgLen * 1.5 - shortReplyCount * 2))
  const emojiScore = Math.min(100, Math.round((emojiCount / Math.max(total, 1)) * 300))
  const engagementScore = Math.min(100, Math.round(total * 3 + avgLen))

  const labels =
    relationType === 'romantic'
      ? { a: '호감 신호', e: '이모티콘 친밀도' }
      : relationType === 'work'
        ? { a: '협업 적극성', e: '비언어적 친밀도' }
        : { a: '관심·참여도', e: '이모티콘 사용' }

  return {
    replySpeed: { score: Math.max(20, Math.min(95, replyScore)), label: '답장 풍부도' },
    emojiUsage: { score: Math.max(10, Math.min(95, emojiScore)), label: labels.e },
    initiative: { score: Math.max(30, Math.min(90, initiativeScore)), label: '대화 주도성' },
    affection: { score: Math.max(20, Math.min(95, engagementScore)), label: labels.a },
  }
}

function buildSummary(relationType, topics, messages, groups, classification) {
  const topTopics = topics.slice(0, 3).map((t) => t.label)
  const topicStr = topTopics.length > 0 ? topTopics.join(', ') : '일상 안부'
  const speakers = Object.keys(groups)
  const totalMsgs = messages.length

  const sampleLines = messages
    .filter((m) => m.content.length >= 8)
    .slice(0, 3)
    .map((m) => `「${m.content.slice(0, 40)}${m.content.length > 40 ? '…' : ''}」`)

  const speakerStats = speakers
    .map((s) => `${s}: ${groups[s].count}회 발화, 평균 ${Math.round(groups[s].chars / groups[s].count)}자`)
    .join(' / ')

  if (relationType === 'romantic') {
    return [
      `총 ${totalMsgs}개 메시지를 분석한 결과, 연애·호감 관련 표현이 감지되어 이성 간 썸/호감 관계로 분류했습니다.`,
      `주요 대화 주제: ${topicStr}.`,
      sampleLines.length > 0 ? `대화에서 ${sampleLines.join(', ')} 같은 표현이 눈에 띕니다.` : '',
      `${speakerStats}.`,
      classification.confidence === 'medium'
        ? '다만 연애 신호가 강하지 않아, 친한 친구일 가능성도 일부 있습니다.'
        : '',
    ].filter(Boolean).join(' ')
  }

  if (relationType === 'friendship') {
    return [
      `총 ${totalMsgs}개 메시지 분석 결과, 연애·호감 표현이 거의 없고 친구/지인 대화 패턴으로 분류했습니다.`,
      `주요 화제는 ${topicStr}입니다.`,
      sampleLines.length > 0 ? `예: ${sampleLines.join(', ')}` : '',
      `${speakerStats}.`,
      '게임·운동·음식 등 공통 관심사 중심의 편안한 톤이며, 밀당·설렘 분석은 이 관계 유형에 적용하지 않았습니다.',
    ].filter(Boolean).join(' ')
  }

  if (relationType === 'work') {
    return [
      `업무·협업 관련 키워드가 다수 감지되어 직장 동료/협업 관계로 분류했습니다.`,
      `주요 화제: ${topicStr}. 총 ${totalMsgs}개 메시지.`,
      sampleLines.length > 0 ? `대화 맥락: ${sampleLines.join(', ')}` : '',
      `${speakerStats}.`,
      '연애 분석 대신 업무 커뮤니케이션 패턴(응답 풍부도, 주도권) 위주로 해석했습니다.',
    ].filter(Boolean).join(' ')
  }

  return [
    `총 ${totalMsgs}개 메시지에서 명확한 연애 신호가 감지되지 않았습니다.`,
    `주요 화제: ${topicStr}. ${speakerStats}.`,
    '관계 유형이 불분명하여 일반적인 대화 패턴 분석 결과를 제공합니다.',
  ].join(' ')
}

function buildSolution(relationType, topics, dominanceDetail) {
  const top = topics[0]?.label

  if (relationType === 'friendship') {
    return [
      `① ${top ? `'${top}' 관련 공통 관심사` : '공통 관심사'}를 중심으로 대화를 이어가면 관계 유지에 도움이 됩니다.`,
      '② 장기간 답장 공백이 생기면 가벼운 안부(「요즘 뭐해?」)로 자연스럽게 재연결하세요.',
      `③ 대화 주도권이 ${dominanceDetail.personA}% : ${dominanceDetail.personB}%로 ${Math.abs(dominanceDetail.personA - dominanceDetail.personB) > 20 ? '한쪽 편중' : '비교적 균형'}입니다. 상대도 말할 기회를 주면 더 편한 분위기가 됩니다.`,
      '④ 이 대화는 연애 관계가 아닌 것으로 판단되었으므로, 썸·호감 전략보다 친밀감 유지에 집중하세요.',
    ].join('\n')
  }

  if (relationType === 'work') {
    return [
      '① 업무 메시지는 결론 → 근거 → 요청 순으로 작성하면 오해가 줄어듭니다.',
      '② 긴급하지 않은 내용은 출퇴근 시간을 피해 보내는 것이 좋습니다.',
      '③ 「확인했습니다」「○일까지 전달드리겠습니다」처럼 명확한 마무리 표현을 사용하세요.',
      '④ 업무 대화에서 이모티콘·반말 사용은 팀 문화에 맞춰 조절하세요.',
    ].join('\n')
  }

  if (relationType === 'romantic') {
    return [
      '① 상대의 답장 리듬에 맞춰 대화 간격을 조절해 보세요.',
      '② 상대가 공유한 이야기에 구체적인 후속 질문을 던지면 호감도가 올라갑니다.',
      '③ 가벼운 일상 공유(밈, 사진)로 친밀감을 쌓아가세요.',
      '④ 약속 제안은 부담 없는 톤으로, 상대 일정을 먼저 확인하세요.',
    ].join('\n')
  }

  return [
    '① 대화 주제가 너무 단조롭다면 새로운 화제(영화, 맛집, 취미)를 가볍게 제안해 보세요.',
    '② 짧은 답장만 반복된다면, 열린 질문(「요즘 뭐에 빠져있어?」)으로 대화를 확장하세요.',
    '③ 연애 관계인지 친구 관계인지 불분명하다면, 관계를 급하게 정의하기보다 자연스럽게 지켜보세요.',
  ].join('\n')
}

function calcTotalScore(relationType, metrics, romanticScore) {
  const avg = Object.values(metrics).reduce((s, m) => s + m.score, 0) / 4

  if (relationType === 'romantic') {
    return Math.min(98, Math.round(avg * 0.6 + romanticScore * 8 + 20))
  }
  if (relationType === 'friendship') {
    return Math.min(90, Math.round(avg * 0.85 + 15))
  }
  if (relationType === 'work') {
    return Math.min(85, Math.round(avg * 0.8 + 10))
  }
  return Math.round(avg)
}

/**
 * 익명화된 텍스트 + nameMap으로 로컬 컨텍스트 분석
 * @param {string} anonymizedText
 * @param {Record<string, string>} nameMap
 */
export function analyzeLocally(anonymizedText, nameMap) {
  const messages = parseMessages(anonymizedText)
  const groups = groupBySpeaker(messages)
  const allText = messages.map((m) => m.content).join(' ')
  const originalNames = Object.keys(nameMap)
  const topics = detectTopics(allText)
  const romanticScore = countMatches(allText, ROMANTIC_SIGNALS)
  const classification = classifyRelation(originalNames, allText, messages)
  const relationType = /** @type {RelationType} */ (classification.type)
  const labels = RELATION_LABELS[relationType]
  const metrics = calcMetrics(messages, groups, relationType)
  const { dominance, dominanceDetail } = calcDominance(groups)
  const totalScore = calcTotalScore(relationType, metrics, romanticScore)
  const speakers = Object.keys(groups)
  const conversationMeta = getConversationMeta(messages)
  const deep = buildDeepAnalysis(messages, speakers, relationType, conversationMeta)

  return {
    totalScore,
    relationTag: labels.tag(totalScore),
    relationType,
    conversationMeta,
    classificationConfidence: classification.confidence,
    detectedTopics: topics.slice(0, 5).map((t) => t.label),
    scoreLabel: labels.scoreLabel,
    reportTitle: labels.reportTitle,
    solutionTitle: labels.solutionTitle,
    dominance,
    dominanceDetail,
    psychologySummary: deep.psychologySummary,
    aiSummary: buildSummary(relationType, topics, messages, groups, classification),
    solution: buildSolution(relationType, topics, dominanceDetail),
    metrics,
    deepMetrics: deep.deepMetrics,
    affectionTimeline: deep.affectionTimeline,
    criticalMoments: deep.criticalMoments,
    messageCount: messages.length,
    source: 'local',
  }
}
