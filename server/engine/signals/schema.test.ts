// Phase 1 — verifies the Signal Extraction schema has no numeric field
// anywhere (docs/implementation_plan_v2.md §20 Phase 1 completion criterion
// #4, §15.1: "숫자 필드가 없다는 원칙은 유지된다"). Walks the zod schema's
// internal shape rather than eyeballing schema.ts, so this actually fails if
// a future edit accidentally reintroduces a number field (e.g. a `strength`).
import { describe, expect, test } from 'vitest'
import { ReciprocityPairSchema, RelationshipSignalSchema, SignalExtractionResponseSchema } from './schema.js'

// Minimal structural type for what we need from zod v4's internal `_def` —
// avoids depending on zod's (unstable) internal type exports.
interface ZodLike {
  _def?: { type?: string }
  shape?: Record<string, ZodLike>
  element?: ZodLike
  unwrap?: () => ZodLike
}

function collectTypes(schema: ZodLike, seen = new Set<ZodLike>()): string[] {
  if (seen.has(schema)) return []
  seen.add(schema)

  const types: string[] = []
  if (schema._def?.type) types.push(schema._def.type)

  if (schema.shape) {
    for (const child of Object.values(schema.shape)) types.push(...collectTypes(child, seen))
  }
  if (schema.element) types.push(...collectTypes(schema.element, seen))
  if (typeof schema.unwrap === 'function') {
    types.push(...collectTypes(schema.unwrap(), seen))
  }
  return types
}

describe('Signal Extraction schema has no numeric field', () => {
  test('RelationshipSignalSchema', () => {
    const types = collectTypes(RelationshipSignalSchema as unknown as ZodLike)
    expect(types).not.toContain('number')
  })

  test('ReciprocityPairSchema (Phase 1.1)', () => {
    const types = collectTypes(ReciprocityPairSchema as unknown as ZodLike)
    expect(types).not.toContain('number')
  })

  test('SignalExtractionResponseSchema (including the nested signals + reciprocityPairs arrays)', () => {
    const types = collectTypes(SignalExtractionResponseSchema as unknown as ZodLike)
    expect(types).not.toContain('number')
  })
})
