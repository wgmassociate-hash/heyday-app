/** 고차원 분석 Mock — Claude API 예상 응답 참조용 */
export const mockDeepAnalysisResult = {
  totalScore: 82,
  relationType: 'romantic',
  relationTag: '썸·호감 진행 중',
  scoreLabel: '호감 점수',
  reportTitle: '연애 심층 심리 분석 리포트',
  solutionTitle: '연애 솔루션 & 전략',
  dominance: '인물A가 대화를 주도하며 약속·만남을 적극 제안 (발화 18회 vs 14회)',
  dominanceDetail: {
    personA: 62,
    personB: 38,
    personALabel: '인물A',
    personBLabel: '인물B',
  },
  detectedTopics: ['연애·호감', '음식·모임', '일상 안부'],
  psychologySummary:
    '텍스트 미러링 78점 — 두 사람의 ㅋㅋ/ㅎㅎ 리듬과 이모티콘 사용이 점진적으로 동기화되며, 무의식적 rapport가 형성되고 있습니다. 답장 속도는 인물A가 2:1 우위로, 불안-접근형 애착 패턴에서 흔한 "먼저 연락·빠른 반응" 신호와 일치합니다. 타임라인상 6/20 저녁(45점) → 6/22 현재(82점)로 뚜렷한 상승 곡선이며, 특히 "밥 먹을래?" 제안 이후 감정 온도가 급상승했습니다.',
  aiSummary:
    '인물A가 먼저 일상을 공유하고 만남을 제안하는 패턴이 뚜렷합니다. 인물B는 초반 "갑자기??"로 긴장감을 보였으나, 이후 💕·"설레게" 등 감정 수용 신호를 보냈습니다. 영화 약속까지 자연스럽게 연결된 전형적인 썸 진행 곡선입니다.',
  solution:
    '① 인물B의 "갑자기??" 순간 — 너무 빠른 접근은 부담을 줄 수 있으니, 다음 제안 전 가벼운 안부로 리듬을 맞추세요.\n② 인물A의 빠른 답장(2:1) — 상대도 관심 있지만, 간격을 살짝 벌려 밀당 밸런스를 잡으면 긴장감이 유지됩니다.\n③ "설레게" 같은 수용 신호에 구체적 칭찬·후속 질문으로 감정을 확장하세요.\n④ 영화 약속 확정 후 D-day 전 가벼운 메시지 1회로 기대감을 유지하세요.',
  metrics: {
    replySpeed: { score: 76, label: '답장 풍부도' },
    emojiUsage: { score: 88, label: '이모티콘 친밀도' },
    initiative: { score: 68, label: '대화 주도성' },
    affection: { score: 85, label: '호감 신호' },
  },
  deepMetrics: {
    textMirroring: {
      score: 78,
      label: '텍스트 미러링',
      interpretation:
        'ㅋㅋ/ㅎㅎ/💕 사용 패턴이 후반부로 갈수록 동기화. 상호 무의식적 rapport 형성 중.',
      evidence: [
        '인물A 「ㅋㅋ」 → 인물B 「ㅋㅋㅋ」 echo',
        '공통 어휘: 재밌, 좋아, ㅇㅇ',
        '문장 길이 후반부 수렴 (15자 → 22자)',
      ],
    },
    replySpeedAsymmetry: {
      asymmetryScore: 62,
      label: '답장 속도 비대칭성',
      fasterSide: '인물A',
      slowerSide: '인물B',
      gapRatio: '2:1',
      avgReplyLabel: '인물A ≈ 3분 / 인물B ≈ 16분',
      interpretation:
        '인물A의 빠른 답장은 적극적 관심·불안형 애착 패턴과 일치. 인물B의 지연은 바쁨 또는 의도적 밀당일 수 있으나, 후반부 간격 축소로 관심 상승 신호.',
    },
  },
  affectionTimeline: [
    { period: '6/20 저녁', score: 45, label: '첫 접근', trend: 'stable', insight: '인물A의 밥 제안, B의 "갑자기??" 긴장' },
    { period: '6/20 밤', score: 62, label: '만남 후', trend: 'up', insight: '재밌었다·💕 — 감정 수용 시작' },
    { period: '6/21 아침', score: 71, label: '설렘 고조', trend: 'up', insight: '"너 생각" → "설레게" 직접 감정 교환' },
    { period: '6/21 밤', score: 75, label: '일상 공유', trend: 'stable', insight: '넷플 추천·같이 보고 싶다' },
    { period: '6/22 현재', score: 82, label: '약속 확정', trend: 'up', insight: '영화 데이트 확정 — 관계 진전' },
  ],
  criticalMoments: [
    {
      speaker: '인물A',
      quote: '그럼 내가 ○○역 근처 맛집 알거든 거기서 밥 먹을래?',
      timestamp: '6/20 19:46',
      momentType: 'approach',
      psychologicalInsight: '친구 이상의 관심을 **행동으로 전환**한 첫 시도. 거절 리스크를 감수한 적극적 접근.',
      impactScore: 9,
    },
    {
      speaker: '인물B',
      quote: '...ㅋㅋㅋ 알겠어 어디야?',
      timestamp: '6/20 20:15',
      momentType: 'turning_point',
      psychologicalInsight: '망설임("...") 후 수용 — **관계 전환점**. 밀당 후 문을 연 신호.',
      impactScore: 10,
    },
    {
      speaker: '인물B',
      quote: '...뭐야 ㅋㅋㅋ 설레게',
      timestamp: '6/21 08:45',
      momentType: 'confession',
      psychologicalInsight: '직접적 감정 표출. 상대의 "너 생각"에 **정서적 reciprocity(호혜성)** 로 응답.',
      impactScore: 9,
    },
    {
      speaker: '인물A',
      quote: '그럼 토요일에 영화 볼래? 네가 보고 싶다던 그거 개봉했더라',
      timestamp: '6/22 15:06',
      momentType: 'approach',
      psychologicalInsight: '상대가 언급했던 영화 기억 → **세심한 관심**의 강력한 증거. 데이트 공식화 시도.',
      impactScore: 8,
    },
  ],
  messageCount: 32,
  source: 'mock',
}
