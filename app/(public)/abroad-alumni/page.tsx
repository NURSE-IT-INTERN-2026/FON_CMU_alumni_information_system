"use client";

import { useEffect, useState, useCallback } from "react";
import { DEGREE_LABELS, PAGE_SIZE } from "@/lib/constants";

interface Alumni {
  id: string;
  firstName: string;
  lastName: string;
  degreeLevel: string;
  graduationYear: number;
  country: string | null;
  currentWorkplace: string | null;
}

interface ApiResponse {
  data: Alumni[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  countries: string[];
}

export default function AbroadAlumniPage() {
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [countries, setCountries] = useState<string[]>([]);

  const fetchAlumni = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        search,
        country: countryFilter,
      });
      const res = await fetch(`/api/abroad-alumni?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ApiResponse = await res.json();
      setAlumni(data.data);
      setTotalPages(data.totalPages);
      if (data.countries.length > 0 && countries.length === 0) {
        setCountries(data.countries);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, countryFilter, countries.length]);

  useEffect(() => {
    fetchAlumni();
  }, [fetchAlumni]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCountryFilter = (value: string) => {
    setCountryFilter(value);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-center text-2xl font-bold text-[var(--primary)] sm:text-3xl">
        ข้อมูลการทำงานต่างประเทศ
      </h1>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="ค้นหาชื่อ ประเทศ หรือสถานที่ทำงาน..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />
        <select
          value={countryFilter}
          onChange={(e) => handleCountryFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        >
          <option value="">ทุกประเทศ</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-[var(--primary)]">
                  ชื่อ-นามสกุล
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--primary)]">
                  ระดับปริญญา
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--primary)]">
                  ปีที่จบ
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--primary)]">
                  ประเทศ
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--primary)]">
                  สถานที่ทำงาน
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
                    </div>
                  </td>
                </tr>
              ) : alumni.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[var(--muted)]">
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                alumni.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-[var(--border)] transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      {a.firstName} {a.lastName}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-[var(--primary)]/10 px-3 py-1 text-xs font-medium text-[var(--primary)]">
                        {DEGREE_LABELS[a.degreeLevel] || a.degreeLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3">{a.graduationYear + 543}</td>
                    <td className="px-4 py-3">{a.country || "-"}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {a.currentWorkplace || "-"}
                    </td>
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
