import { useState, useCallback } from "react";

export function useBulkSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Merge the given ids into the selection — used by "select all on this page",
  // so selecting-all on page 2 ADDS to page 1's selection instead of replacing it.
  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => new Set([...prev, ...ids]));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Remove only the given ids (the current page) — the toggle's "deselect this
  // page" branch, so it doesn't wipe other pages' selections. Unknown ids ignored.
  const deselectPage = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const selectedCount = selectedIds.size;

  const isAllSelected = useCallback(
    (pageIds: string[]) =>
      pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id)),
    [selectedIds]
  );

  const getSelectedArray = useCallback(
    () => Array.from(selectedIds),
    [selectedIds]
  );

  return {
    selectedIds,
    selectedCount,
    toggleSelect,
    selectAll,
    deselectAll,
    deselectPage,
    isSelected,
    isAllSelected,
    getSelectedArray,
  };
}
