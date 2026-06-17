"use client";

import { useEffect, useState } from "react";
import { BASE_PATH } from "@/lib/constants";

/**
 * Returns `{ [recordId]: string[] }` — the fields that have ≥1 recorded change —
 * for the given resource and record IDs. Powers the orange "updated value"
 * indicators on the admin data pages (PRD §3.16).
 *
 * Pass the IDs of the records currently visible on the page.
 */
export function useHotFields(
  resourceType: string,
  recordIds: string[]
): Record<string, string[]> {
  const [hot, setHot] = useState<Record<string, string[]>>({});
  // Stable key so the effect only refires when the actual set of IDs changes.
  const idsKey = recordIds.slice().sort().join(",");

  useEffect(() => {
    if (!resourceType || idsKey.length === 0) {
      setHot({});
      return;
    }
    let cancelled = false;
    fetch(
      `${BASE_PATH}/api/field-changes?resourceType=${encodeURIComponent(resourceType)}&ids=${encodeURIComponent(idsKey)}`
    )
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, string[]>) => {
        if (!cancelled) setHot(data || {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [resourceType, idsKey]);

  return hot;
}
