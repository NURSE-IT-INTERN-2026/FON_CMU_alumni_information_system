/**
 * In-process monthly CMU-sync scheduler (SERVER-ONLY — imports Prisma + the
 * materialization job). Armed once at boot from `instrumentation.ts`
 * (production + nodejs runtime only), so dev/HMR and edge never start timers.
 *
 * Fires the CMU registrar materialization on the 1st of each month
 * (Asia/Bangkok), running the SAME `materializeCmuGraduates` the admin UI + the
 * `POST /api/cmu-alumni/sync` route use (one code path for manual + scheduled).
 *
 * Design (see the CLAUDE.md "In-process monthly scheduler" lesson):
 *  - **Never arm a single month-long `setTimeout`** — Node caps delay at ~2^31 ms
 *    (~24.8 days); a ~30-day delay fires immediately. `armDelayMs` caps the wait
 *    at 24h, so the chain of timers converges to fire EXACTLY at 00:00 on the
 *    1st Bangkok when the server is up continuously (the cap only governs the
 *    long mid-month re-arms). `unref()` so the timer never blocks shutdown.
 *  - **Idempotency is the guarantee; the timer is just the trigger.** Every tick
 *    (and boot) skips if an `IMPORT`/`cmu_alumni` log already landed this
 *    Bangkok month (`alreadyRanThisMonth`) — so the job runs EXACTLY once per
 *    month regardless of double-fire, restart-re-arm, or an admin having synced.
 *  - **Boot catch-up:** if the server was down on the 1st and boots mid-month
 *    without having synced this month, the first tick runs the missed sync.
 *    Opt out with `CMU_SYNC_CRON_DISABLED=1` (preview/CI).
 *  - Bangkok is fixed UTC+7 with NO DST, so `Date.UTC(y, m, 1) - 7h` is exact.
 */
import prisma from "@/lib/prisma";
import { materializeCmuGraduates } from "@/lib/cmu-sync-job";

/** Bangkok = UTC+7, fixed (no DST). */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
/**
 * Max single `setTimeout` delay — safely under Node's ~2^31 ms (~24.8d) ceiling.
 * A month exceeds that ceiling, so we re-arm in ≤24h increments and converge on
 * the target instant (see module doc).
 */
export const CAP_MS = 24 * 60 * 60 * 1000;

const bangkokFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export interface BangkokParts {
  y: number; // full year (Buddhist-era NOT applied — Gregorian)
  m0: number; // 0-11
  d: number; // 1-31
  h: number; // 0-23
  min: number; // 0-59
  s: number; // 0-59
}

/** Bangkok wall-clock calendar/time parts for an instant (pure; injectable `now`). */
export function bangkokParts(now: Date): BangkokParts {
  const map: Record<string, string> = {};
  for (const p of bangkokFormatter.formatToParts(now)) map[p.type] = p.value;
  // Some ICU builds emit "24" at midnight with hour12:false — normalize to 0.
  let h = parseInt(map.hour, 10);
  if (h === 24) h = 0;
  return {
    y: parseInt(map.year, 10),
    m0: parseInt(map.month, 10) - 1,
    d: parseInt(map.day, 10),
    h,
    min: parseInt(map.minute, 10),
    s: parseInt(map.second, 10),
  };
}

/**
 * The UTC instant of 00:00 on the 1st of `now`'s Bangkok month. Bangkok is
 * UTC+7 (fixed), so 00:00 Bangkok = 17:00 UTC the previous day.
 */
export function monthStartInstantBangkok(now: Date): Date {
  const { y, m0 } = bangkokParts(now);
  return new Date(Date.UTC(y, m0, 1) - BANGKOK_OFFSET_MS);
}

/**
 * Milliseconds from `now` to the next 00:00-on-the-1st Bangkok: this month's if
 * `now` is still before it, else next month's. Pure; injectable `now`.
 */
