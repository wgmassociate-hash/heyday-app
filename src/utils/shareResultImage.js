const DEFAULT_FILE_NAME = 'heydaystar-카톡관계분석-요약.png'
const DEFAULT_SHARE_TITLE = 'heydaystar 카톡 관계 분석'
const DEFAULT_SHARE_TEXT = '카톡 대화로 관계의 흐름을 읽어봤어. 너도 heydaystar에서 분석해봐!'

function appUrl() {
  return typeof window !== 'undefined' ? window.location.origin : 'https://www.heydaystar.co.kr'
}

function shouldIncludeNode(node) {
  if (!(node instanceof Element)) return true
  if (node.dataset.exportExclude !== undefined) return false
  return true
}

/** @param {HTMLElement} exportElement */
export async function captureResultExportBlob(exportElement) {
  if (!exportElement) throw new Error('저장할 결과를 찾을 수 없어요')

  await document.fonts.ready
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

  // The image encoder is only needed after an explicit save/share action;
  // keep it out of the initial analysis experience.
  const { toBlob } = await import('html-to-image')
  const height = exportElement.scrollHeight
  const pixelRatio = height > 8000 ? 1 : height > 5000 ? 1.25 : 2

  const blob = await toBlob(exportElement, {
    cacheBust: true,
    pixelRatio,
    backgroundColor: '#fdf2f8',
    filter: shouldIncludeNode,
  })

  if (!blob) throw new Error('이미지 생성 실패')
  return blob
}

export function downloadShareBlob(blob, fileName = DEFAULT_FILE_NAME) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** @param {HTMLElement} exportElement */
export async function saveResultImage(exportElement, fileName = DEFAULT_FILE_NAME) {
  const blob = await captureResultExportBlob(exportElement)
  downloadShareBlob(blob, fileName)
  return blob
}

/**
 * @returns {'shared' | 'downloaded'}
 */
export async function shareResultImage(exportElement, {
  fileName = DEFAULT_FILE_NAME,
  title = DEFAULT_SHARE_TITLE,
  text = DEFAULT_SHARE_TEXT,
} = {}) {
  const blob = await captureResultExportBlob(exportElement)
  const file = new File([blob], fileName, { type: 'image/png' })

  if (navigator.share) {
    try {
      const payload = {
        title,
        text,
        url: appUrl(),
      }
      if (navigator.canShare?.({ files: [file] })) {
        payload.files = [file]
      }
      await navigator.share(payload)
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') throw err
    }
  }

  downloadShareBlob(blob, fileName)
  return 'downloaded'
}
