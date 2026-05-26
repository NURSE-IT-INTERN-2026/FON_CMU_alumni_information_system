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

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
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
    isSelected,
    isAllSelected,
    getSelectedArray,
  };
}