export function msUntilNextFirstOfMonthBangkok(now: Date): number {
  const { y, m0 } = bangkokParts(now);
  const thisMonthsFirstMs = Date.UTC(y, m0, 1) - BANGKOK_OFFSET_MS;
  const nowMs = now.getTime();
  if (nowMs < thisMonthsFirstMs) return thisMonthsFirstMs - nowMs;
  const nextM0 = m0 === 11 ? 0 : m0 + 1;
  const nextY = m0 === 11 ? y + 1 : y;
  return Date.UTC(nextY, nextM0, 1) - BANGKOK_OFFSET_MS - nowMs;
}

/**
 * The delay actually handed to `setTimeout` — the time to the next 1st, capped
 * at `CAP_MS` to stay under Node's `setTimeout` ceiling. Always `<= CAP_MS`.
 */
export function armDelayMs(now: Date): number {
  return Math.min(msUntilNextFirstOfMonthBangkok(now), CAP_MS);
}

/**
 * Pure idempotency decision: did a sync log land at/after the month's start?
 * (Decoupled from the Prisma query so the logic is unit-testable.)
 */
export function hasSyncedSince(latestLogAt: Date | null, sinceInstant: Date): boolean {
  return latestLogAt != null && latestLogAt.getTime() >= sinceInstant.getTime();
}

/**
 * Has any CMU sync run this Bangkok month? True iff the most recent
 * `IMPORT`/`cmu_alumni` activity log is at/after this month's 1st 00:00 Bangkok.
 * Any sync counts (admin session OR automated) — the data is fresh either way.
 */
async function alreadyRanThisMonth(now: Date = new Date()): Promise<boolean> {
  const monthStart = monthStartInstantBangkok(now);
  const latest = await prisma.activityLog.findFirst({
    where: { action: "IMPORT", resource: "cmu_alumni" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return hasSyncedSince(latest?.createdAt ?? null, monthStart);
}

let started = false;
let running = false;

/**
 * One scheduler tick: sync if we haven't yet this Bangkok month, then re-arm.
 * Never throws to the caller — a registrar/DB outage is logged and the next
 * month's tick (or an admin's manual sync) covers it.
 */
async function runTick(reason: "boot" | "scheduled"): Promise<void> {
  if (running) return;
  running = true;
  try {
    if (await alreadyRanThisMonth(new Date())) {
      console.log("[cmu-scheduler] tick (%s): already synced this month — skip", reason);
    } else {
      console.log("[cmu-scheduler] tick (%s): running scheduled CMU sync", reason);
      const r = await materializeCmuGraduates({ actorType: "SYSTEM" });
      console.log(
        "[cmu-scheduler] sync complete: upserted=%d created=%d updated=%d remoteCount=%d",
        r.upserted,
        r.created,
        r.updated,
        r.remoteCount,
      );
    }
  } catch (error) {
    console.error("[cmu-scheduler] tick (%s) failed:", reason, error);
  } finally {
    running = false;
    armNext();
  }
}

/** Re-arm the timer toward the next 1st (capped at 24h; `unref`'d). */
function armNext(): void {
  const handle = setTimeout(() => {
    void runTick("scheduled");
  }, armDelayMs(new Date())) as unknown as { unref?: () => void };
  // Server (Node) timers expose `unref`; call it when present so the timer never
  // keeps the process alive on its own (the HTTP server keeps the long-lived
  // standalone server up, so this still fires on schedule).
  handle.unref?.();
}

/**
 * Start the scheduler. Idempotent. Honors `CMU_SYNC_CRON_DISABLED=1`. The boot
 * tick both catches up a missed month and arms the next fire (runTick re-arms).
 * Fire-and-forget — does not block boot.
 */
export function startCmuScheduler(): void {
  if (started) return;
  started = true;
  if (process.env.CMU_SYNC_CRON_DISABLED === "1") {
    console.log("[cmu-scheduler] disabled by CMU_SYNC_CRON_DISABLED=1");
    return;
  }
  console.log("[cmu-scheduler] starting — monthly CMU sync on the 1st (Asia/Bangkok)");
  void runTick("boot");
}
