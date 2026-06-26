import { useState } from 'react'
import ScreenshotImportPanel from './ScreenshotImportPanel'
import { deliverChatText } from '../utils/deliverChatText.js'

export default function MobileImportPanel({ onTextLoaded }) {
  const [tab, setTab] = useState('screenshot')

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text === 'string') deliverChatText(text, onTextLoaded)
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text?.trim()) deliverChatText(text, onTextLoaded)
      else alert('클립보드가 비어 있습니다.')
    } catch {
      alert('붙여넣기 권한이 필요합니다. 입력창을 길게 눌러 붙여넣기 해주세요.')
    }
  }

  return (
    <div className="mb-4">
      <div className="flex gap-1 p-1 rounded-2xl bg-gray-100 mb-3">
        <button
          type="button"
          onClick={() => setTab('screenshot')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
            tab === 'screenshot'
              ? 'bg-white text-violet-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📸 캡처
          <span className="block text-[10px] font-normal opacity-80">폰 추천</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('text')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
            tab === 'text'
              ? 'bg-white text-sky-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📄 붙여넣기
          <span className="block text-[10px] font-normal opacity-80">PC·txt</span>
        </button>
      </div>
      <p className="text-center text-[11px] text-gray-400 mb-3">카톡 · LINE · 문자 OK</p>

      {tab === 'screenshot' ? (
        <ScreenshotImportPanel onTextLoaded={onTextLoaded} />
      ) : (
        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
          <p className="text-sm font-bold text-gray-800 mb-3">📄 txt · 붙여넣기</p>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-sky-200 text-sm font-bold text-sky-700 cursor-pointer hover:bg-sky-50">
              txt 파일
              <input type="file" accept=".txt,text/plain" className="hidden" onChange={handleFile} />
            </label>
            <button
              type="button"
              onClick={handlePaste}
              className="px-4 py-2.5 rounded-xl bg-white border border-sky-200 text-sm font-bold text-sky-700 hover:bg-sky-50"
            >
              📋 붙여넣기
            </button>
          </div>

          <details className="text-xs text-gray-500 mt-3">
            <summary className="cursor-pointer font-semibold text-gray-600">txt 저장 방법</summary>
            <p className="mt-2 pl-1">카톡 ≡ → 대화 내용 → txt 저장</p>
          </details>
        </div>
      )}
    </div>
  )
}
