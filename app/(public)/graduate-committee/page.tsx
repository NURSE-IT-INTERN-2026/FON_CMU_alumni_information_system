"use client";

import { useEffect, useState, useCallback } from "react";
import { PAGE_SIZE } from "@/lib/constants";

interface Committee {
  id: string;
  termYear: number;
  studentId: string;
  fullName: string;
  cohort: string;
  position: string;
  remarks: string | null;
}

interface ApiResponse {
  data: Committee[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type SortField = "termYear" | "studentId" | "fullName" | "cohort" | "position" | "remarks";
type SortDir = "asc" | "desc";

export default function GraduateCommitteePage() {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [filterCohort, setFilterCohort] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [cohortOptions, setCohortOptions] = useState<string[]>([]);
  const [positionOptions, setPositionOptions] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>("termYear");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchFilterOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/graduate-committee?pageSize=9999");
      if (!res.ok) return;
      const json = await res.json();
      const all: Committee[] = json.data;
      setCohortOptions([...new Set(all.map((c) => c.cohort).filter(Boolean))].sort());
      setPositionOptions([...new Set(all.map((c) => c.position).filter(Boolean))].sort());
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  const fetchCommittees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy: sortField,
        sortOrder: sortDir,
      });
      if (search) params.set("search", search);
      if (filterCohort) params.set("cohort", filterCohort);
      if (filterPosition) params.set("position", filterPosition);

      const res = await fetch(`/api/graduate-committee?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ApiResponse = await res.json();
      setCommittees(data.data);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterCohort, filterPosition, sortField, sortDir]);

  useEffect(() => {
    fetchCommittees();
  }, [fetchCommittees]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-center text-2xl font-bold text-[var(--primary)] sm:text-3xl">
        กรรมการบัณฑิต
      </h1>

      {/* Search & Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="ค้นหารหัสนักศึกษา, ชื่อ-สกุล, ตำแหน่ง..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />
        <select
          value={filterCohort}
          onChange={(e) => { setFilterCohort(e.target.value); setPage(1); }}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] bg-white"
        >
          <option value="">ทุกรุ่น</option>
          {cohortOptions.map((c) => (
            <option key={c} value={c}>รุ่น {c}</option>
          ))}
        </select>
        <select
          value={filterPosition}
          onChange={(e) => { setFilterPosition(e.target.value); setPage(1); }}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] bg-white"
        >
          <option value="">ทุกตำแหน่ง</option>
          {positionOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white text-left" style={{ backgroundColor: "#1e3a5f" }}>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("termYear")}>
                  ปี พ.ศ. {sortField === "termYear" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("studentId")}>
                  รหัสนักศึกษา {sortField === "studentId" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("fullName")}>
                  ชื่อ-สกุล (ขณะกำลังศึกษา) {sortField === "fullName" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("cohort")}>
                  รุ่นที่ {sortField === "cohort" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("position")}>
                  ตำแหน่ง {sortField === "position" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("remarks")}>
                  หมายเหตุ {sortField === "remarks" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
                    </div>
                  </td>
                </tr>
              ) : committees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[var(--muted)]">
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                committees.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--border)] transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-center">{c.termYear}</td>
                    <td className="px-4 py-3 font-mono">{c.studentId}</td>
                    <td className="px-4 py-3">{c.fullName}</td>
                    <td className="px-4 py-3 text-center">{c.cohort}</td>
                    <td className="px-4 py-3">{c.position}</td>
                    <td className="px-4 py-3 text-gray-500">{c.remarks || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
          >
            ก่อนหน้า
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                p === page
                  ? "bg-[var(--primary)] text-white"
                  : "border border-[var(--border)] hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
          >
            ถัดไป
          </button>
        </div>
      )}
    </div>
  );
}
