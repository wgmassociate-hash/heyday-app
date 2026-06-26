export default function SeoContent() {
  return (
    <details className="mt-12 max-w-xl mx-auto group">
      <summary className="cursor-pointer list-none text-center text-sm font-semibold text-gray-400 hover:text-brand-500 transition-colors">
        <span className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-gray-50 border border-gray-100">
          📖 더 알아보기
          <span className="text-xs group-open:rotate-180 transition-transform inline-block">▼</span>
        </span>
      </summary>
    <article className="mt-6 max-w-3xl mx-auto">
      <header className="mb-10 text-center md:text-left">
        <p className="text-brand-500 font-semibold text-sm uppercase tracking-widest mb-2">
          Relationship Psychology
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug">
          카톡 대화 데이터로 읽어내는
          <br className="hidden md:block" />
          <span className="text-brand-600"> 연애 심리학과 밀당의 과학</span>
        </h2>
        <p className="mt-4 text-gray-500 text-base leading-relaxed">
          현대 연애에서 카카오톡 대화는 감정의 온도계입니다. 말하지 않아도 답장 속도, 이모티콘
          사용 빈도, 문장 길이만으로도 상대의 마음을 읽을 수 있습니다. heydaystar의 카톡 밀당
          감정 분석기는 이러한 디지털 커뮤니케이션 패턴을 과학적으로 해석하여, 당신의 연애
          상황을 객관적으로 진단해 드립니다.
        </p>
      </header>

      <div className="space-y-10">
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
          <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-lg">
              1
            </span>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                텍스트 빈도와 답장 속도가 말해주는 호감도
              </h3>
              <div className="prose prose-gray text-gray-600 leading-relaxed space-y-4 text-sm md:text-base">
                <p>
                  연애 심리학 연구에 따르면, 호감을 느끼는 사람은 무의식적으로 상대방과의
                  커뮤니케이션 빈도를 높이는 경향이 있습니다. 카카오톡 대화에서 이를 가장
                  직관적으로 확인할 수 있는 지표가 바로 <strong>답장 속도(Reply Latency)</strong>와{' '}
                  <strong>발화 빈도(Speech Frequency)</strong>입니다.
                </p>
                <p>
                  예를 들어, 상대방이 평소 30분~1시간 후에 답장하던 패턴에서 갑자기 5분
                  이내로 빠른 답장을 시작했다면, 이는 관심도 상승의 강력한 신호로 해석됩니다.
                  반대로 답장 간격이 점점 길어지고 문장 길이가 짧아진다면(「ㅇㅇ」, 「ㅋㅋ」,
                  「나중에」 등), 심리적 거리두기가 진행 중일 수 있습니다.
                </p>
                <p>
                  또한 <strong>먼저 연락하는 비율</strong>도 중요합니다. 50:50에 가까울수록
                  균형 잡힌 관계이며, 한쪽이 70% 이상 먼저 연락한다면 대화 주도권의 불균형이
                  형성되고 있을 가능성이 높습니다. 본 서비스의 AI 분석 엔진은 이러한 시간
                  패턴과 텍스트 빈도를 종합적으로 평가하여 0~100점 척도의 호감 점수를
                  산출합니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
          <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center font-bold text-lg">
              2
            </span>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                대화 주도권(Dominance) 분석 알고리즘의 기준
              </h3>
              <div className="prose prose-gray text-gray-600 leading-relaxed space-y-4 text-sm md:text-base">
                <p>
                  대화 주도권(Dominance)이란 대화의 방향, 주제 선택, 감정적 에너지를 누가
                  더 많이 이끌어가는지를 나타내는 지표입니다. 단순히 메시지 수가 많다고
                  주도권을 갖는 것은 아닙니다. AI 분석 알고리즘은 다음 4가지 핵심 요소를
                  종합합니다.
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>주제 개시율(Topic Initiation Rate):</strong> 새로운 대화 주제를
                    먼저 제안하는 비율. 「오늘 뭐 먹었어?」, 「주말에 뭐해?」 같은
                    질문형 발화를 추적합니다.
                  </li>
                  <li>
                    <strong>감정 표현 밀도(Emotional Expression Density):</strong> 이모티콘,
                    「ㅋㅋㅋ」, 「ㅠㅠ」, 하트 이모지 등 감정을 드러내는 표현의 빈도와
                    다양성을 측정합니다.
                  </li>
                  <li>
                    <strong>응답 주도성(Response Leadership):</strong> 상대의 질문에
                    단답으로 끝내지 않고, 되묻거나 새로운 화제로 전환하는 패턴을 분석합니다.
                  </li>
                  <li>
                    <strong>답장 길이 비율(Message Length Ratio):</strong> 평균 메시지
                    길이가 길수록 대화에 더 많은 에너지를 투입하고 있다는 신호입니다.
                  </li>
                </ul>
                <p>
                  이 4가지 지표를 가중 평균하여 인물A와 인물B의 주도권 비율을 시각화합니다.
                  건강한 썸 관계에서는 55:45~60:40 정도의 약간의 역동성이 오히려 긍정적이며,
                  80:20 이상의 극단적 불균형은 관계의 지속 가능성을 점검해 볼 필요가
                  있습니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg">
              3
            </span>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                안전한 AI 심리 분석 서비스 이용 가이드
              </h3>
              <div className="prose prose-gray text-gray-600 leading-relaxed space-y-4 text-sm md:text-base">
                <p>
                  heydaystar 카톡 밀당 감정 분석기는 사용자의 프라이버시를 최우선으로
                  설계되었습니다. 대화 내용은 <strong>서버에 저장되지 않으며</strong>, 분석
                  요청 시 브라우저 내에서 실명이 [인물A], [인물B] 형태로 자동 익명화된 후
                  AI API로 전송됩니다.
                </p>
                <p>
                  <strong>올바른 이용 방법:</strong> 카카오톡 앱에서 대화방 → 메뉴(≡) →
                  대화 내용 내보내기 → 텍스트 파일 저장 후, 해당 텍스트를 복사하여
                  분석기에 붙여넣으세요. 최소 20~30줄 이상의 대화 데이터가 있을수록
                  분석 정확도가 높아집니다.
                </p>
                <p>
                  <strong>주의사항:</strong> 본 서비스의 분석 결과는 AI 기반 참고 자료이며,
                  전문 심리 상담을 대체하지 않습니다. 상대방의 사생활을 존중하며, 분석
                  결과를 무단으로 공유하거나 악용하지 마세요. 연애는 숫자로 완전히
                  정의될 수 없지만, 객관적 데이터는 감정에 휩쓸릴 때 현명한 판단을
                  돕는 나침반이 될 수 있습니다.
                </p>
                <p>
                  heydaystar는 지속적으로 분석 알고리즘을 개선하고 있으며, 더 정확하고
                  유용한 연애 심리 인사이트를 제공하기 위해 노력하고 있습니다. 소중한
                  대화 데이터와 함께, 더 나은 관계를 향한 첫걸음을 시작해 보세요.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="mt-12 pt-8 border-t border-gray-200 text-center text-sm text-gray-400">
        <p>© {new Date().getFullYear()} heydaystar · 카톡 밀당 감정 분석기</p>
        <p className="mt-1">www.heydaystar.co.kr</p>
      </footer>
    </article>
    </details>
  )
}
