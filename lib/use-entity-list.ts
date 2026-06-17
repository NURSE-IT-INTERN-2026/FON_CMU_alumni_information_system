"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PAGE_SIZE } from "@/lib/constants";
import { facetQueryParams } from "@/lib/filter-facets";

/** The shared list envelope every standard entity endpoint returns. */
export interface EntityListResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Params every standard entity page tracks. `filters` builds the query string;
 *  `filtersKey` (the serialized facet string) is the stable value put in the
 *  query key — never put the raw `filters` object in a key (identity churn). */
export interface EntityListParams {
  page: number;
  search: string;
  searchField: string;
  sortField: string;
  sortDir: "asc" | "desc";
  filters: Record<string, string[]>;
  filtersKey: string;
}

/**
 * Shared list query for the standard entity tables. Replaces the per-page
 * `useState` + `useCallback(fetch)` + `useEffect` boilerplate.
 *
 * The query key is `[scope, "list", opts]`, so invalidating with
 * `queryClient.invalidateQueries({ queryKey: queryKeys.<scope>.all })` refetches
 * the list after any mutation. Call sites read `items`/`total`/`totalPages` and
 * the usual RQ status flags (`isPending`, `isError`, `error`, …).
 */
export function useEntityList<T>(
  scope: string,
  entityPath: string,
  params: EntityListParams,
  options?: {
    enabled?: boolean;
    /** Query-string key for the sort field — entities differ: "sortField"
     *  (associations, awards) vs "sortBy" (potentials, graduate-committee). */
    sortKey?: string;
    /** Query-string key for sort direction — "sortOrder" (most) vs "sortDir" (awards). */
    sortOrderKey?: string;
  },
) {
  const { page, search, searchField, sortField, sortDir, filters, filtersKey } =
    params;
  const sortKeyName = options?.sortKey ?? "sortField";
  const sortOrderKeyName = options?.sortOrderKey ?? "sortOrder";

  const query = useQuery<EntityListResponse<T>>({
    queryKey: [
      scope,
      "list",
      { page, search, searchField, sortField, sortDir, filtersKey },
    ],
    queryFn: () => {
      const p = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        [sortKeyName]: sortField,
        [sortOrderKeyName]: sortDir,
        searchField,
      });
      if (search.trim()) p.set("search", search.trim());
      facetQueryParams(filters).forEach((v, k) => p.set(k, v));
      return apiFetch<EntityListResponse<T>>(`${entityPath}?${p}`);
    },
    enabled: options?.enabled ?? true,
  });

  return {
    ...query,
    items: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    totalPages: query.data?.totalPages ?? 1,
  };
}
