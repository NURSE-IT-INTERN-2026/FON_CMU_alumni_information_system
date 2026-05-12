"use client";

import { useEffect, useState, useCallback } from "react";
import { DEGREE_LABELS, PAGE_SIZE } from "@/lib/constants";

interface Alumni {
  id: string;
  firstName: string;
  lastName: string;
  degreeLevel: string;
  graduationYear: number;
  achievementSummary: string | null;
  photoUrl: string | null;
}

interface ApiResponse {
  data: Alumni[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`;
}

export default function ModelRepresentativesPage() {
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  const fetchAlumni = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        search,
      });
      const res = await fetch(`/api/model-representatives?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ApiResponse = await res.json();
      setAlumni(data.data);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchAlumni();
  }, [fetchAlumni]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-center text-2xl font-bold text-[var(--primary)] sm:text-3xl">
        ผู้แทนรุ่น
      </h1>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="ค้นหาชื่อหรือผลงาน..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] sm:max-w-md"
        />
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : alumni.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm">
          <p className="text-[var(--muted)]">ไม่พบข้อมูล</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {alumni.map((a) => (
            <div
              key={a.id}
              className="overflow-hidden rounded-lg bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex flex-col items-center p-6 text-center">
                <div className="mb-4 h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[var(--accent)]/10">
                  {a.photoUrl ? (
                    <img
                      src={a.photoUrl}
                      alt={`${a.firstName} ${a.lastName}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl font-bold text-[var(--accent)]">
                      {getInitials(a.firstName, a.lastName)}
                    </div>
                  )}
                </div>
                <h3 className="mb-1 text-base font-semibold text-[var(--foreground)]">
                  {a.firstName} {a.lastName}
                </h3>
                <p className="mb-1 text-sm text-[var(--muted)]">
                  {DEGREE_LABELS[a.degreeLevel] || a.degreeLevel}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  ปีที่จบ: {a.graduationYear + 543}
                </p>
              </div>
              {a.achievementSummary && (
                <div className="border-t border-[var(--border)] px-5 py-3">
                  <p className="line-clamp-3 text-sm text-[var(--muted)]">
                    {a.achievementSummary}
                  </p>
                </div>
              )}
            </div>
          ))}
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
