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
  // Phase 2: "relationship_preview" added for the new engine's Free Preview
  // LLM call (server/previewAnalyze.ts) — kept in this same simple per-call
  // log rather than migrating to docs/implementation_plan_v2.md §17.1's
  // analysisId-keyed AnalysisUsageLog schema yet. That schema conflates
  // Preview+Paid+conversion tracking into one row per analysis, which only
  // makes sense once Paid Deep (Phase 3) actually exists to fill its
  // paidInputTokens/paidCost/reportType/converted fields — doing that
  // migration now would leave those columns permanently null. Revisit at
  // Phase 3.
  callSite: "analyze" | "ocr_screenshots" | "relationship_preview";
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
