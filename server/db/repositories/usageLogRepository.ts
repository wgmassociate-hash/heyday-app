// Phase 0 — instruments the two existing 1.0 LLM call sites (analyze, OCR) so
// per-call token usage/cost is actually recorded (analysis_v1.md §4.8 flagged
// this as entirely missing in 1.0). No conversation text is ever logged here —
// only counts and metadata (docs/implementation_plan_v2.md §5.5/§17).
//
// Phase 0.5: same fallback policy as quotaRepository.ts (server/db/fallbackPolicy.ts)
// — file fallback only when DATABASE_URL is unset, or in development with
// ALLOW_FILE_DB_FALLBACK=true. In production a Postgres failure here throws
// DatabaseUnavailableError; the call sites in server/analyze.js and
// server/ocrScreenshots.js already treat logging as best-effort (they
// .catch() and console.warn rather than fail the user's actual request), so
// this surfaces loudly in logs without breaking analysis/OCR responses.
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPrismaClient } from "../prismaClient.js";
import { withFallbackPolicy } from "../fallbackPolicy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FALLBACK_LOG_PATH = join(__dirname, "../../data/usage-log.jsonl");

export interface UsageLogEntry {
  deviceId: string | null;
  callSite: "analyze" | "ocr_screenshots";
  model: string;
  inputTokens: number;
  outputTokens: number;
  costEstimate: number;
  durationMs: number;
  success: boolean;
  errorMessage: string | null;
}

export interface UsageLogRepository {
  record(entry: UsageLogEntry): Promise<void>;
}

const fileUsageLogRepository: UsageLogRepository = {
  async record(entry) {
    await mkdir(dirname(FALLBACK_LOG_PATH), { recursive: true });
    const line = JSON.stringify({ ...entry, createdAt: new Date().toISOString() });
    await appendFile(FALLBACK_LOG_PATH, line + "\n", "utf8");
  },
};

const prismaUsageLogRepository: UsageLogRepository = {
  async record(entry) {
    const prisma = getPrismaClient();
    if (!prisma) throw new Error("DATABASE_URL not configured");
    await prisma.analysisUsageLog.create({ data: entry });
  },
};

export function getUsageLogRepository(): UsageLogRepository {
  if (!process.env.DATABASE_URL) return fileUsageLogRepository;

  return {
    record: (entry) =>
      withFallbackPolicy(
        "usage-log",
        () => prismaUsageLogRepository.record(entry),
        () => fileUsageLogRepository.record(entry),
      ),
  };
}
