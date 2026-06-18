"use client";

import { useState, useCallback } from "react";
import { BASE_PATH } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AlumniSearchResult {
  id: string;
  studentId: string;
  prefix: string;
  firstName: string;
  maidenLastName: string;
  // CMU `major_name_th` (or local alumni `major`) — surfaced so entity forms can
  // auto-fill the `major` (สาขาวิชา) field when a record is linked to this alumni.
  major?: string;
}

interface CmuAlumni {
  student_id: string;
  name_th: string;
  surname_th: string;
  major_name_th?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAlumniSearch() {
  const [alumniResults, setAlumniResults] = useState<AlumniSearchResult[]>([]);
  const [showAlumniDropdown, setShowAlumniDropdown] = useState(false);

  const searchAlumni = useCallback(async (term: string) => {
    if (term.length < 2) {
      setAlumniResults([]);
      setShowAlumniDropdown(false);
      return;
    }

    try {
      // Fetch both local DB and CMU Registrar API in parallel
      const [localRes, cmuRes] = await Promise.allSettled([
        fetch(
          `${BASE_PATH}/api/alumni?search=${encodeURIComponent(term)}&pageSize=10`,
        ),
        fetch(
          `${BASE_PATH}/api/cmu-alumni?search=${encodeURIComponent(term)}&pageSize=10`,
        ),
      ]);

      // Parse local results
      const localData: AlumniSearchResult[] = [];
      if (localRes.status === "fulfilled" && localRes.value.ok) {
        const json = await localRes.value.json();
        for (const a of json.data ?? []) {
          localData.push({
            id: a.id,
            studentId: a.studentId,
            prefix: a.prefix ?? "",
            firstName: a.firstName ?? "",
            maidenLastName: a.maidenLastName ?? "",
            major: a.major ?? "",
          });
        }
      }

      // Parse CMU results
      const cmuData: AlumniSearchResult[] = [];
      if (cmuRes.status === "fulfilled" && cmuRes.value.ok) {
        const json = await cmuRes.value.json();
        for (const c of (json.data ?? []) as CmuAlumni[]) {
          cmuData.push({
            id: c.student_id,
            studentId: c.student_id,
            prefix: "",
            firstName: c.name_th || "",
            maidenLastName: c.surname_th || "",
            major: c.major_name_th || "",
          });
        }
      }

      // Merge: insert CMU first, then local (local wins on studentId collision)
      const merged = new Map<string, AlumniSearchResult>();
      for (const c of cmuData) {
        merged.set(c.studentId, c);
      }
      for (const l of localData) {
        merged.set(l.studentId, l);
      }

      setAlumniResults(Array.from(merged.values()).slice(0, 10));
      setShowAlumniDropdown(true);
    } catch {
      setAlumniResults([]);
      setShowAlumniDropdown(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setAlumniResults([]);
    setShowAlumniDropdown(false);
  }, []);

  const displayName = useCallback(
    (a: { prefix: string; firstName: string; maidenLastName: string }) =>
      `${a.prefix}${a.firstName} ${a.maidenLastName}`,
    [],
  );

  return {
    alumniResults,
    showAlumniDropdown,
    searchAlumni,
    clearResults,
    displayName,
  };
}
