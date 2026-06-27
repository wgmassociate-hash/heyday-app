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
      <section className="text-center mb-8">
        <p className="text-4xl mb-3" aria-hidden="true">💬💕</p>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight mb-2">
          카톡 올리면
          <span className="text-brand-500"> 썸·호감도</span> 알려줘
        </h1>
        <p className="text-gray-500 text-sm md:text-base">
          스크린샷 · 붙여넣기 · txt 다 OK
        </p>
      </section>

      <div className="max-w-xl mx-auto">
        <UsageGuide />

        <div className="flex justify-center mb-5">
          <PrivacyBadge />
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 md:p-5 mb-5">
          <MobileImportPanel onTextLoaded={onChange} />

          <label htmlFor="chat-input" className="block text-sm font-bold text-gray-800 mb-2">
            💬 대화 내용
          </label>
          <textarea
            id="chat-input"
            value={chatText}
            onChange={(e) => onChange(e.target.value)}
            placeholder="여기에 카톡 붙여넣기 👇"
            rows={8}
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50/50
                       text-gray-800 placeholder:text-gray-400 text-sm leading-relaxed
                       focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                       resize-y min-h-[160px] transition-shadow"
          />

          {anonymized && textHasSelfSpeaker(chatText) && (
            <p className="mt-2 text-xs text-emerald-600 font-semibold">✅ 준비 완료!</p>
          )}
          {needsSelfPick && (
            <p className="mt-2 text-xs text-amber-600 font-semibold">👇 너 누구인지 골라줘</p>
          )}
          {!anonymized && hasText && speakers.length > 0 && !needsSelfPick && (
            <p className="mt-2 text-xs text-emerald-600 font-semibold">✅ {speakers.length}명 감지됨</p>
          )}
          {!hasText && (
            <p className="mt-2 text-xs text-gray-400">3줄 이상 넣어줘</p>
          )}

          <SelfSpeakerPick chatText={chatText} onAssign={onChange} />
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canAnalyze}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-500 to-violet-500
                     text-white font-black text-lg shadow-lg shadow-brand-200/80
                     hover:from-brand-600 hover:to-violet-600
                     disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
                     transition-all duration-200 active:scale-[0.98]"
        >
          {needsSelfPick ? '👆 먼저 본인 선택' : canAnalyze ? '🔥 호감도 확인하기' : '대화를 넣어줘'}
        </button>
        {canAnalyze && (
          <p className="text-center text-xs text-gray-400 mt-2">보통 20초면 끝!</p>
        )}
        <p className="text-center text-xs text-gray-500 mt-4">
          <a
            href="https://www.heydaystar.co.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-gray-300 hover:text-brand-600"
          >
            연애·심리 글 읽기 → heydaystar 블로그
          </a>
        </p>
      </div>

      <SeoContent />
    </div>
  )
}
