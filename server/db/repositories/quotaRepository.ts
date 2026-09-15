// Phase 0 — quota storage moved off the volatile file (server/quotaStore.js,
// wiped on every Render restart/redeploy per analysis_v1.md §4.2) and onto
// Postgres.
//
// Phase 0.5 fallback policy (server/db/fallbackPolicy.ts): the file store is
// used unconditionally when DATABASE_URL isn't set at all (1.0 compatibility
// — "no DB configured" is not a failure). Once DATABASE_URL IS set, a failed
// Postgres call throws DatabaseUnavailableError instead of silently falling
// back — except in development with ALLOW_FILE_DB_FALLBACK=true. Production
// never falls back, so a Postgres outage can't silently reset quota state.
//
// server/quota.js (the policy logic — KST reset, share-bonus cooldown, etc.)
// is untouched except that it now awaits this repository instead of calling
// readStore()/writeStore() synchronously.
import { getPrismaClient } from "../prismaClient.js";
import { isFileStoreAllowedWhenUnconfigured, unconfiguredDatabaseError, withFallbackPolicy } from "../fallbackPolicy.js";
// Plain JS, no ambient types (allowJs handles this) — kept exactly as in 1.0.
import { readStore, writeStore } from "../../quotaStore.js";

export interface QuotaRecord {
  used: number;
  shareBonus: number;
  lastShareAt: number;
}

export interface QuotaRepository {
  getRecord(deviceId: string, kstDate: string): Promise<QuotaRecord>;
  saveRecord(deviceId: string, kstDate: string, record: QuotaRecord): Promise<void>;
}

function emptyRecord(): QuotaRecord {
  return { used: 0, shareBonus: 0, lastShareAt: 0 };
}

/** Identical semantics to 1.0's server/quota.js getDeviceRecord/saveDeviceRecord. */
const fileQuotaRepository: QuotaRepository = {
  async getRecord(deviceId, kstDate) {
    const store = readStore();
    const existing = store.devices[deviceId];
    if (!existing || existing.date !== kstDate) return emptyRecord();
    return {
      used: Number(existing.used) || 0,
      shareBonus: Number(existing.shareBonus) || 0,
      lastShareAt: Number(existing.lastShareAt) || 0,
    };
  },
  async saveRecord(deviceId, kstDate, record) {
    const store = readStore();
    store.devices[deviceId] = { date: kstDate, ...record };
    writeStore(store);
  },
};

const prismaQuotaRepository: QuotaRepository = {
  async getRecord(deviceId, kstDate) {
    const prisma = getPrismaClient();
    if (!prisma) throw new Error("DATABASE_URL not configured");
    const row = await prisma.deviceQuota.findUnique({ where: { deviceId } });
    if (!row || row.date !== kstDate) return emptyRecord();
    return { used: row.used, shareBonus: row.shareBonus, lastShareAt: Number(row.lastShareAt) };
  },
  async saveRecord(deviceId, kstDate, record) {
    const prisma = getPrismaClient();
    if (!prisma) throw new Error("DATABASE_URL not configured");
    await prisma.deviceQuota.upsert({
      where: { deviceId },
      create: {
        deviceId,
        date: kstDate,
        used: record.used,
        shareBonus: record.shareBonus,
        lastShareAt: BigInt(record.lastShareAt),
      },
      update: {
        date: kstDate,
        used: record.used,
        shareBonus: record.shareBonus,
        lastShareAt: BigInt(record.lastShareAt),
      },
    });
  },
};

/** Every method rejects with DatabaseUnavailableError — used in production
 * when DATABASE_URL isn't set at all, so callers get the exact same 503 they'd
 * get from a real Postgres outage instead of a silent file-store switch. */
const unconfiguredQuotaRepository: QuotaRepository = {
  getRecord: () => Promise.reject(unconfiguredDatabaseError("quota")),
  saveRecord: () => Promise.reject(unconfiguredDatabaseError("quota")),
};

/**
 * Prisma-first quota repository. This is the only export server/quota.js
 * should use. See the fallback policy note at the top of this file for what
 * happens when DATABASE_URL is set but Postgres is unreachable.
 */
export function getQuotaRepository(): QuotaRepository {
  if (!process.env.DATABASE_URL) {
    return isFileStoreAllowedWhenUnconfigured() ? fileQuotaRepository : unconfiguredQuotaRepository;
  }

  return {
    getRecord: (deviceId, kstDate) =>
      withFallbackPolicy(
        "quota",
        () => prismaQuotaRepository.getRecord(deviceId, kstDate),
        () => fileQuotaRepository.getRecord(deviceId, kstDate),
      ),
    saveRecord: (deviceId, kstDate, record) =>
      withFallbackPolicy(
        "quota",
        () => prismaQuotaRepository.saveRecord(deviceId, kstDate, record),
        () => fileQuotaRepository.saveRecord(deviceId, kstDate, record),
      ),
  };
}
