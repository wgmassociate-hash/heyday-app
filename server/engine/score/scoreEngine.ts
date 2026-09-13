// Phase 1 — Score Engine entry point (docs/implementation_plan_v2.md §10.1, §12).
// Pure function: same input always produces the same output, and it has no
// idea whether it's being called for a Preview or a Paid run — that
// distinction is the caller's job (§9.4, §12.4 — Phase 2/3 concern, not this
// file's). No LLM SDK import allowed in this directory — enforced by
// server/engine/importBoundary.test.ts (§10.2).
import { computeCore4 } from './core4.js'
import { computeRelationshipPosition } from './position.js'
import { computeRomanceScore } from './romance.js'
import { computeTemperature } from './temperature.js'
import type { CoreScoreResult, ScoreEngineInput } from './types.js'
import { WEIGHTS_VERSION } from './weights.js'

export function runScoreEngine(input: ScoreEngineInput): CoreScoreResult {
  const { codeFeatures, validatedSignals } = input
  const core4 = computeCore4({ codeFeatures, validatedSignals })

  const [speakerA, speakerB] = codeFeatures.speakerIds
  const temperature =
    speakerA && speakerB ? computeTemperature(core4, codeFeatures, speakerA, speakerB) : 0

  const romance = computeRomanceScore(validatedSignals, codeFeatures)
  const position = computeRelationshipPosition(temperature, romance)

  return {
    core4,
    temperature,
    romance,
    position,
    scoreEngineVersion: WEIGHTS_VERSION,
  }
}
