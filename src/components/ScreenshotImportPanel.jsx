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
      setDoneMessage('✅ 아래 입력창에 넣었어!')
      document.getElementById('chat-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch (err) {
      setError(err?.message || '실패했어. 다시 시도해봐')
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 mb-4">
      <p className="text-sm font-bold text-gray-800 mb-1">📸 캡처 올리기</p>
      <p className="text-xs text-gray-500 mb-3">위→아래 순서 · 최대 {MAX_SCREENSHOTS}장</p>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={items.length >= MAX_SCREENSHOTS}
          className="px-4 py-2.5 rounded-xl bg-white border border-violet-200 text-sm font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-40"
        >
          ➕ 사진 추가
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
            className="px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50"
          >
            {extracting ? '읽는 중...' : '🔍 글자 뽑기'}
          </button>
        )}
      </div>

      {items.length > 0 && (
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
      )}

      {extracting && (
        <p className="text-sm text-violet-600 animate-pulse-soft mb-2">AI가 읽는 중... 20초쯤 걸려</p>
      )}
      {doneMessage && <p className="text-sm text-emerald-600 font-bold mb-2">{doneMessage}</p>}
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
    </div>
  )
}
