// Phase 2 — exercises the file-fallback path (DATABASE_URL is unset in the
// test environment, same as quotaRepository/usageLogRepository's untested-by-
// Postgres branch — see fallbackPolicy.test.ts for the Postgres-vs-file
// policy itself, tested independently of any concrete repository).
import { readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { getAnalysisResultRepository, PREVIEW_TTL_HOURS } from "./analysisResultRepository.js";
import { DatabaseUnavailableError } from "../fallbackPolicy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FALLBACK_DIR = join(__dirname, "../../data/analysis-results");

const ORIGINAL_ENV = { ...process.env };

function setEnv(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const createdIds: string[] = [];

afterEach(async () => {
  for (const id of createdIds.splice(0)) {
    await rm(join(FALLBACK_DIR, `${id}.json`), { force: true });
  }
});

function samplePreview() {
  return {
    deviceId: "device-1",
    intent: "romantic_interest",
    analysisMode: "SNAPSHOT" as const,
    windowLabel: "최근 대화 전체",
    processedChunkIds: ["chunk_0"],
    previewFields: { recentConversationTemperature: { score: 70, confidence: "medium" } },
  };
}

describe("analysisResultRepository (file fallback)", () => {
  test("createPreview then findById round-trips the stored fields", async () => {
    const repo = getAnalysisResultRepository();
    const id = await repo.createPreview(samplePreview());
    createdIds.push(id);

    const found = await repo.findById(id);
    expect(found).not.toBeNull();
    expect(found?.intent).toBe("romantic_interest");
    expect(found?.windowLabel).toBe("최근 대화 전체");
    expect(found?.stage2Status).toBe("NOT_STARTED");
    expect(found?.previewFields).toEqual(samplePreview().previewFields);
  });

  test("findById returns null for an unknown id", async () => {
    const repo = getAnalysisResultRepository();
    expect(await repo.findById("does-not-exist")).toBeNull();
  });

  test("previewExpiresAt is set PREVIEW_TTL_HOURS out from creation", async () => {
    const repo = getAnalysisResultRepository();
    const before = Date.now();
    const id = await repo.createPreview(samplePreview());
    createdIds.push(id);
    const found = await repo.findById(id);
    const expiresAt = new Date(found!.previewExpiresAt).getTime();
    const expectedMin = before + PREVIEW_TTL_HOURS * 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThanOrEqual(expectedMin - 1000);
  });

  test("findById returns null once the record has expired (completion criterion #4)", async () => {
    const repo = getAnalysisResultRepository();
    const id = await repo.createPreview(samplePreview());
    createdIds.push(id);

    // Backdate the stored record's expiry directly, rather than waiting 24h.
    const path = join(FALLBACK_DIR, `${id}.json`);
    const record = JSON.parse(await readFile(path, "utf8"));
    record.previewExpiresAt = new Date(Date.now() - 1000).toISOString();
    await rm(path);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path, JSON.stringify(record), "utf8");

    expect(await repo.findById(id)).toBeNull();
  });

  test("purgeExpired removes only rows past their expiry", async () => {
    const repo = getAnalysisResultRepository();
    const freshId = await repo.createPreview(samplePreview());
    createdIds.push(freshId);

    const expiredId = await repo.createPreview(samplePreview());
    const expiredPath = join(FALLBACK_DIR, `${expiredId}.json`);
    const record = JSON.parse(await readFile(expiredPath, "utf8"));
    record.previewExpiresAt = new Date(Date.now() - 1000).toISOString();
    await rm(expiredPath);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(expiredPath, JSON.stringify(record), "utf8");

    const removed = await repo.purgeExpired(new Date());
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await repo.findById(expiredId)).toBeNull();
    expect(await repo.findById(freshId)).not.toBeNull();
  });
});

describe("analysisResultRepository (production hard guard — V2 Production Closing)", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  test("production + DATABASE_URL unset never falls back to the file store", async () => {
    setEnv({ NODE_ENV: "production", DATABASE_URL: undefined });
    const repo = getAnalysisResultRepository();

    await expect(repo.createPreview(samplePreview())).rejects.toThrow(DatabaseUnavailableError);
    await expect(repo.findById("anything")).rejects.toThrow(DatabaseUnavailableError);
    await expect(repo.purgeExpired(new Date())).rejects.toThrow(DatabaseUnavailableError);
  });

  test("non-production + DATABASE_URL unset still uses the file store (unchanged)", async () => {
    setEnv({ NODE_ENV: "development", DATABASE_URL: undefined });
    const repo = getAnalysisResultRepository();
    const id = await repo.createPreview(samplePreview());
    createdIds.push(id);
    expect(await repo.findById(id)).not.toBeNull();
  });
});
