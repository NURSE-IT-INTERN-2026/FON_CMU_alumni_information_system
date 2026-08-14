import type { Prisma, CommunityGroup } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

/**
 * COHORT-group materialization (server-only). One CommunityGroup per distinct
 * cohort value, created lazily the first time someone needs it (join, browse).
 * `cohortKey`/slug normalize whitespace only — Thai cohort labels are kept
 * verbatim (never transliterated; "พยบ. 25" must round-trip exactly).
 */

/** Normalize a cohort label for matching/slug: collapse whitespace, trim. */
export function normalizeCohortKey(cohort: string): string {
  return cohort.replace(/\s+/g, " ").trim();
}

/** Slug for a cohort group: ASCII-safe prefix + the normalized key. */
export function cohortSlug(cohort: string): string {
  return `cohort-${normalizeCohortKey(cohort)}`;
}

type Db = typeof prisma | Prisma.TransactionClient;

/**
 * Find-or-create the COHORT group for a cohort label (idempotent). Returns
 * the group. `title` = `รุ่น <cohort>`; description is generic (admins/members
 * can't edit auto cohort groups — they're derived from data).
 */
export async function ensureCohortGroup(
  cohort: string,
  db: Db = prisma,
): Promise<CommunityGroup> {
  const key = normalizeCohortKey(cohort);
  if (!key) throw new Error("cohort key must be non-empty");

  const existing = await db.communityGroup.findFirst({
    where: { kind: "COHORT", cohortKey: key, deletedAt: null },
  });
  if (existing) return existing;

  return db.communityGroup.create({
    data: {
      slug: cohortSlug(key),
      kind: "COHORT",
      cohortKey: key,
      title: `รุ่น ${key}`,
      description: "กลุ่มสำหรับศิษย์เก่ารุ่นนี้ (สร้างอัตโนมัติจากรุ่นที่จบการศึกษา)",
    },
  });
}
