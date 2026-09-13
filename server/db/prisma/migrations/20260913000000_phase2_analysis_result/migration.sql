-- CreateEnum
CREATE TYPE "Stage2Status" AS ENUM ('NOT_STARTED', 'CLAIMED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AnalysisMode" AS ENUM ('SNAPSHOT', 'STANDARD', 'DEEP');

-- CreateTable
CREATE TABLE "analysis_results" (
    "id" TEXT NOT NULL,
    "device_id" TEXT,
    "intent" TEXT NOT NULL,
    "analysis_mode" "AnalysisMode" NOT NULL,
    "window_label" TEXT NOT NULL,
    "processed_chunk_ids" JSONB NOT NULL,
    "preview_fields" JSONB NOT NULL,
    "stage2_status" "Stage2Status" NOT NULL DEFAULT 'NOT_STARTED',
    "preview_expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analysis_results_preview_expires_at_idx" ON "analysis_results"("preview_expires_at");

