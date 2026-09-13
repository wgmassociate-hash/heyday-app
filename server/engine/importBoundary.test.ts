// Phase 1 — static enforcement of docs/implementation_plan_v2.md §10.2:
// "server/engine/score/**, server/engine/features/**에서 @anthropic-ai/sdk
// import를 린트로 금지."
//
// The plan's intended mechanism was an oxlint `no-restricted-imports`
// override (see .oxlintrc.json's `overrides` block). Verified live while
// building this: oxlint 1.69's `no-restricted-imports` is a registered rule
// name but a no-op ("DummyRule" in its own configuration schema) — enabling
// it with a `paths` config does not flag a real `@anthropic-ai/sdk` import
// (confirmed by hand: adding the import to a throwaway file under
// server/engine/score/ and running oxlint against the override config
// produced zero diagnostics for it). So the actual enforcement lives here,
// as a plain source-text check, instead of in .oxlintrc.json.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const GUARDED_DIRS = ['server/engine/score', 'server/engine/features']
const BANNED_IMPORT = '@anthropic-ai/sdk'
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

function listTsFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...listTsFiles(full))
    } else if (full.endsWith('.ts') && !full.endsWith('.test.ts')) {
      files.push(full)
    }
  }
  return files
}

describe('Score Engine / Code Feature Extractor never import the LLM SDK (§10.2)', () => {
  for (const dir of GUARDED_DIRS) {
    const absoluteDir = join(REPO_ROOT, dir)
    for (const file of listTsFiles(absoluteDir)) {
      test(`${file.replace(REPO_ROOT, '')} has no "${BANNED_IMPORT}" import`, () => {
        const content = readFileSync(file, 'utf8')
        expect(content).not.toContain(BANNED_IMPORT)
      })
    }
  }
})
