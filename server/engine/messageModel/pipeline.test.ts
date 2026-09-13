// Phase 1 — end-to-end sanity check of Parser -> Standard Message Model ->
// Enrichment -> Code Feature Extractor, run against one of 1.0's real
// regression fixtures (samples/, docs/analysis_v1.md §3A "즉시 활용 가능한
// 테스트 스위트의 출발점"). Not a replacement for the parser's own
// regression tests (src/utils/parseChat.js is unmodified) — this only checks
// that the new Phase 1 layers wire up correctly on real-shaped input.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { computeOpportunities, extractCodeFeatures } from '../features/codeFeatureExtractor.js'
import { enrichMessages } from './enrich.js'
import { parseMessages } from './parseChatShim.js'
import { toStandardMessages } from './toStandardMessages.js'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const SAMPLE_PATH = join(REPO_ROOT, 'samples/01-romantic-some.txt')
const text = readFileSync(SAMPLE_PATH, 'utf8')

describe('Standard Message Model pipeline (Phase 1 sanity)', () => {
  test('toStandardMessages produces one Message per parsed line, in order', () => {
    const { messages, meta } = toStandardMessages(text, { sourceType: 'txt' })
    expect(messages.length).toBeGreaterThan(10)
    expect(messages[0].sourceType).toBe('txt')
    expect(meta.platform).toBe('kakao')
    for (let i = 1; i < messages.length; i++) {
      expect(Number(messages[i].id.replace('msg_', ''))).toBeGreaterThan(
        Number(messages[i - 1].id.replace('msg_', '')),
      )
    }
  })

  test('enrichMessages only assigns a response delay across a speaker change', () => {
    const raw = parseMessages(text)
    const { messages } = toStandardMessages(text, { sourceType: 'txt' })
    const enriched = enrichMessages(messages, raw)
    for (let i = 1; i < enriched.length; i++) {
      if (enriched[i].responseDelaySec != null) {
        expect(enriched[i].speakerId).not.toBe(enriched[i - 1].speakerId)
      }
    }
  })

  test('the very first message is always a conversation start', () => {
    const raw = parseMessages(text)
    const { messages } = toStandardMessages(text, { sourceType: 'txt' })
    const enriched = enrichMessages(messages, raw)
    expect(enriched[0].isConversationStart).toBe(true)
  })

  test('extractCodeFeatures counts every message exactly once across speakers', () => {
    const raw = parseMessages(text)
    const { messages } = toStandardMessages(text, { sourceType: 'txt' })
    const enriched = enrichMessages(messages, raw)
    const features = extractCodeFeatures(enriched)

    expect(features.speakerIds.length).toBe(2)
    const total = Object.values(features.messageCountBySpeaker).reduce((a, b) => a + b, 0)
    expect(total).toBe(enriched.length)

    const [a, b] = features.speakerIds
    const opportunities = computeOpportunities(features, a, b)
    expect(opportunities.actorMessageCount).toBe(features.messageCountBySpeaker[a])
    expect(opportunities.targetMessageCount).toBe(features.messageCountBySpeaker[b])
  })
})
