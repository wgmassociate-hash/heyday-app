import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env') })

const { asyncHandler } = await import('./asyncHandler.js')
const { analyzeWithClaude } = await import('./analyze.js')
const { runPreviewAnalysis } = await import('./previewAnalyze.ts')
const { extractChatFromScreenshots } = await import('./ocrScreenshots.js')
const { anonymizeChatText, getConversationMeta, parseMessages } = await import('../src/utils/parseChat.js')
const { scrubResultNames } = await import('../src/utils/scrubResult.js')
const { isValidIntent } = await import('../shared/intentOptions.js')
const {
  parseDeviceId,
  getQuotaStatus,
  assertCanUseQuota,
  consumeQuota,
  grantShareBonus,
} = await import('./quota.js')
const { corsOriginCallback } = await import('./corsConfig.ts')
const { DatabaseUnavailableError } = await import('./db/fallbackPolicy.ts')

const app = express()
const PORT = process.env.PORT || 3001
const isProd = process.env.NODE_ENV === 'production'

/** True for a Postgres outage that the fallback policy refused to hide
 * (docs/implementation_plan_v2.md §Phase 0.5 fallback policy) — surfaced as
 * 503 everywhere, instead of a generic 500, so it's obviously infra-side. */
function isDatabaseUnavailable(err) {
  return err instanceof DatabaseUnavailableError || err?.name === 'DatabaseUnavailableError'
}

app.use(cors({ origin: corsOriginCallback }))
app.use(express.json({ limit: '12mb' }))

app.use((_req, res, next) => {
  res.setTimeout(180_000)
  next()
})

