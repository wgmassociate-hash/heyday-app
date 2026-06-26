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
    <div className="mb-5">
      <div className="flex gap-1 p-1 rounded-xl bg-gray-100 mb-3 max-w-md mx-auto">
        <button
          type="button"
          onClick={() => setTab('screenshot')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
            tab === 'screenshot'
              ? 'bg-white text-violet-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📸 스크린샷
          <span className="block text-[10px] font-normal opacity-80">모바일 추천</span>
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
          📄 텍스트·txt
          <span className="block text-[10px] font-normal opacity-80">PC·내보내기</span>
        </button>
      </div>
      <p className="text-center text-xs text-gray-400 mb-4">
        카톡 · LINE · 문자 대화 모두 가능
      </p>

      {tab === 'screenshot' ? (
        <ScreenshotImportPanel onTextLoaded={onTextLoaded} />
      ) : (
        <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4 md:p-5">
          <h3 className="font-bold text-gray-800 text-sm mb-1 flex items-center gap-2">
            <span>📄</span> 텍스트 · txt로 불러오기
          </h3>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            PC 카톡은 대화를 드래그해서 복사·붙여넣기, 모바일은 txt 내보내기 파일을 선택하세요.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-sky-200 text-sm font-medium text-sky-700 cursor-pointer hover:bg-sky-50 transition-colors">
              txt 파일 선택
              <input type="file" accept=".txt,text/plain" className="hidden" onChange={handleFile} />
            </label>
            <button
              type="button"
              onClick={handlePaste}
              className="px-4 py-2 rounded-xl bg-white border border-sky-200 text-sm font-medium text-sky-700 hover:bg-sky-50 transition-colors"
            >
              📋 클립보드 붙여넣기
            </button>
          </div>

          <details className="text-xs text-gray-600 leading-relaxed">
            <summary className="cursor-pointer font-semibold text-gray-700 mb-2">
              카카오톡 txt 내보내기 방법
            </summary>
            <ol className="list-decimal pl-4 space-y-2 mt-2">
              <li>
                <strong>대화방</strong> → <strong>≡ 메뉴</strong> → <strong>대화 내용</strong>
              </li>
              <li>
                <strong>텍스트(.txt)로 저장</strong> → 파일을 이 페이지에 업로드
              </li>
            </ol>
            <p className="mt-3 text-gray-500">
              PC 카톡은 대화 드래그 → 붙여넣기도 가능합니다.
            </p>
          </details>
        </div>
      )}
    </div>
  )
}
