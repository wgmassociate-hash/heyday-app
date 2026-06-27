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
        setError('이름을 못 찾았어. 더 선명한 캡처로 다시 해봐!')
        return
      }

      onTextLoaded(anonymizedText)
      setDoneMessage('✅ 대화 읽기 완료! 아래에서 확인하고 분석 버튼을 눌러줘')
      document.getElementById('chat-input-review')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch (err) {
      setError(err?.message || '실패했어. 다시 시도해봐')
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-4">
      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full py-8 px-4 rounded-xl bg-white border-2 border-violet-200 hover:border-violet-400 hover:bg-violet-50/50 active:scale-[0.99] transition-all"
        >
          <p className="text-3xl mb-2" aria-hidden="true">📷</p>
          <p className="text-base font-black text-violet-800 mb-1">여기 눌러서 캡처 선택</p>
          <p className="text-xs text-gray-500">갤러리에서 카톡 스크린샷 · 최대 {MAX_SCREENSHOTS}장</p>
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-sm font-bold text-gray-800">
              📸 캡처 {items.length}/{MAX_SCREENSHOTS}장
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={items.length >= MAX_SCREENSHOTS}
              className="px-3 py-1.5 rounded-lg bg-white border border-violet-200 text-xs font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-40"
            >
              ➕ 추가
            </button>
          </div>

          <ul className="grid grid-cols-3 gap-2 mb-3">
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
                className={`relative rounded-xl border bg-white overflow-hidden ${
                  dragIndex === index ? 'border-violet-400 ring-2 ring-violet-200' : 'border-gray-200'
                }`}
              >
                <div className="absolute top-1 left-1 z-10 w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {index + 1}
                </div>
                <img
                  src={item.previewUrl}
                  alt={`캡처 ${index + 1}`}
                  className="w-full aspect-[9/16] object-cover object-top"
                />
                <button
                  type="button"
                  aria-label="삭제"
                  onClick={() => removeItem(item.id)}
                  className="w-full py-1 text-xs text-red-500 hover:bg-red-50 border-t border-gray-100"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting}
            className="w-full py-3.5 rounded-xl bg-violet-600 text-white text-base font-black hover:bg-violet-700 disabled:opacity-50 active:scale-[0.98] shadow-md shadow-violet-200/80"
          >
            {extracting ? '⏳ AI가 글자 읽는 중...' : '③ 글자 뽑기 → 대화 확인'}
          </button>
        </>
      )}

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

      {extracting && (
        <p className="text-sm text-violet-600 animate-pulse-soft mt-3 text-center">20초쯤 걸려, 잠깐만!</p>
      )}
      {doneMessage && <p className="text-sm text-emerald-600 font-bold mt-3 text-center">{doneMessage}</p>}
      {error && <p className="text-sm text-red-600 mt-3 text-center">{error}</p>}
    </div>
  )
}
