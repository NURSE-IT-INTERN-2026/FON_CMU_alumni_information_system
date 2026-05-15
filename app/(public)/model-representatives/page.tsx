"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PAGE_SIZE } from "@/lib/constants";

interface ModelRepresentative {
  id: string;
  name: string;
  cohort: string;
  generation: number;
}

interface ApiResponse {
  data: ModelRepresentative[];
}

const COHORT_ORDER = [
  "รายชื่อเครือข่ายศิษย์เก่าผู้ช่วยพยาบาล (รุ่น  1 – 38)",
  "รายชื่อเครือข่ายศิษย์เก่าปริญญาโท (รุ่น  1 – 20)",
  "รายชื่อเครือข่ายศิษย์เก่าอนุปริญญาพยาบาล (รุ่น  1 – 13)",
  "รายชื่อเครือข่ายศิษย์เก่าปริญญาพยาบาล (รุ่น  1 – 38)",
  "รายชื่อเครือข่ายศิษย์เก่าปริญญาเอก (รุ่น  1 – 6)",
];

export default function ModelRepresentativesPage() {
  const [alumni, setAlumni] = useState<ModelRepresentative[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [pages, setPages] = useState<Record<string, number>>({});
  const [sortDirs, setSortDirs] = useState<Record<string, "asc" | "desc">>({});

  const toggle = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !(prev[label] ?? true) }));

  const getPage = (label: string) => pages[label] ?? 1;
  const setPage = (label: string, p: number) =>
    setPages((prev) => ({ ...prev, [label]: p }));
  const getSortDir = (label: string) => sortDirs[label] ?? "asc";
  const toggleSort = (label: string) =>
    setSortDirs((prev) => ({
      ...prev,
      [label]: prev[label] === "asc" ? "desc" : "asc",
    }));

  const fetchAlumni = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search });
      const res = await fetch(`/api/model-representatives?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ApiResponse = await res.json();
      setAlumni(data.data);
      setPages({});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchAlumni();
  }, [fetchAlumni]);

  const grouped = useMemo(() => {
    const byCohort = new Map<string, ModelRepresentative[]>();
    for (const a of alumni) {
      const list = byCohort.get(a.cohort) || [];
      list.push(a);
      byCohort.set(a.cohort, list);
    }

    const sorted = [...byCohort.entries()].sort(([a], [b]) => {
      const ai = COHORT_ORDER.indexOf(a);
      const bi = COHORT_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    return sorted.map(([cohort, items]) => ({
      label: cohort,
      items: [...items].sort((a, b) => a.generation - b.generation),
    }));
  }, [alumni]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-center text-2xl font-bold text-[var(--primary)] sm:text-3xl">
        รายชื่อเครือข่ายศิษย์เก่าทุกรุ่นทุกหลักสูตร
      </h1>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="ค้นหาชื่อหรือรุ่น..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] sm:max-w-md"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : alumni.length === 0 ? (
        <div className="py-12 text-center text-[var(--muted)]">ไม่พบข้อมูล</div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => {
            const isCollapsed = collapsed[group.label] ?? true;
            const sortDir = getSortDir(group.label);
            const sortedItems = [...group.items].sort((a, b) =>
              sortDir === "asc" ? a.generation - b.generation : b.generation - a.generation
            );
            const totalPages = Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE));
            const currentPage = Math.min(getPage(group.label), totalPages);
            const start = (currentPage - 1) * PAGE_SIZE;
            const pageItems = sortedItems.slice(start, start + PAGE_SIZE);

            return (
              <div key={group.label} className="overflow-hidden rounded-lg bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggle(group.label)}
                  className="flex w-full items-center justify-between bg-[var(--primary)] px-4 py-3 text-left"
                >
                  <h2 className="text-sm font-semibold text-white sm:text-base">
                    {group.label}
                  </h2>
                  <svg
                    className={`h-5 w-5 shrink-0 text-white transition-transform ${isCollapsed ? "" : "rotate-180"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {!isCollapsed && (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-white text-left" style={{ backgroundColor: "#1e3a5f" }}>
                            <th
                              className="w-20 cursor-pointer px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap select-none hover:bg-white/10"
                              onClick={() => toggleSort(group.label)}
                            >
                              รุ่นที่ {sortDir === "asc" ? "▲" : "▼"}
                            </th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                              ชื่อ - นามสกุล
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageItems.map((a) => (
                            <tr
                              key={a.id}
                              className="border-b border-[var(--border)] transition-colors hover:bg-gray-50"
                            >
                              <td className="px-4 py-3 text-center">
                                {a.generation}
                              </td>
                              <td className="px-4 py-3">{a.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 1 && (
                      <div className="flex justify-center gap-2 border-t border-[var(--border)] px-4 py-3">
                        <button
                          onClick={() => setPage(group.label, Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
                        >
                          ก่อนหน้า
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            onClick={() => setPage(group.label, p)}
                            className={`rounded-md px-3 py-1.5 text-sm ${
                              p === currentPage
                                ? "bg-[var(--primary)] text-white"
                                : "border border-[var(--border)] hover:bg-gray-50"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                        <button
                          onClick={() => setPage(group.label, Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
                        >
                          ถัดไป
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
