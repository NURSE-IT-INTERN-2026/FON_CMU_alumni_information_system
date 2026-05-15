"use client";

import { useEffect, useState, useCallback } from "react";
import { PAGE_SIZE } from "@/lib/constants";

interface Association {
  id: string;
  studentId: string;
  fullName: string;
  associationName: string;
  position: string;
  recordedYear: number;
}

interface ApiResponse {
  data: Association[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type SortField = "studentId" | "fullName" | "associationName" | "position" | "recordedYear";
type SortDir = "asc" | "desc";

export default function AssociationsPage() {
  const [items, setItems] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("associationName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortField,
        sortOrder: sortDir,
      });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/associations?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ApiResponse = await res.json();
      setItems(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, sortField, sortDir]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSearch = () => {
    setPage(1);
    fetchItems();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);

  const paginationNumbers = (() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  })();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-center text-2xl font-bold text-[var(--primary)] sm:text-3xl">
        สมาคม/ชมรมศิษย์เก่า
      </h1>

      {/* Search */}
      <div className="mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="ค้นหารหัสนักศึกษา, ชื่อ-สกุล, สมาคม/ชมรม, ตำแหน่ง..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] sm:max-w-md"
          />
          <button
            onClick={handleSearch}
            className="rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: "var(--primary)" }}
          >
            ค้นหา
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm">
          <p className="text-[var(--muted)]">ไม่พบข้อมูล</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--primary)] text-white">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    ลำดับ
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("studentId")}>
                    รหัสนักศึกษา {sortField === "studentId" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("fullName")}>
                    ชื่อ-สกุล {sortField === "fullName" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("associationName")}>
                    ชื่อสมาคม/ชมรม {sortField === "associationName" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("position")}>
                    ตำแหน่ง {sortField === "position" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("recordedYear")}>
                    ปีที่บันทึก {sortField === "recordedYear" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr
                    key={item.id}
                    className="border-b border-[var(--border)] transition-colors last:border-b-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-center text-gray-500">
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">{item.studentId}</td>
                    <td className="px-4 py-3">{item.fullName}</td>
                    <td className="px-4 py-3">{item.associationName}</td>
                    <td className="px-4 py-3">{item.position}</td>
                    <td className="px-4 py-3 text-center">{item.recordedYear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
            <span className="text-sm text-gray-500">
              แสดง {pageStart}-{pageEnd} จาก {total} รายการ
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ก่อนหน้า
              </button>
              {paginationNumbers.map((p, i) =>
                p === "..." ? (
                  <span key={`dot-${i}`} className="px-2 text-gray-400">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      page === p ? "text-white" : "text-gray-600 hover:bg-gray-50"
                    }`}
                    style={page === p ? { backgroundColor: "var(--primary)" } : {}}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
