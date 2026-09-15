// V2 Production Closing — production hard guard, mirroring
// analysisResultRepository.test.ts / quotaRepository.test.ts. Usage logging
// is best-effort at every call site (they .catch() this rather than fail the
// user's request), but the repository itself must still refuse to write to
// Render's ephemeral filesystem in production when DATABASE_URL is unset.
import { afterEach, describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getUsageLogRepository } from "./usageLogRepository.js";
import { DatabaseUnavailableError } from "../fallbackPolicy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FALLBACK_LOG_PATH = join(__dirname, "../../data/usage-log.jsonl");

const ORIGINAL_ENV = { ...process.env };

function setEnv(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function sampleEntry() {
  return {
    deviceId: null,
    callSite: "relationship_preview" as const,
    model: "test-model",
    inputTokens: 0,
    outputTokens: 0,
    costEstimate: 0,
    durationMs: 0,
    success: true,
    errorMessage: null,
  };
}

describe("usageLogRepository (production hard guard — V2 Production Closing)", () => {
  test("production + DATABASE_URL unset never falls back to the file log", async () => {
    setEnv({ NODE_ENV: "production", DATABASE_URL: undefined });
    const repo = getUsageLogRepository();
    await expect(repo.record(sampleEntry())).rejects.toThrow(DatabaseUnavailableError);
  });

  test("non-production + DATABASE_URL unset still writes to the file log (unchanged)", async () => {
    setEnv({ NODE_ENV: "development", DATABASE_URL: undefined });
    const repo = getUsageLogRepository();
    const before = await readFile(FALLBACK_LOG_PATH, "utf8").catch(() => "");
    await repo.record(sampleEntry());
    const after = await readFile(FALLBACK_LOG_PATH, "utf8");
    expect(after.length).toBeGreaterThan(before.length);
  });
});
