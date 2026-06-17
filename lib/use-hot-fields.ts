"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/**
 * Returns `{ [recordId]: string[] }` — the fields that have ≥1 recorded change —
 * for the given resource and record IDs. Powers the orange "updated value"
 * indicators on the admin data pages (PRD §3.16).
 *
 * Pass the IDs of the records currently visible on the page. Backed by a React
 * Query keyed on resourceType + the sorted id set, so it refetches when the
 * visible rows change. `staleTime: 0` keeps the indicators fresh after edits.
 */
export function useHotFields(
  resourceType: string,
  recordIds: string[]
): Record<string, string[]> {
  const idsKey = recordIds.slice().sort().join(",");
  const enabled = !!resourceType && idsKey.length > 0;
  const { data } = useQuery({
    queryKey: queryKeys.fieldChanges.for({ resourceType, idsKey }),
    queryFn: () =>
      apiFetch<Record<string, string[]>>(
        `/api/field-changes?resourceType=${encodeURIComponent(resourceType)}&ids=${encodeURIComponent(idsKey)}`
      ),
    enabled,
    staleTime: 0,
  });
  return data ?? {};
}
