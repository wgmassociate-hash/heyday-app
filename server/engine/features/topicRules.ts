// Phase 1 — topic keyword rules, ported from src/utils/analyzeLocal.js's
// TOPIC_RULES (lines ~39-47). The gender-inference heuristic that used to
// live alongside these (FEMALE_NAME_HINTS/MALE_SPEECH, analyzeLocal.js:62-63)
// is deliberately NOT ported — analysis_v1.md §3B and docs/prd_v2.md §34
// (Out of Scope) both call it out as something 2.0 must not carry forward.
export interface TopicRule {
  id: string
  label: string
  pattern: RegExp
}

export const TOPIC_RULES: TopicRule[] = [
  { id: 'gaming', label: '게임', pattern: /게임|롤\b|발로|랭크|듀오|tft|공략|스팀|패치|챔피언|솔랭|내전/i },
  { id: 'work', label: '업무', pattern: /회의|업무|마감|프로젝트|출근|퇴근|보고서|일정|팀장|과장|부장|클라이언트|deadline/i },
  { id: 'sports', label: '운동·스포츠', pattern: /축구|야구|골프|헬스|운동|gym|농구|마라톤|등산/i },
  { id: 'food', label: '음식·모임', pattern: /먹|맛집|치킨|술|밥|카페|점심|저녁|치맥|회식|약속/i },
  { id: 'study', label: '학업·시험', pattern: /시험|과제|공부|수업|학교|대학|레포트|졸업/i },
  { id: 'romance', label: '연애·호감', pattern: /보고\s?싶|사랑|좋아해|설레|데이트|썸|연애|심장|키스|애인|남친|여친|플러팅|질투|보고파/i },
  { id: 'daily', label: '일상 안부', pattern: /뭐\s?해|잘\s?지|안녕|ㅎㅇ|수고|고생/i },
]
