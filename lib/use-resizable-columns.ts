"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BASE_PATH } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";
import { useRole } from "@/lib/role-context";

/**
 * Superadmin drag-to-resize column widths for a management table.
 *
 * Requires `table-layout: fixed` to actually move columns — under the default
 * `auto` layout a `<col>` width is only a minimum hint, and since these cells
 * are `whitespace-nowrap` you can't shrink a column below its content. So the
 * table stays `auto` (looking exactly as before) until widths are in play, then
 * we freeze the current auto widths as per-column defaults and flip to `fixed`.
 *
 * Width flow: the React Query cache holds the user's SAVED resizes; `defaults`
 * holds the frozen auto widths (captured once). ColGroup renders `saved ?? def`,
 * so un-resized columns keep their original width and only dragged ones change.
 * Non-superadmins fetch nothing and stay in auto layout (unchanged).
 *
 * @param tableKey  Stable key for the table; encode a mode suffix where the
 *                  column set changes (e.g. "alumni-agency:thailand").
 * @param columnCount Number of columns rendered — drives the <colgroup> length.
 * @param tableRef  Ref to the `<table>` element (for measuring + layout flip).
 */
export function useResizableColumns(
  tableKey: string,
  columnCount: number,
  tableRef: React.RefObject<HTMLTableElement | null>
) {
  const isSuperAdmin = useRole() === "superadmin";
  const queryClient = useQueryClient();
  const key = queryKeys.tablePrefs.for(tableKey);
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

  /** The user's saved resizes (persisted). */
  const saved = useMemo(() => data ?? {}, [data]);

  /**
   * Frozen auto-layout widths captured once (on first resize, or on mount when
   * the user already has saved widths). Null ⇒ still in auto layout.
   */
  const [defaults, setDefaults] = useState<Record<string, number> | null>(null);

  // Reset frozen defaults when the table/mode changes (new column set).
  const [prevKey, setPrevKey] = useState(tableKey);
  if (prevKey !== tableKey) {
    setPrevKey(tableKey);
    setDefaults(null);
  }

  /** Final per-column widths: saved resizes override the frozen defaults. */
  const widths = useMemo(() => ({ ...(defaults ?? {}), ...saved }), [defaults, saved]);

  /** Flip the table to `fixed` layout once defaults are frozen (superadmin). */
  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    el.style.tableLayout = isSuperAdmin && defaults ? "fixed" : "";
  }, [tableRef, isSuperAdmin, defaults]);

  /** Snapshot every `<th>`'s current rendered width (the auto-layout widths). */
  const captureDefaults = useCallback(() => {
    const table = tableRef.current;
    if (!table) return;
    const ths = table.querySelectorAll<HTMLTableCellElement>("thead th");
    const next: Record<string, number> = {};
    ths.forEach((th, i) => {
      const w = Math.round(th.getBoundingClientRect().width);
      if (w > 0) next[String(i)] = clampPx(w);
    });
    if (Object.keys(next).length > 0) setDefaults(next);
  }, [tableRef]);

  // Returning users with saved widths: freeze defaults on mount so the saved
  // widths actually apply under fixed layout (otherwise un-resized columns
  // would collapse to equal widths). This is a one-shot DOM measurement (the
  // guard prevents any cascade) — the captured widths need a laid-out table,
  // so they can't be derived at render time.
  useLayoutEffect(() => {
    if (isSuperAdmin && defaults === null && Object.keys(saved).length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      captureDefaults();
    }
  }, [isSuperAdmin, defaults, saved, captureDefaults]);

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
    onSuccess: (result) => {
      queryClient.setQueryData(key, result);
    },
  });

  /** Read the latest SAVED widths from the cache (avoids stale closures). */
  const currentWidths = useCallback(
    (): Record<string, number> =>
      queryClient.getQueryData<Record<string, number>>(key) ?? {},
    [queryClient, key]
  );

  /** Write one column's saved width into the cache + schedule a debounced save. */
  const setColumnWidth = useCallback(
    (i: number, px: number) => {
      queryClient.setQueryData<Record<string, number>>(key, (old) => ({
        ...(old ?? {}),
        [i]: px,
      }));
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
   * Begin dragging column `i`. On the very first resize, freeze the current
   * auto widths as defaults and flip the table to `fixed` layout.
   */
  const beginResize = useCallback(
    (i: number, startWidth: number, clientX: number) => {
      if (!isSuperAdmin || !startWidth) return;
      if (defaults === null) captureDefaults();
      const startX = clientX;

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
    [isSuperAdmin, defaults, captureDefaults, setColumnWidth, flushPersist]
  );

  /** Double-click a handle ⇒ drop this column's saved width (reverts to its
   *  frozen default under fixed layout). */
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

  /** รีเซ็ตความกว้าง button ⇒ clear saved widths AND frozen defaults (back to
   *  the original auto layout). */
  const resetAll = useCallback(() => {
    if (!isSuperAdmin) return;
    queryClient.setQueryData(key, {});
    setDefaults(null);
    flushPersist();
  }, [isSuperAdmin, queryClient, key, flushPersist]);

  return {
    columnCount,
    widths,
    isSuperAdmin,
    beginResize,
    resetColumn,
    resetAll,
  };
}

const MIN_WIDTH = 60;
const MAX_WIDTH = 800;
function clampPx(px: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, px));
}
