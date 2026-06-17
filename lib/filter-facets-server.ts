/**
 * Server-only facet query logic. Imports Prisma — must NEVER be imported from a
 * client component (that would pull the pg adapter / Node `dns` into the client
 * bundle). Import this only from API route handlers.
 */
import prisma from "@/lib/prisma";
import {
  ENTITY_DELEGATE,
  FACET_FIELDS,
  FACET_PAGE_SIZE,
  YEAR_FIELDS,
  type FacetResult,
  type FacetValue,
} from "@/lib/filter-facets";

/**
 * Return paginated facet values for an entity field.
 * - String fields: grouped by count, ordered by count desc (PRD §3.10 top-5-by-count).
 * - Year fields: distinct values ordered descending.
 */
export async function getFacetValues(
  entity: string,
  field: string,
  opts: { page?: number; search?: string } = {}
): Promise<FacetResult> {
  const delegateKey = ENTITY_DELEGATE[entity];
  const allowed = FACET_FIELDS[entity];
  if (!delegateKey || !allowed || !allowed.includes(field)) {
    throw new Error("Invalid entity or field");
  }
  const isYear = YEAR_FIELDS.has(field);
  const page = Math.max(1, opts.page ?? 1);
  const search = opts.search?.trim();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (prisma as any)[delegateKey];
  const baseWhere: Record<string, unknown> = { deletedAt: null };
  if (search && !isYear) baseWhere[field] = { contains: search, mode: "insensitive" };

  // truthy/non-empty check applied client-side (Prisma 7 rejects `{ not: null }` here)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isRealValue = (v: any) => v !== null && v !== undefined && String(v).trim() !== "";

  if (isYear) {
    const rows = await model.findMany({
      where: baseWhere,
      distinct: [field],
      orderBy: { [field]: "desc" },
      select: { [field]: true },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let vals = rows.map((r: any) => r[field]).filter(isRealValue);
    if (search) vals = vals.filter((v: any) => String(v).includes(search));
    const total = vals.length;
    const start = (page - 1) * FACET_PAGE_SIZE;
    const pageVals = vals.slice(start, start + FACET_PAGE_SIZE);
    return {
      values: pageVals.map((v: number) => ({ value: String(v), count: 0 })),
      total,
      page,
      pageSize: FACET_PAGE_SIZE,
      totalPages: Math.ceil(total / FACET_PAGE_SIZE),
      isYear: true,
    };
  }

  const [groups, allGroups] = await Promise.all([
    model.groupBy({
      by: [field],
      where: baseWhere,
      _count: { _all: true },
      orderBy: [{ _count: { [field]: "desc" } }, { [field]: "asc" }],
      skip: (page - 1) * FACET_PAGE_SIZE,
      take: FACET_PAGE_SIZE,
    }),
    model.groupBy({
      by: [field],
      where: baseWhere,
      _count: { _all: true },
    }),
  ]);
  const values: FacetValue[] = groups
    .filter((g: any) => isRealValue(g[field]))
    .map((g: any) => ({ value: String(g[field]), count: g._count?._all ?? 0 }));
  const total = allGroups.filter((g: any) => isRealValue(g[field])).length;
  return {
    values,
    total,
    page,
    pageSize: FACET_PAGE_SIZE,
    totalPages: Math.ceil(total / FACET_PAGE_SIZE),
    isYear: false,
  };
}
