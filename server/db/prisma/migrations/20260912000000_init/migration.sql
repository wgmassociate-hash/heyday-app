-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "device_quotas" (
    "device_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "share_bonus" INTEGER NOT NULL DEFAULT 0,
    "last_share_at" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_quotas_pkey" PRIMARY KEY ("device_id")
);

-- CreateTable
CREATE TABLE "analysis_usage_logs" (
    "id" TEXT NOT NULL,
    "device_id" TEXT,
    "call_site" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_estimate" DOUBLE PRECISION NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analysis_usage_logs_created_at_idx" ON "analysis_usage_logs"("created_at");

