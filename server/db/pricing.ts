// Public per-token pricing for models this app calls, used only to produce a
// cost *estimate* for usage logging (docs/implementation_plan_v2.md §17).
// Not authoritative billing — Anthropic's own invoice is the source of truth.
const PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = PRICING_PER_MILLION_TOKENS[model];
  if (!rate) return 0; // unknown model — don't guess a price
  return (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
}
