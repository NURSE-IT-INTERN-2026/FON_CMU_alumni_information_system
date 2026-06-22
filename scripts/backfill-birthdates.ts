/**
 * One-time backfill: re-derive each Alumni.birthDate from the authoritative
 * CMU Registrar source using the CORRECTED day-first parser
 * (normalizeCmuBirthday, lib/alumni-verify.ts → DD-MM-YYYY → YYYY-MM-DD).
 *
 * Why CMU and not a blind day/month swap: the column holds MIXED formats —
 * ISO "YYYY-MM-DD" from imports (the swapped ones), Buddhist DDMMYYYY from
 * portal signups (signup/route.ts writes the raw form value), and free-form
 * from admin edits (alumni-accounts allows it). A blind swap would corrupt the
 * non-ISO values. CMU re-derivation is format-agnostic and authoritative.
 *
 * Effect, per alumni:
 *  - in CMU with a parseable birthday → birthDate set to the true ISO value
 *    (fixes swapped imports; overwrites signup/admin values with the source of
 *    truth; values already equal to CMU truth are left untouched);
 *  - in CMU but CMU birthday missing/unparseable → left as-is;
 *  - NOT in CMU → left as-is and reported for manual review (their stored value
 *    is format-ambiguous — could be Buddhist DDMMYYYY from signup — so we don't
 *    guess).
 *
 * Run with:
 *   DRY_RUN=1 node --env-file=.env --import tsx scripts/backfill-birthdates.ts   # preview
 *   node --env-file=.env --import tsx scripts/backfill-birthdates.ts             # apply
 *
 * Idempotent: re-running is a safe no-op once every value matches CMU truth.
 * Kept (like rebuild-awards.ts) so it can be re-run against another environment.
 */
import "dotenv/config";
import prisma from "@/lib/prisma";
import { getCmuLookupMap } from "@/lib/ensure-alumni";
import { normalizeCmuBirthday } from "@/lib/alumni-verify";

const DRY_RUN = process.env.DRY_RUN === "1";

/**
 * Safe fallback for rows with no CMU truth: if a stored value is ISO and its
 * MONTH component is > 12, that's impossible for a real date — it must be a
 * day that the old buggy parser dropped into the month slot. Swap it back.
 * Never fires on a valid date (month is always 1-12) nor on non-ISO values
 * (e.g. Buddhist DDMMYYYY from portal signup), so it can't corrupt anything.
 * Returns the corrected ISO string, or null to leave the value untouched.
 */
function safeSwapIfUnambiguous(v: string | null): string | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  const month = parseInt(mm, 10);
  if (month > 12) return `${yyyy}-${dd}-${mm}`; // dd (1-12) → month, mm (>12) → day
  return null;
}

interface PendingUpdate {
  id: string;
  studentId: string;
  from: string | null;
  to: string;
}

async function main() {
  const alumni = await prisma.alumni.findMany({
    select: { id: true, studentId: true, birthDate: true },
    orderBy: { studentId: "asc" },
  });
  console.log(`Loaded ${alumni.length} alumni rows.`);

  const cmuMap = await getCmuLookupMap();
  console.log(`CMU lookup has ${cmuMap.size} graduates.`);

  let cmuTruth = 0;
  let alreadyCorrect = 0;
  let fixedByCmu = 0;
  let fixedByHeuristic = 0;
  let noTruthLeftAsIs = 0; // not in CMU, or in CMU but no birthday, and not unambiguous
  const reviewSamples: { studentId: string; birthDate: string | null }[] = [];
  const pending: PendingUpdate[] = [];

  for (const a of alumni) {
    const sid = (a.studentId ?? "").trim();
    const cmu = cmuMap.get(sid);
    const cmuCorrect = cmu ? normalizeCmuBirthday(cmu.birthday) : null;

    if (cmuCorrect) {
      cmuTruth++;
      if (a.birthDate === cmuCorrect) {
        alreadyCorrect++;
        continue;
      }
      fixedByCmu++;
      pending.push({ id: a.id, studentId: sid, from: a.birthDate, to: cmuCorrect });
      continue;
    }

    // No CMU truth (absent from CMU, or CMU has no birthday). Try the safe
    // unambiguous swap on a stored ISO value; otherwise leave it for review.
    const swapped = safeSwapIfUnambiguous(a.birthDate);
    if (swapped) {
      fixedByHeuristic++;
      pending.push({ id: a.id, studentId: sid, from: a.birthDate, to: swapped });
    } else {
      noTruthLeftAsIs++;
      if (a.birthDate && reviewSamples.length < 20) {
        reviewSamples.push({ studentId: sid, birthDate: a.birthDate });
      }
    }
  }

  const corrected = pending.filter((p) => p.from != null).length;
  const filled = pending.filter((p) => p.from == null).length;

  console.log(
    `\nCMU truth available: ${cmuTruth} (already correct: ${alreadyCorrect}, fix via CMU: ${fixedByCmu})`,
  );
  console.log(
    `No CMU truth: fixed by unambiguous swap: ${fixedByHeuristic}, left as-is: ${noTruthLeftAsIs}`,
  );
  console.log(
    `Pending updates: ${pending.length}  (fix swapped: ${corrected}, fill null: ${filled})`,
  );

  if (pending.length) {
    console.log("\nSample pending changes (up to 15):");
    for (const p of pending.slice(0, 15)) {
      console.log(`  ${p.studentId}: ${p.from ?? "∅"}  →  ${p.to}`);
    }
  }
  if (reviewSamples.length) {
    console.log(
      "\nRows left as-is with a stored birthDate (ambiguous — review manually):",
    );
    for (const s of reviewSamples) {
      console.log(`  ${s.studentId}: ${s.birthDate}`);
    }
  }

  if (DRY_RUN) {
    console.log("\n[DRY_RUN] No writes performed.");
    return;
  }
  if (pending.length === 0) {
    console.log("\nNothing to update.");
    return;
  }

  // Apply in batches to avoid an oversized single transaction.
  const BATCH = 200;
  let written = 0;
  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH);
    await prisma.$transaction(
      slice.map((p) =>
        prisma.alumni.update({
          where: { id: p.id },
          data: { birthDate: p.to },
        }),
      ),
    );
    written += slice.length;
    console.log(`  wrote ${written}/${pending.length}`);
  }
  console.log(`\nApplied ${written} update(s).`);
}

main()
  .catch((err) => {
    console.error("backfill-birthdates failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
