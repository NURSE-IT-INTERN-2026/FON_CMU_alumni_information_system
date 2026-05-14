"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

interface AbroadAlumni {
  id: string;
  name: string;
  address: string | null;
  country: string;
  university: string | null;
  order: number;
}

interface ApiResponse {
  data: AbroadAlumni[];
  countries: string[];
}

export default function AbroadAlumniPage() {
  const [alumni, setAlumni] = useState<AbroadAlumni[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [pageByGroup, setPageByGroup] = useState<Record<string, number>>({});
  const perGroupPage = 10;

  const toggle = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));

  const pageFor = (label: string) => pageByGroup[label] ?? 1;
  const setPageFor = (label: string, p: number) =>
    setPageByGroup((prev) => ({ ...prev, [label]: p }));

  const fetchAlumni = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, country: countryFilter });
      const res = await fetch(`/api/abroad-alumni?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ApiResponse = await res.json();
      setAlumni(data.data);
      if (data.countries.length > 0 && countries.length === 0) {
        setCountries(data.countries);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, countryFilter, countries.length]);

  useEffect(() => {
    fetchAlumni();
  }, [fetchAlumni]);

  const grouped = useMemo(() => {
    const groups: { label: string; isUniversity: boolean; items: AbroadAlumni[] }[] = [];

    // Group by country first
    const byCountry = new Map<string, AbroadAlumni[]>();
    for (const a of alumni) {
      const list = byCountry.get(a.country) || [];
      list.push(a);
      byCountry.set(a.country, list);
    }

    for (const [country, items] of byCountry) {
      const withUni = items.filter((a) => a.university);
      const withoutUni = items.filter((a) => !a.university);

      if (withoutUni.length > 0) {
        groups.push({ label: country, isUniversity: false, items: withoutUni });
      }

      if (withUni.length > 0) {
        const byUni = new Map<string, AbroadAlumni[]>();
        for (const a of withUni) {
          const list = byUni.get(a.university!) || [];
          list.push(a);
          byUni.set(a.university!, list);
        }
        for (const [uni, uniItems] of byUni) {
          groups.push({ label: uni, isUniversity: true, items: uniItems });
        }
      }
    }

    return groups;
  }, [alumni]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-center text-2xl font-bold text-[var(--primary)] sm:text-3xl">
        ข้อมูลการทำงานต่างประเทศ
      </h1>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="ค้นหาชื่อ สถาบัน หรือประเทศ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
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
            const page = pageFor(group.label);
            const totalPages = Math.ceil(group.items.length / perGroupPage);
            const paged = group.items.slice((page - 1) * perGroupPage, page * perGroupPage);

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
                          <tr className="border-b border-[var(--border)] bg-gray-50">
                            <th className="w-16 px-4 py-3 text-center font-semibold text-[var(--primary)]">
                              ที่
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-[var(--primary)]">
                              ชื่อ - นามสกุล
                            </th>
                            {!group.isUniversity && (
                              <th className="px-4 py-3 text-left font-semibold text-[var(--primary)]">
                                ที่อยู่
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {paged.map((a, idx) => (
                            <tr
                              key={a.id}
                              className="border-b border-[var(--border)] transition-colors hover:bg-gray-50"
                            >
                              <td className="px-4 py-3 text-center">
                                {(page - 1) * perGroupPage + idx + 1}
                              </td>
                              <td className="px-4 py-3">{a.name}</td>
                              {!group.isUniversity && (
                                <td className="px-4 py-3 text-[var(--muted)]">
                                  {a.address || "-"}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-1.5 border-t border-[var(--border)] px-4 py-3">
                        <button
                          onClick={() => setPageFor(group.label, Math.max(1, page - 1))}
                          disabled={page === 1}
                          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
                        >
                          ก่อนหน้า
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            onClick={() => setPageFor(group.label, p)}
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
                          onClick={() => setPageFor(group.label, Math.min(totalPages, page + 1))}
                          disabled={page === totalPages}
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
