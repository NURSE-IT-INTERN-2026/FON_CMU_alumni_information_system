/**
 * One-time data cleanup: strip the per-record list (`records`) and its cap
 * bookkeeping (`truncated`, `totalRecords`) from every IMPORT activity log's
 * `details` JSON. Import logs no longer store the created/updated record list
 * (counts + failed rows only — see `lib/import-log.ts`); this removes the list
 * from logs that pre-date that change so the column stops carrying the old data.
 *
 * It does NOT touch `errors` / `errorsTruncated` / `totalErrors` (failed-row
 * detail is kept) or legacy number-only alumni logs (`{ imported, attempted,
 * errors: <number> }`, which never carried a `records` list). Safe to re-run
 * (idempotent: nothing to do once every log is clean).
 *
 *   DRY_RUN=1 node --env-file=.env --import tsx scripts/clean-import-log-records.ts
 *       node --env-file=.env --import tsx scripts/clean-import-log-records.ts
 */
import "dotenv/config";
import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

const DRY_RUN = process.env.DRY_RUN === "1";

/** Keys removed by this cleanup (the created/updated record list + its caps). */
const STRIP_KEYS = ["records", "truncated", "totalRecords"];

async function main() {
  const logs = await prisma.activityLog.findMany({
    where: { action: "IMPORT" },
    select: { id: true, details: true },
  });

  let scanned = 0;
  let changed = 0;
  let strippedRecordLists = 0;

  for (const log of logs) {
    scanned++;
    const details = log.details;
    if (!details || typeof details !== "object" || Array.isArray(details)) continue;

    const present = STRIP_KEYS.filter((k) => k in (details as Record<string, unknown>));
    if (present.length === 0) continue;

    changed++;
    if (present.includes("records")) strippedRecordLists++;

    const cleaned = { ...(details as Record<string, unknown>) };
    for (const k of STRIP_KEYS) delete cleaned[k];

    if (DRY_RUN) {
      console.log(
        `[DRY_RUN] would strip ${present.join(", ")} from log ${log.id}` +
          (Array.isArray(cleaned.records) ? ` (${(cleaned.records as unknown[]).length} records)` : ""),
      );
    } else {
      await prisma.activityLog.update({ where: { id: log.id }, data: { details: cleaned as Prisma.InputJsonValue } });
    }
  }

  console.log(
    `\nDone. Scanned ${scanned} IMPORT log(s); ${changed} carry a record list (${strippedRecordLists}).` +
      `\n${DRY_RUN ? "[DRY_RUN] no rows were written." : `${changed} row(s) updated.`}`,
  );
}

main()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
