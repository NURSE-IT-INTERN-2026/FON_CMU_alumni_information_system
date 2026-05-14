"use client";

import { useEffect, useState, useCallback } from "react";
import { PAGE_SIZE } from "@/lib/constants";

interface Potential {
  id: string;
  studentId: string;
  fullName: string;
  career: string;
  position: string;
  recordedYear: number;
}

interface ApiResponse {
  data: Potential[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function PotentialsPage() {
  const [potentials, setPotentials] = useState<Potential[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  const fetchPotentials = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/potentials?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ApiResponse = await res.json();
      setPotentials(data.data);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchPotentials();
  }, [fetchPotentials]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const rowNumber = (index: number) => (page - 1) * PAGE_SIZE + index + 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-center text-2xl font-bold text-[var(--primary)] sm:text-3xl">
        ศักยภาพ
      </h1>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="ค้นหารหัสนักศึกษา, ชื่อ-สกุล, อาชีพ, ตำแหน่ง..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] sm:max-w-md"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : potentials.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm">
          <p className="text-[var(--muted)]">ไม่พบข้อมูล</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--primary)] text-white">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  ลำดับ
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  รหัสนักศึกษา
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  ชื่อ-สกุล
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  อาชีพ
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  ตำแหน่ง
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  ปีที่บันทึก
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {potentials.map((p, i) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-center text-gray-500">{rowNumber(i)}</td>
                  <td className="px-4 py-3 font-mono text-gray-700">{p.studentId}</td>
                  <td className="px-4 py-3">{p.fullName}</td>
                  <td className="px-4 py-3">{p.career}</td>
                  <td className="px-4 py-3">{p.position}</td>
                  <td className="px-4 py-3 text-center">{p.recordedYear}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
