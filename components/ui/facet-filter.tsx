"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BASE_PATH } from "@/lib/constants";

interface FacetValue {
  value: string;
  count: number;
}
interface FacetResponse {
  values: FacetValue[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isYear: boolean;
}

interface FacetFilterProps {
  entity: string;
  field: string;
  label: string;
  selected: string[];
  onChange: (vals: string[]) => void;
  /** Optional display labels for raw values (e.g. enum keys -> Thai). */
  valueLabels?: Record<string, string>;
  disabled?: boolean;
}

export default function FacetFilter({
  entity,
  field,
  label,
  selected,
  onChange,
  valueLabels,
  disabled,
}: FacetFilterProps) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FacetValue[]>([]);
  const [isYear, setIsYear] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(
    async (targetPage: number, searchTerm: string, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({
          entity,
          field,
          page: String(targetPage),
        });
        if (searchTerm) params.set("search", searchTerm);
        const res = await fetch(`${BASE_PATH}/api/filter-facets?${params}`);
        if (!res.ok) return;
        const data: FacetResponse = await res.json();
        setIsYear(data.isYear);
        setTotalPages(data.totalPages);
        setPage(data.page);
        setValues((prev) => (append ? [...prev, ...data.values] : data.values));
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [entity, field]
  );

  // Load first page whenever the panel is opened.
  useEffect(() => {
    if (open) {
      setSearch("");
      fetchPage(1, "", false);
    }
  }, [open, fetchPage]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchPage(1, search, false);
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search, open, fetchPage]);

  // Outside-click to close.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  const clear = () => onChange([]);

  const display = (v: string) => valueLabels?.[v] ?? v;
  const hasMore = page < totalPages;
  const activeCount = selected.length;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm bg-white transition-colors ${
          activeCount > 0
            ? "border-[var(--primary)] text-[var(--primary)]"
            : "border-[var(--border)] text-gray-700"
        } hover:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-50`}
      >
        <span className="truncate">
          {label}
          {activeCount > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-xs font-medium text-white">
              {activeCount}
            </span>
          )}
        </span>
        <svg className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา..."
              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {loading ? (
              <div className="px-3 py-4 text-center text-sm text-gray-400">กำลังโหลด...</div>
            ) : values.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-400">ไม่พบข้อมูล</div>
            ) : (
              values.map((v) => {
                const checked = selected.includes(v.value);
                return (
                  <button
                    type="button"
                    key={v.value}
                    onClick={() => toggle(v.value)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                      checked ? "bg-[var(--primary)]/5 text-[var(--primary)]" : "text-gray-700"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <input
                        type="checkbox"
                        readOnly
                        checked={checked}
                        className="h-4 w-4 shrink-0 rounded border-gray-300"
                      />
                      <span className="truncate">{display(v.value)}</span>
                    </span>
                    {!isYear && v.count > 0 && (
                      <span className="shrink-0 text-xs text-gray-400">{v.count}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-gray-100 p-2">
            {activeCount > 0 ? (
              <button type="button" onClick={clear} className="text-xs text-gray-500 hover:text-red-600">
                ล้างตัวเลือก
              </button>
            ) : (
              <span />
            )}
            {hasMore && !loading && (
              <button
                type="button"
                onClick={() => fetchPage(page + 1, search, true)}
                disabled={loadingMore}
                className="text-xs font-medium text-[var(--primary)] hover:opacity-80 disabled:opacity-50"
              >
                {loadingMore ? "กำลังโหลด..." : "โหลดเพิ่มเติม"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
