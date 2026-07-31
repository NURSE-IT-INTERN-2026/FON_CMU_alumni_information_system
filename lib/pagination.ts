import { PAGE_SIZE } from "@/lib/constants";

/**
 * Upper bound on `pageSize` for standard paginated list endpoints — a DoS guard
 * (without it, `?pageSize=9999999` forces a huge DB read + JSON serialize).
 * `/api/alumni` passes a larger `maxPageSize` (50_000) because the all-alumni
 * management page legitimately fetches the full local list for its client-side
 * CMU+local merge.
 */
export const MAX_LIST_PAGE_SIZE = 100;

/**
 * Clamp raw parsed `page`/`pageSize` to safe integers. Coerces NaN / non-finite
 * / `< 1` to the defaults — `parseInt("abc")` is `NaN`, and `Math.max(1, NaN)
 * === NaN` would otherwise propagate into Prisma `take` and 500 the request.
 * The cap (`maxPageSize`) bounds the worst-case response size per request.
 */
export function clampPaging(
  pageRaw: number,
  pageSizeRaw: number,
  options?: { defaultPageSize?: number; maxPageSize?: number },
): { page: number; pageSize: number } {
  const defaultPageSize = options?.defaultPageSize ?? PAGE_SIZE;
  const maxPageSize = options?.maxPageSize ?? MAX_LIST_PAGE_SIZE;
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1
      ? Math.min(Math.floor(pageSizeRaw), maxPageSize)
      : defaultPageSize;
  return { page, pageSize };
}
