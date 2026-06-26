const DEFAULT_MAX_WIDTH = 1280
const DEFAULT_QUALITY = 0.78

/**
 * 업로드 전 클라이언트에서 JPEG로 리사이즈해 Vision API 비용을 줄입니다.
 * @param {File|Blob} file
 * @param {{ maxWidth?: number, quality?: number }} [opts]
 * @returns {Promise<{ blob: Blob, base64: string, mediaType: string }>}
 */
export function compressImageForUpload(file, opts = {}) {
  const maxWidth = opts.maxWidth ?? DEFAULT_MAX_WIDTH
  const quality = opts.quality ?? DEFAULT_QUALITY

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('캔버스를 사용할 수 없습니다'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          if (!blob) {
            reject(new Error('이미지 압축에 실패했습니다'))
            return
          }
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result
            if (typeof dataUrl !== 'string') {
              reject(new Error('이미지 인코딩 실패'))
              return
            }
            const base64 = dataUrl.split(',')[1] || ''
            resolve({ blob, base64, mediaType: 'image/jpeg' })
          }
          reader.onerror = () => reject(new Error('이미지 인코딩 실패'))
          reader.readAsDataURL(blob)
        },
        'image/jpeg',
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지를 불러올 수 없습니다'))
    }
    img.src = url
  })
}
