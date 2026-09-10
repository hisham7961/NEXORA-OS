import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { logger } from "@/lib/log";
import { writeSystemEvent } from "@/lib/audit/log";

/**
 * Storage integrity (§45-46). Files store a sha256 at upload but nothing verified it
 * afterwards, so silent bit-rot or a missing blob went undetected. This scans file
 * versions and checks each blob still exists and still hashes to its stored checksum,
 * recording a SystemEvent when problems are found. It is read-only and bounded so it
 * can run as a scheduled job without hammering the object store.
 */
export type VersionStatus = "ok" | "missing" | "mismatch" | "no_checksum";

export async function verifyVersion(version: { id: string; storageKey: string; checksum: string | null }): Promise<VersionStatus> {
  const storage = getStorage();
  if (!(await storage.exists(version.storageKey))) return "missing";
  if (!version.checksum) return "no_checksum";
  const obj = await storage.get(version.storageKey);
  const actual = createHash("sha256").update(obj.body).digest("hex");
  return actual === version.checksum ? "ok" : "mismatch";
}

export interface IntegrityReport {
  scanned: number;
  ok: number;
  missing: string[];   // fileVersion ids whose blob is gone
  mismatch: string[];  // fileVersion ids whose bytes changed
  noChecksum: number;  // versions with no stored checksum to verify against
}

/**
 * Scan the most recent `limit` file versions. Bounded by design — a nightly job
 * covers fresh uploads; a full sweep can pass a larger limit manually.
 */
export async function runStorageIntegrityScan(opts: { limit?: number } = {}): Promise<IntegrityReport> {
  const limit = Math.min(opts.limit ?? 500, 5000);
  const versions = await prisma.fileVersion.findMany({
    orderBy: { createdAt: "desc" }, take: limit,
    select: { id: true, storageKey: true, checksum: true },
  });
  const report: IntegrityReport = { scanned: versions.length, ok: 0, missing: [], mismatch: [], noChecksum: 0 };
  for (const v of versions) {
    let status: VersionStatus;
    try { status = await verifyVersion(v); }
    catch (e) { logger.warn("integrity check errored", { fileVersionId: v.id, err: e }); report.missing.push(v.id); continue; }
    if (status === "ok") report.ok++;
    else if (status === "missing") report.missing.push(v.id);
    else if (status === "mismatch") report.mismatch.push(v.id);
    else report.noChecksum++;
  }

  const problems = report.missing.length + report.mismatch.length;
  if (problems > 0) {
    logger.error("storage integrity problems found", { missing: report.missing.length, mismatch: report.mismatch.length, scanned: report.scanned });
    await writeSystemEvent({ type: "health", level: "error", message: `Storage integrity: ${report.missing.length} missing, ${report.mismatch.length} corrupted of ${report.scanned} scanned`, meta: { missing: report.missing.slice(0, 50), mismatch: report.mismatch.slice(0, 50) } }).catch(() => {});
  } else {
    logger.info("storage integrity scan clean", { scanned: report.scanned, noChecksum: report.noChecksum });
  }
  return report;
}
