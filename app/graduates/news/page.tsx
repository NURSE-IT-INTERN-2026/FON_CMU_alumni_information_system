"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PAGE_SIZE, BASE_PATH } from "@/lib/constants";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function formatThaiDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  const d = new Date(dateStr);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

interface NewsItem {
  id: string;
  title: string;
  body: string;
  coverImageUrl: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  createdAt: string;
}

interface ApiResponse {
  data: NewsItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function AlumniNewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        status: "PUBLISHED",
      });
      if (search) params.set("search", search);

      const res = await fetch(`${BASE_PATH}/api/news?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ApiResponse = await res.json();
      setNews(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      setErrorMsg("ไม่สามารถโหลดข้อมูลข่าวสารได้");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          ข่าวสารและกิจกรรม
        </h1>
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-4 text-red-500 hover:text-red-700 font-bold">&times;</button>
        </div>
      )}

      {/* Search */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="ค้นหาข่าว..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : news.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm">
          <svg className="mx-auto mb-4 h-12 w-12 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <p className="text-[var(--muted)]">ยังไม่มีข่าวสาร</p>
        </div>
      ) : (
        /* Card grid — same as admin view mode */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {news.map((item) => {
            const summary = stripHtml(item.body).slice(0, 150);
            return (
              <Link
                key={item.id}
                href={`/graduates/news/${item.id}`}
                className="group overflow-hidden rounded-lg bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="aspect-video w-full overflow-hidden bg-gray-100">
                  {item.coverImageUrl ? (
                    <img src={item.coverImageUrl} alt={item.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[var(--primary)]/5">
                      <svg className="h-12 w-12 text-[var(--primary)]/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="mb-2 line-clamp-2 text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                    {item.title}
                  </h3>
                  <p className="mb-2 text-xs text-[var(--muted)]">
                    {item.publishedAt ? formatThaiDate(item.publishedAt) : ""}
                  </p>
                  {summary && (
                    <p className="line-clamp-3 text-sm text-[var(--muted)]">
                      {summary}{stripHtml(item.body).length > 150 ? "..." : ""}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-sm text-gray-500">แสดง {pageStart}-{pageEnd} จาก {total} รายการ</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100"
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
                  className={`rounded-md px-3 py-1.5 text-sm ${p === page ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-white hover:bg-gray-100"}`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100"
            >
              ถัดไป
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
