// V2 Production Closing — production hard guard. The rest of quota policy
// (KST reset, share-bonus cooldown, DEV_BYPASS_QUOTA/RATE_LIMIT_DISABLED
// short-circuits) is already covered by server/quota.test.js against the
// file-backed repository; this file only exercises the repository factory's
// own DATABASE_URL branching, mirroring analysisResultRepository.test.ts.
import { afterEach, describe, expect, test } from "vitest";
import { getQuotaRepository } from "./quotaRepository.js";
import { DatabaseUnavailableError } from "../fallbackPolicy.js";

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

describe("quotaRepository (production hard guard — V2 Production Closing)", () => {
  test("production + DATABASE_URL unset never falls back to the file store", async () => {
    setEnv({ NODE_ENV: "production", DATABASE_URL: undefined });
    const repo = getQuotaRepository();

    await expect(repo.getRecord("device-x", "2026-09-16")).rejects.toThrow(DatabaseUnavailableError);
    await expect(
      repo.saveRecord("device-x", "2026-09-16", { used: 0, shareBonus: 0, lastShareAt: 0 }),
    ).rejects.toThrow(DatabaseUnavailableError);
  });

  test("non-production + DATABASE_URL unset still uses the file store (unchanged)", async () => {
    setEnv({ NODE_ENV: "development", DATABASE_URL: undefined });
    const repo = getQuotaRepository();
    const record = await repo.getRecord("device-y-unused-elsewhere", "2026-09-16");
    expect(record).toEqual({ used: 0, shareBonus: 0, lastShareAt: 0 });
  });
});
