import { useState } from 'react'
import ScreenshotImportPanel from './ScreenshotImportPanel'
import { deliverChatText } from '../utils/deliverChatText.js'

export default function MobileImportPanel({ chatText, onChange }) {
  const [tab, setTab] = useState('screenshot')
  const hasText = chatText.trim().length > 0
  const lineCount = chatText.trim().split('\n').filter(Boolean).length

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text === 'string') deliverChatText(text, onChange)
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text?.trim()) deliverChatText(text, onChange)
      else alert('클립보드가 비어 있어요. 카톡에서 복사한 뒤 다시 눌러줘.')
    } catch {
      alert('붙여넣기 권한이 필요해요. 아래 칸을 길게 눌러 붙여넣기 해줘.')
    }
  }

  return (
    <div>
      <p className="text-center text-sm font-bold text-gray-800 mb-3">
        어떻게 올릴까?
      </p>

      <div className="flex gap-1 p-1 rounded-2xl bg-gray-100 mb-4" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'screenshot'}
          onClick={() => setTab('screenshot')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            tab === 'screenshot'
              ? 'bg-white text-violet-700 shadow-sm ring-1 ring-violet-200'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📸 카톡 캡처
          <span className="block text-[10px] font-semibold text-violet-500 mt-0.5">폰에서 추천</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'text'}
          onClick={() => setTab('text')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            tab === 'text'
              ? 'bg-white text-sky-700 shadow-sm ring-1 ring-sky-200'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📋 직접 붙여넣기
          <span className="block text-[10px] font-semibold text-sky-500 mt-0.5">PC · txt</span>
        </button>
      </div>

      {tab === 'screenshot' ? (
        <div role="tabpanel">
          {!hasText && (
            <ol className="mb-4 space-y-2 text-xs text-gray-600 bg-violet-50/80 border border-violet-100 rounded-2xl p-3">
              <li className="flex gap-2">
                <span className="shrink-0 font-black text-violet-600">①</span>
                <span>카톡 대화 <strong>스크린샷</strong> 찍기 (위→아래 순)</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-black text-violet-600">②</span>
                <span>아래 <strong>사진 추가</strong> 누르기</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 font-black text-violet-600">③</span>
                <span><strong>글자 뽑기</strong> → 확인 후 분석 시작</span>
              </li>
            </ol>
          )}
          <ScreenshotImportPanel onTextLoaded={onChange} />
        </div>
      ) : (
        <div role="tabpanel">
          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 mb-4">
            <p className="text-sm font-bold text-gray-800 mb-1">📋 카톡 대화 붙여넣기</p>
            <p className="text-xs text-gray-500 mb-3">
              카톡에서 대화 긁어서 아래 칸에 붙여넣거나, txt 파일을 올려줘
            </p>

            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={handlePaste}
                className="px-4 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-bold hover:bg-sky-700 active:scale-[0.98]"
              >
                📋 클립보드 붙여넣기
              </button>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-sky-200 text-sm font-bold text-sky-700 cursor-pointer hover:bg-sky-50">
                📄 txt 파일
                <input type="file" accept=".txt,text/plain" className="hidden" onChange={handleFile} />
              </label>
            </div>

            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer font-semibold text-gray-600">txt 저장하는 법</summary>
              <p className="mt-2 pl-1">카톡 ≡ → 대화 내용 → txt 저장</p>
            </details>
          </div>

          <label htmlFor="chat-input" className="block text-sm font-bold text-gray-800 mb-2">
            💬 대화 내용
          </label>
          <textarea
            id="chat-input"
            value={chatText}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`예시)\n2024. 6. 1. 오후 3:00, 나 : 안녕\n2024. 6. 1. 오후 3:01, 상대 : ㅎㅎ 안녕\n\n카톡에서 복사해서 여기 붙여넣기 👇`}
            rows={9}
            className="w-full px-4 py-3 rounded-2xl border-2 border-sky-200 bg-white
                       text-gray-800 placeholder:text-gray-400 text-sm leading-relaxed
                       focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent
                       resize-y min-h-[180px] transition-shadow"
          />
          {!hasText ? (
            <p className="mt-2 text-xs text-gray-400">3줄 이상 넣으면 분석할 수 있어</p>
          ) : lineCount < 3 ? (
            <p className="mt-2 text-xs text-amber-600 font-semibold">조금만 더! 3줄 이상 필요해 ({lineCount}/3줄)</p>
          ) : (
            <p className="mt-2 text-xs text-emerald-600 font-semibold">✅ {lineCount}줄 준비됨</p>
          )}
        </div>
      )}

      {hasText && tab === 'screenshot' && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-bold text-gray-800">✅ 읽은 대화 확인</p>
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs font-semibold text-gray-400 hover:text-red-500"
            >
              처음부터
            </button>
          </div>
          <textarea
            id="chat-input-review"
            value={chatText}
            onChange={(e) => onChange(e.target.value)}
            rows={5}
            className="w-full px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40
                       text-gray-800 text-xs leading-relaxed
                       focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-y min-h-[100px]"
          />
          {lineCount < 3 ? (
            <p className="mt-2 text-xs text-amber-600 font-semibold">대화가 너무 짧아. 캡처를 더 추가해봐 ({lineCount}/3줄)</p>
          ) : (
            <p className="mt-2 text-xs text-emerald-600 font-semibold">👇 확인했으면 아래 분석 버튼 눌러!</p>
          )}
        </div>
      )}
    </div>
  )
}
