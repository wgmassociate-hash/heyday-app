// Phase 2 — Free Preview result storage (docs/implementation_plan_v2.md §5.3,
// §6.5, §16.2). Same fallback-policy shape as quotaRepository.ts/
// usageLogRepository.ts (server/db/fallbackPolicy.ts): file store only when
// DATABASE_URL is unset ("no DB configured" is not a failure); once it's set,
// a Postgres failure throws DatabaseUnavailableError unless
// ALLOW_FILE_DB_FALLBACK=true in a non-production environment.
//
// §6.5's TTL ("최대 24시간") is enforced on the read path here — findById()
// treats an expired row as not-found even before it's physically deleted —
// so Phase 2 completion criterion #4 ("Preview 결과가 24시간 뒤 조회
// 불가능함") holds regardless of whether/when a cleanup job actually runs
// purgeExpired(). No raw conversation text is ever stored (docs/prd_v2.md §25.1)
// — only the already-scored PreviewScoreResult/Narrative/topSignal JSON.
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPrismaClient } from "../prismaClient.js";
import { withFallbackPolicy } from "../fallbackPolicy.js";
import type { AnalysisMode, Stage2Status } from "../prisma/client/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FALLBACK_DIR = join(__dirname, "../../data/analysis-results");

export const PREVIEW_TTL_HOURS = 24;

export interface CreatePreviewInput {
  deviceId: string | null;
  intent: string;
  analysisMode: AnalysisMode;
  windowLabel: string;
  processedChunkIds: string[];
  /** Serialized PreviewScoreResult + PreviewNarrative + topSignal. */
  previewFields: unknown;
}

export interface StoredAnalysisResult {
  id: string;
  deviceId: string | null;
  intent: string;
  analysisMode: AnalysisMode;
  windowLabel: string;
  processedChunkIds: string[];
  previewFields: unknown;
  stage2Status: Stage2Status;
  previewExpiresAt: string;
  createdAt: string;
}

export interface AnalysisResultRepository {
  createPreview(input: CreatePreviewInput): Promise<string>;
  findById(id: string): Promise<StoredAnalysisResult | null>;
  /** Physically deletes rows past their previewExpiresAt. Not itself relied
   * on for the 24h-unreadable guarantee (see file header) — this is cleanup,
   * not the enforcement mechanism. Returns the number of rows removed. */
  purgeExpired(now: Date): Promise<number>;
}

function newId(): string {
  return `prev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function isExpired(record: StoredAnalysisResult, now: Date): boolean {
  return new Date(record.previewExpiresAt).getTime() <= now.getTime();
}

// ---------------------------------------------------------------------------
// File fallback
// ---------------------------------------------------------------------------

const fileAnalysisResultRepository: AnalysisResultRepository = {
  async createPreview(input) {
    await mkdir(FALLBACK_DIR, { recursive: true });
    const id = newId();
    const now = new Date();
    const record: StoredAnalysisResult = {
      id,
      deviceId: input.deviceId,
      intent: input.intent,
      analysisMode: input.analysisMode,
      windowLabel: input.windowLabel,
      processedChunkIds: input.processedChunkIds,
      previewFields: input.previewFields,
      stage2Status: "NOT_STARTED",
      previewExpiresAt: new Date(now.getTime() + PREVIEW_TTL_HOURS * 60 * 60 * 1000).toISOString(),
      createdAt: now.toISOString(),
    };
    await writeFile(join(FALLBACK_DIR, `${id}.json`), JSON.stringify(record), "utf8");
    return id;
  },

  async findById(id) {
    try {
      const raw = await readFile(join(FALLBACK_DIR, `${id}.json`), "utf8");
      const record = JSON.parse(raw) as StoredAnalysisResult;
      if (isExpired(record, new Date())) return null;
      return record;
    } catch {
      return null;
    }
  },

  async purgeExpired(now) {
    let removed = 0;
    let entries: string[] = [];
    try {
      entries = await readdir(FALLBACK_DIR);
    } catch {
      return 0;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const path = join(FALLBACK_DIR, entry);
      try {
        const raw = await readFile(path, "utf8");
        const record = JSON.parse(raw) as StoredAnalysisResult;
        if (isExpired(record, now)) {
          await rm(path);
          removed += 1;
        }
      } catch {
        // Corrupt/partial file — leave it, don't let cleanup crash on it.
      }
    }
    return removed;
  },
};

// ---------------------------------------------------------------------------
// Prisma
// ---------------------------------------------------------------------------

function toStoredResult(row: {
  id: string;
  deviceId: string | null;
  intent: string;
  analysisMode: AnalysisMode;
  windowLabel: string;
  processedChunkIds: unknown;
  previewFields: unknown;
  stage2Status: Stage2Status;
  previewExpiresAt: Date;
  createdAt: Date;
}): StoredAnalysisResult {
  return {
    id: row.id,
    deviceId: row.deviceId,
    intent: row.intent,
    analysisMode: row.analysisMode,
    windowLabel: row.windowLabel,
    processedChunkIds: row.processedChunkIds as string[],
    previewFields: row.previewFields,
    stage2Status: row.stage2Status,
    previewExpiresAt: row.previewExpiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

const prismaAnalysisResultRepository: AnalysisResultRepository = {
  async createPreview(input) {
    const prisma = getPrismaClient();
    if (!prisma) throw new Error("DATABASE_URL not configured");
    const previewExpiresAt = new Date(Date.now() + PREVIEW_TTL_HOURS * 60 * 60 * 1000);
    const row = await prisma.analysisResult.create({
      data: {
        deviceId: input.deviceId,
        intent: input.intent,
        analysisMode: input.analysisMode,
        windowLabel: input.windowLabel,
        processedChunkIds: input.processedChunkIds,
        previewFields: input.previewFields as never,
        previewExpiresAt,
      },
    });
    return row.id;
  },

  async findById(id) {
    const prisma = getPrismaClient();
    if (!prisma) throw new Error("DATABASE_URL not configured");
    const row = await prisma.analysisResult.findUnique({ where: { id } });
    if (!row) return null;
    const record = toStoredResult(row);
    if (isExpired(record, new Date())) return null;
    return record;
  },

  async purgeExpired(now) {
    const prisma = getPrismaClient();
    if (!prisma) throw new Error("DATABASE_URL not configured");
    const result = await prisma.analysisResult.deleteMany({ where: { previewExpiresAt: { lte: now } } });
    return result.count;
  },
};

export function getAnalysisResultRepository(): AnalysisResultRepository {
  if (!process.env.DATABASE_URL) return fileAnalysisResultRepository;

  return {
    createPreview: (input) =>
      withFallbackPolicy(
        "analysis-result",
        () => prismaAnalysisResultRepository.createPreview(input),
        () => fileAnalysisResultRepository.createPreview(input),
      ),
    findById: (id) =>
      withFallbackPolicy(
        "analysis-result",
        () => prismaAnalysisResultRepository.findById(id),
        () => fileAnalysisResultRepository.findById(id),
      ),
    purgeExpired: (now) =>
      withFallbackPolicy(
        "analysis-result",
        () => prismaAnalysisResultRepository.purgeExpired(now),
        () => fileAnalysisResultRepository.purgeExpired(now),
      ),
  };
}
