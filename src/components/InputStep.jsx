import PrivacyBadge from './PrivacyBadge'
import SeoContent from './SeoContent'
import UsageGuide from './UsageGuide'
import MobileImportPanel from './MobileImportPanel'
import SelfSpeakerPick from './SelfSpeakerPick'
import { extractSpeakerNames } from '../utils/parseChat.js'
import { isAlreadyAnonymized, textHasSelfSpeaker, needsSelfSpeakerSelection } from '../utils/speakerLabels.js'

export default function InputStep({ chatText, onChange, onSubmit, isValid }) {
  const speakers = chatText.trim() ? extractSpeakerNames(chatText) : []
  const hasText = chatText.trim().length > 0
  const anonymized = isAlreadyAnonymized(chatText)
  const needsSelfPick = needsSelfSpeakerSelection(chatText)
  const canAnalyze = isValid && !needsSelfPick

  return (
    <div className="animate-fade-in">
      <section className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-sm font-medium mb-4">
          <span>💬</span>
          <span>무료 AI 대화 분석</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-3">
          카톡 대화,
          <span className="text-brand-500"> 감정 분석해 드려요</span>
        </h1>
        <p className="text-gray-500 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
          카카오톡 · LINE · 문자 대화를 올리면
          <br className="hidden sm:block" />
          호감도·밀당·심리 패턴을 AI가 분석합니다
        </p>
      </section>

      <div className="max-w-2xl mx-auto">
        <UsageGuide />

        <div className="flex justify-center mb-6">
          <PrivacyBadge />
        </div>

        {/* 1단계 */}
        <section className="mb-6" aria-labelledby="step-import-heading">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold shrink-0">
              1
            </span>
            <h2 id="step-import-heading" className="font-bold text-gray-800 text-base">
              대화 가져오기
            </h2>
          </div>
          <p className="text-sm text-gray-500 mb-4 leading-relaxed">
            아래 방법 중 편한 걸 선택하세요.
            <strong className="text-gray-700 font-medium"> 모바일</strong>은 스크린샷,
            <strong className="text-gray-700 font-medium"> PC</strong>는 드래그·붙여넣기가 편합니다.
          </p>
          <MobileImportPanel onTextLoaded={onChange} />
        </section>

        {/* 2단계 */}
        <section className="mb-6" aria-labelledby="step-review-heading">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold shrink-0">
              2
            </span>
            <h2 id="step-review-heading" className="font-bold text-gray-800 text-base">
              대화 내용 확인
            </h2>
          </div>
          <p className="text-sm text-gray-500 mb-3 leading-relaxed">
            스크린샷은 자동으로 「나」/「사용자」로 정리됩니다.
            txt·PC 붙여넣기는 <strong className="text-gray-700">본인 카톡 이름</strong>이 보이므로, 아래에서
            본인을 선택하면 「나」로 바뀝니다.
          </p>

          <label htmlFor="chat-input" className="sr-only">
            대화 내용
          </label>
          <textarea
            id="chat-input"
            value={chatText}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`여기에 대화를 붙여넣거나, 위에서 스크린샷·txt로 불러오세요.

예시 (PC 카톡 드래그):
2024년 6월 26일 오후 2:30
민수 : 오늘 뭐해?
수진 : 집에 있어 ㅎㅎ`}
            rows={10}
            className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white shadow-sm
                       text-gray-800 placeholder:text-gray-400 text-sm leading-relaxed
                       focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                       resize-y min-h-[200px] transition-shadow"
          />

          {anonymized && textHasSelfSpeaker(chatText) && (
            <p className="mt-2 text-xs text-emerald-600 font-medium">
              🔒 본인 「나」, 상대방 「사용자」 (또는 사용자A/B)로 정리된 상태입니다
            </p>
          )}
          {anonymized && !textHasSelfSpeaker(chatText) && (
            <p className="mt-2 text-xs text-amber-600 font-medium">
              ⚠️ 본인 「나」 표시가 없습니다. 아래에서 본인을 선택해 주세요.
            </p>
          )}
          {!anonymized && hasText && speakers.length > 0 && !needsSelfPick && (
            <p className="mt-2 text-xs text-emerald-600 font-medium">
              🔒 발화자 {speakers.length}명 감지됨
            </p>
          )}
          {needsSelfPick && (
            <p className="mt-2 text-xs text-amber-600 font-medium">
              ⚠️ 분석 전에 아래에서 본인(카톡 이름)을 선택해 주세요.
            </p>
          )}

          <SelfSpeakerPick chatText={chatText} onAssign={onChange} />
          {!anonymized && hasText && speakers.length === 0 && (
            <p className="mt-2 text-xs text-amber-600 leading-relaxed">
              ⚠️ 이름 형식을 찾지 못했어요. 「이름 : 메시지」 형식인지 확인하거나, txt 내보내기·스크린샷을
              이용해 주세요.
            </p>
          )}
          {!hasText && (
            <p className="mt-2 text-xs text-gray-400">
              최소 3줄 이상의 대화가 필요합니다.
            </p>
          )}
        </section>

        {/* 3단계 */}
        <section className="mb-8" aria-labelledby="step-analyze-heading">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold shrink-0">
              3
            </span>
            <h2 id="step-analyze-heading" className="font-bold text-gray-800 text-base">
              분석 시작
            </h2>
          </div>

          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canAnalyze}
              className="w-full sm:w-auto px-10 py-3.5 rounded-full bg-gradient-to-r from-brand-500 to-brand-600
                         text-white font-semibold text-base shadow-lg shadow-brand-200
                         hover:from-brand-600 hover:to-brand-700 hover:shadow-brand-300
                         disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
                         transition-all duration-200 active:scale-[0.98]"
            >
              🔍 AI로 대화 분석하기
            </button>
            <p className="text-center text-xs text-gray-400 mt-3 leading-relaxed max-w-sm">
              {needsSelfPick
                ? '본인 선택 후 분석할 수 있습니다.'
                : canAnalyze
                  ? '버튼을 누르면 10~30초 안에 분석 결과가 나옵니다.'
                  : '대화를 입력하면 분석 버튼이 활성화됩니다.'}
            </p>
          </div>
        </section>
      </div>

      <SeoContent />
    </div>
  )
}