/** AdSense ads.txt — Render 환경 변수 ADSENSE_PUBLISHER_ID 만 넣으면 자동 생성 */
app.get('/ads.txt', (_req, res) => {
  let pub = String(process.env.ADSENSE_PUBLISHER_ID || '').trim()
  if (!pub) {
    return res.status(404).type('text/plain').send('# ADSENSE_PUBLISHER_ID not configured\n')
  }
  pub = pub.replace(/^ca-pub-/i, 'pub-')
  if (!pub.startsWith('pub-')) pub = `pub-${pub}`
  res
    .type('text/plain')
    .send(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`)
})

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    ocrModel: process.env.ANTHROPIC_OCR_MODEL || 'claude-haiku-4-5',
  })
})

app.get('/api/quota', asyncHandler(async (req, res) => {
  const deviceId = parseDeviceId(req)
  if (!deviceId) {
    return res.status(400).json({ error: '기기 ID가 필요합니다.' })
  }
  res.json(await getQuotaStatus(deviceId))
}))

app.post('/api/quota/share', asyncHandler(async (req, res) => {
  const deviceId = parseDeviceId(req)
  if (!deviceId) {
    return res.status(400).json({ ok: false, error: '기기 ID가 필요합니다.' })
  }
  const result = await grantShareBonus(deviceId)
  if (!result.ok) {
    return res.status(429).json({ ok: false, error: result.error, quota: result.status })
  }
  res.json({ ok: true, quota: result.status })
}))

app.post('/api/ocr-screenshots', asyncHandler(async (req, res) => {
  const { images } = req.body ?? {}
  const deviceId = parseDeviceId(req)

  if (!deviceId) {
    return res.status(400).json({ error: '기기 ID가 필요합니다. 페이지를 새로고침해 주세요.' })
  }

  const quotaCheck = await assertCanUseQuota(deviceId)
  if (!quotaCheck.ok) {
    return res.status(429).json({
      error: quotaCheck.error,
      quota: quotaCheck.status,
      code: 'QUOTA_EXCEEDED',
    })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: isProd
        ? 'API 키가 설정되지 않았습니다. Render → Environment → ANTHROPIC_API_KEY를 추가한 뒤 재배포하세요.'
        : 'API 키가 설정되지 않았습니다. .env 파일에 ANTHROPIC_API_KEY를 추가하세요.',
    })
  }

  try {
    const result = await extractChatFromScreenshots(images, deviceId)
    const consumed = await consumeQuota(deviceId)
    res.json({ ...result, quota: consumed.status })
  } catch (err) {
    console.error('[ocr]', err.message)
    if (isDatabaseUnavailable(err)) {
      return res.status(503).json({ error: err.message, code: 'DATABASE_UNAVAILABLE' })
    }
    const status = /API 키|스크린샷|이미지|잘못된/.test(err.message) ? 400 : 500
    res.status(status).json({ error: err.message || '스크린샷 OCR에 실패했습니다.' })
  }
}))

app.post('/api/analyze', asyncHandler(async (req, res) => {
  // 2.0 Phase 0: the client no longer sends `nameMap` — it now redacts real
  // names (and phone numbers/emails) from the message body itself before this
  // request is ever made (src/utils/anonymize.js), so the server has nothing
  // to un-leak. anonymizeChatText() below is kept purely as a defense-in-depth
  // backstop (docs/implementation_plan_v2.md §6.2).
  const { text } = req.body ?? {}
  const deviceId = parseDeviceId(req)

  if (!deviceId) {
    return res.status(400).json({ error: '기기 ID가 필요합니다. 페이지를 새로고침해 주세요.' })
  }

  const quotaCheck = await assertCanUseQuota(deviceId)
  if (!quotaCheck.ok) {
    return res.status(429).json({
      error: quotaCheck.error,
      quota: quotaCheck.status,
      code: 'QUOTA_EXCEEDED',
      fallback: false,
    })
  }

  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return res.status(400).json({ error: '분석할 대화 텍스트가 너무 짧습니다.' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: isProd
        ? 'API 키가 설정되지 않았습니다. Render → Environment → ANTHROPIC_API_KEY를 추가한 뒤 재배포하세요.'
        : 'API 키가 설정되지 않았습니다. .env 파일에 ANTHROPIC_API_KEY를 추가하세요.',
      fallback: true,
    })
  }

  try {
    // Defense-in-depth only: on text the client has already anonymized, this
    // returns an empty map (isAlreadyAnonymized short-circuits). It only does
    // real work if non-anonymized text somehow reaches the server — never
    // logged with real names either way (analysis_v1.md §4.7 flagged the old
    // dev-only log as printing raw name→label pairs).
    const { anonymizedText, nameMap } = anonymizeChatText(text.trim())

    if (Object.keys(nameMap).length === 0) {
      console.warn('[analyze] 발화자 추출 실패했거나 이미 익명화된 텍스트입니다')
    } else if (!isProd) {
      console.log(`[analyze] 서버 측 익명화 백스톱 발동 (${Object.keys(nameMap).length}명)`)
    }

    let result = await analyzeWithClaude(anonymizedText, deviceId)
    result = scrubResultNames(result, nameMap)
    const meta = getConversationMeta(parseMessages(anonymizedText))
    const consumed = await consumeQuota(deviceId)
    res.json({
      ...result,
      conversationMeta: result.conversationMeta ?? meta,
      quota: consumed.status,
    })
  } catch (err) {
    console.error('[analyze]', err.message)
    if (isDatabaseUnavailable(err)) {
      return res.status(503).json({ error: err.message, code: 'DATABASE_UNAVAILABLE', fallback: false })
    }
    res.status(500).json({
      error: err.message || 'Claude API 분석 중 오류가 발생했습니다.',
      fallback: true,
    })
  }
}))

app.post('/api/preview', asyncHandler(async (req, res) => {
  // Phase 2 — Free Preview (docs/implementation_plan_v2.md §16.2). Same
  // privacy contract as /api/analyze above: the client has already redacted
  // names/phone numbers/emails from `text` before this request is made;
  // anonymizeChatText() here is a defense-in-depth backstop only.
  const { text, intent } = req.body ?? {}
  const deviceId = parseDeviceId(req)

  if (!deviceId) {
    return res.status(400).json({ error: '기기 ID가 필요합니다. 페이지를 새로고침해 주세요.' })
  }

  if (!isValidIntent(intent)) {
    return res.status(400).json({ error: '올바른 분석 목적을 선택해 주세요.' })
  }

  const quotaCheck = await assertCanUseQuota(deviceId)
  if (!quotaCheck.ok) {
    return res.status(429).json({
      error: quotaCheck.error,
      quota: quotaCheck.status,
      code: 'QUOTA_EXCEEDED',
    })
  }

  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return res.status(400).json({ error: '분석할 대화 텍스트가 너무 짧습니다.' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: isProd
        ? 'API 키가 설정되지 않았습니다. Render → Environment → ANTHROPIC_API_KEY를 추가한 뒤 재배포하세요.'
        : 'API 키가 설정되지 않았습니다. .env 파일에 ANTHROPIC_API_KEY를 추가하세요.',
    })
  }

  try {
    const { anonymizedText, nameMap } = anonymizeChatText(text.trim())
    let result = await runPreviewAnalysis(anonymizedText, intent, deviceId)
    result = scrubResultNames(result, nameMap)
    const consumed = await consumeQuota(deviceId)
    res.json({ ...result, quota: consumed.status })
  } catch (err) {
    console.error('[preview]', err.message)
    if (isDatabaseUnavailable(err)) {
      return res.status(503).json({ error: err.message, code: 'DATABASE_UNAVAILABLE' })
    }
    res.status(500).json({ error: err.message || 'Preview 분석 중 오류가 발생했습니다.' })
  }
}))

app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: '이미지 용량이 너무 큽니다. 스크린샷을 줄이거나 장 수를 줄여 주세요.' })
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: '요청 형식이 올바르지 않습니다.' })
  }
  if (isDatabaseUnavailable(err)) {
    console.error('[server] DB unavailable:', err.message)
    return res.status(503).json({ error: err.message, code: 'DATABASE_UNAVAILABLE' })
  }
  console.error('[server]', err)
  res.status(500).json({ error: err?.message || '서버 오류가 발생했습니다.' })
})

if (isProd) {
  const dist = join(__dirname, '../dist')
  app.use(express.static(dist))
  app.get(/^(?!\/api)(?!\/ads\.txt).*/, (_req, res) => {
    res.sendFile(join(dist, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`API server → http://localhost:${PORT}`)
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('✅ ANTHROPIC_API_KEY 로드됨')
  } else {
    console.warn('⚠️  ANTHROPIC_API_KEY 없음 — /api/analyze는 로컬 폴백으로 동작합니다')
  }
})
