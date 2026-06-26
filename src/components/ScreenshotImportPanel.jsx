import { useCallback, useRef, useState } from 'react'
import { ocrScreenshots, MAX_SCREENSHOTS } from '../utils/ocrScreenshots.js'
import { anonymizeChatText } from '../utils/parseChat.js'

let nextId = 1

function moveItem(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export default function ScreenshotImportPanel({ onTextLoaded }) {
  const [items, setItems] = useState([])
  const [dragIndex, setDragIndex] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [doneMessage, setDoneMessage] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const addFiles = useCallback((fileList) => {
    const incoming = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'))
    if (incoming.length === 0) return

    setItems((prev) => {
      const room = MAX_SCREENSHOTS - prev.length
      const slice = incoming.slice(0, Math.max(0, room))
      const added = slice.map((file) => ({
        id: nextId++,
        file,
        previewUrl: URL.createObjectURL(file),
      }))
      return [...prev, ...added]
    })
    setError('')
    setDoneMessage('')
  }, [])

  const removeItem = (id) => {
    setItems((prev) => {
      const target = prev.find((x) => x.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((x) => x.id !== id)
    })
  }

  const handleExtract = async () => {
    if (items.length === 0) return
    setExtracting(true)
    setError('')
    setDoneMessage('')
    try {
      const data = await ocrScreenshots(items.map((x) => x.file))
      const raw = data.mergedText || ''
      const { anonymizedText, nameMap } = anonymizeChatText(raw)

      if (Object.keys(nameMap).length === 0 && !anonymizedText.includes('나 :')) {
        setError('발화자 이름을 찾지 못했습니다. 스크린샷이 더 선명한지 확인해 주세요.')
        return
      }

      onTextLoaded(anonymizedText)
      setDoneMessage('아래 「대화 내용 확인」으로 이동했습니다. 본인=나, 상대=사용자 형식입니다.')
      document.getElementById('step-review-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (err) {
      setError(err?.message || '텍스트 추출에 실패했습니다.')
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-white p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <span>📸</span> 스크린샷으로 불러오기
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
              모바일 추천
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            카톡 대화 화면을 캡처한 뒤, <strong>위→아래 순서</strong>로 올려주세요. (최대 {MAX_SCREENSHOTS}장)
          </p>
          <ol className="mt-2 text-xs text-gray-500 space-y-1 list-decimal pl-4">
            <li>스크린샷 추가 → 순서 확인</li>
            <li>추출 및 익명화 → 2단계 입력창에 자동 반영</li>
          </ol>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={items.length >= MAX_SCREENSHOTS}
          className="px-4 py-2 rounded-xl bg-white border border-violet-200 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-40 transition-colors"
        >
          ➕ 스크린샷 추가
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        {items.length > 0 && (
          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {extracting ? '추출 · 익명화 중…' : '🔍 추출 및 익명화'}
          </button>
        )}
      </div>

      {items.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
          {items.map((item, index) => (
            <li
              key={item.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex == null) return
                setItems((prev) => moveItem(prev, dragIndex, index))
                setDragIndex(null)
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`relative rounded-xl border bg-white overflow-hidden shadow-sm ${
                dragIndex === index ? 'border-violet-400 ring-2 ring-violet-200' : 'border-gray-200'
              }`}
            >
              <div className="absolute top-1 left-1 z-10 w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shadow">
                {index + 1}
              </div>
              <img
                src={item.previewUrl}
                alt={`스크린샷 ${index + 1}`}
                className="w-full aspect-[9/16] object-cover object-top"
              />
              <div className="flex border-t border-gray-100">
                <button
                  type="button"
                  aria-label="위로"
                  disabled={index === 0}
                  onClick={() => setItems((prev) => moveItem(prev, index, index - 1))}
                  className="flex-1 py-1 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="아래로"
                  disabled={index === items.length - 1}
                  onClick={() => setItems((prev) => moveItem(prev, index, index + 1))}
                  className="flex-1 py-1 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="삭제"
                  onClick={() => removeItem(item.id)}
                  className="flex-1 py-1 text-xs text-red-500 hover:bg-red-50"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {extracting && (
        <p className="text-sm text-violet-600 animate-pulse-soft mb-3">
          AI가 대화를 읽는 중… 본인=「나」, 상대=「사용자」로 정리합니다 (10~30초)
        </p>
      )}

      {doneMessage && (
        <p className="text-sm text-emerald-600 font-medium mb-3">{doneMessage}</p>
      )}

      {error && (
        <p className="text-sm text-red-600 mb-3">{error}</p>
      )}

      <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
        이미지는 텍스트 추출 후 서버에 저장하지 않습니다.
      </p>
    </div>
  )
}
