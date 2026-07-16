"use client";

import { useCallback, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BASE_PATH } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";
import { useRole } from "@/lib/role-context";

/**
 * Superadmin drag-to-resize column widths for a management table.
 *
 * The React Query cache is the single source of truth: pointer drag updates it
 * live via `setQueryData` (instant feedback, no flicker), and a debounced PUT
 * persists to `table_column_widths` on drag end. Non-superadmins fetch nothing
 * (the query is disabled) and see all-auto columns.
 *
 * @param tableKey  Stable key for the table; encode a mode suffix where the
 *                  column set changes (e.g. "alumni-agency:thailand").
 * @param columnCount Number of columns rendered — drives the <colgroup> length.
 */
export function useResizableColumns(
  tableKey: string,
  columnCount: number
) {
  const isSuperAdmin = useRole() === "superadmin";
  const queryClient = useQueryClient();
  const key = queryKeys.tablePrefs.for(tableKey);
  // Debounce timer for persistence (ref so it survives renders without retriggering).
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data } = useQuery<Record<string, number>>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(
        `${BASE_PATH}/api/table-prefs?table=${encodeURIComponent(tableKey)}`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) return {};
      const json = (await res.json()) as { widths?: Record<string, number> };
      return json.widths ?? {};
    },
    enabled: isSuperAdmin,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const widths: Record<string, number> = useMemo(() => data ?? {}, [data]);

  const mutation = useMutation({
    mutationFn: async (vars: {
      table: string;
      widths: Record<string, number>;
    }) => {
      const res = await fetch(`${BASE_PATH}/api/table-prefs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error("save column widths failed");
      return (await res.json()).widths as Record<string, number>;
    },
    // Keep the cache in sync with what the server accepted.
    onSuccess: (saved) => {
      queryClient.setQueryData(key, saved);
    },
  });

  /** Read the latest widths straight from the cache (avoids stale closures). */
  const currentWidths = useCallback(
    (): Record<string, number> =>
      queryClient.getQueryData<Record<string, number>>(key) ?? {},
    [queryClient, key]
  );

  /** Write one column's width into the cache + schedule a debounced save. */
  const setColumnWidth = useCallback(
    (i: number, px: number) => {
      queryClient.setQueryData<Record<string, number>>(key, (old) => ({
        ...(old ?? {}),
        [i]: px,
      }));
      // Debounced persist — coalesce a burst of pointermove events.
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        mutation.mutate({ table: tableKey, widths: currentWidths() });
      }, 400);
    },
    [queryClient, key, mutation, tableKey, currentWidths]
  );

  /** Persist immediately, clearing any pending debounced save. */
  const flushPersist = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    mutation.mutate({ table: tableKey, widths: currentWidths() });
  }, [mutation, tableKey, currentWidths]);

  /**
   * Returns an onPointerDown handler for column `i`. The handle element's parent
   * is the `<th>`, whose rendered width seeds the resize.
   */
  const startResize = useCallback(
    (i: number) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isSuperAdmin) return;
      e.preventDefault();
      e.stopPropagation();
      const th = e.currentTarget.parentElement as HTMLTableCellElement | null;
      if (!th) return;

      const startX = e.clientX;
      const rect = th.getBoundingClientRect();
      const startWidth = rect.width || currentWidths()[String(i)] || 0;
      if (!startWidth) return;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const next = clampPx(Math.round(startWidth + dx));
        setColumnWidth(i, next);
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        flushPersist();
      };

      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [isSuperAdmin, setColumnWidth, flushPersist, currentWidths]
  );

  /** Double-click a handle ⇒ auto-fit (drop that column's saved width). */
  const resetColumn = useCallback(
    (i: number) => {
      if (!isSuperAdmin) return;
      queryClient.setQueryData<Record<string, number>>(key, (old) => {
        if (!old || !(String(i) in old)) return old ?? {};
        const next = { ...old };
        delete next[String(i)];
        return next;
      });
      flushPersist();
    },
    [isSuperAdmin, queryClient, key, flushPersist]
  );

  /** รีเซ็ตความกว้าง button ⇒ clear every column back to auto. */
  const resetAll = useCallback(() => {
    if (!isSuperAdmin) return;
    queryClient.setQueryData(key, {});
    flushPersist();
  }, [isSuperAdmin, queryClient, key, flushPersist]);

  return {
    columnCount,
    widths,
    isSuperAdmin,
    startResize,
    resetColumn,
    resetAll,
  };
}

const MIN_WIDTH = 60;
const MAX_WIDTH = 800;
function clampPx(px: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, px));
}
