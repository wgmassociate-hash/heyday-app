// Phase 2.4 — shared score bucketing (Rich Free Preview / Reward Layer).
// Extracted from previewNarrative.ts's original private bucketize() so every
// narrative module (direct answer, relationship status, patterns, metric
// captions) buckets a 0-100 score the same way instead of each re-picking its
// own thresholds. Behavior is unchanged from previewNarrative.ts's original.
export type ScoreBucket = 'low' | 'medium' | 'high'

export function bucketize(score: number): ScoreBucket {
  if (score < 40) return 'low'
  if (score < 70) return 'medium'
  return 'high'
}

/** Absolute gap between two speakers' scores on the same metric, used to
 * decide whether a "나 vs 상대" comparison is worth surfacing at all — a
 * small gap is noise, not a real asymmetry. */
export function gapBetween(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null
  return Math.abs(a - b)
}
