"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { AWARD_TYPE_LABELS, PAGE_SIZE } from "@/lib/constants";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Award {
  id: string;
  awardName: string;
  awardType: string;
  year: number;
  description: string | null;
  alumni: {
    firstName: string;
    lastName: string;
  };
}

interface ApiResponse {
  data: Award[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const AWARD_COLORS: Record<string, string> = {
  INTERNATIONAL: "#1e3a5f",
  NATIONAL: "#e8a838",
  LOCAL: "#38a169",
};

type SortField = "name" | "award" | "type" | "year";
type SortDir = "asc" | "desc";

export default function AwardsPage() {
  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [awardTypeFilter, setAwardTypeFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("year");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});

  const fetchAwards = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        search,
        awardType: awardTypeFilter,
      });
      const res = await fetch(`/api/awards?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ApiResponse = await res.json();
      setAwards(data.data);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, awardTypeFilter]);

  const fetchTypeCounts = useCallback(async () => {
    try {
      const [international, national, local] = await Promise.all([
        fetch("/api/awards?pageSize=1&awardType=INTERNATIONAL").then((r) => r.json()),
        fetch("/api/awards?pageSize=1&awardType=NATIONAL").then((r) => r.json()),
        fetch("/api/awards?pageSize=1&awardType=LOCAL").then((r) => r.json()),
      ]);
      setTypeCounts({
        INTERNATIONAL: international.total,
        NATIONAL: national.total,
        LOCAL: local.total,
      });
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchTypeCounts();
  }, [fetchTypeCounts]);

  useEffect(() => {
    fetchAwards();
  }, [fetchAwards]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleFilter = (value: string) => {
    setAwardTypeFilter(value);
    setPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortedAwards = [...awards].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "name":
        cmp = `${a.alumni.firstName} ${a.alumni.lastName}`.localeCompare(
          `${b.alumni.firstName} ${b.alumni.lastName}`
        );
        break;
      case "award":
        cmp = a.awardName.localeCompare(b.awardName);
        break;
      case "type":
        cmp = a.awardType.localeCompare(b.awardType);
        break;
      case "year":
        cmp = a.year - b.year;
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="ml-1 inline-block">
      {sortField === field ? (sortDir === "asc" ? "▲" : "▼") : "▽"}
    </span>
  );

  const chartData = {
    labels: Object.keys(typeCounts).map((k) => AWARD_TYPE_LABELS[k] || k),
    datasets: [
      {
        data: Object.values(typeCounts),
        backgroundColor: Object.keys(typeCounts).map((k) => AWARD_COLORS[k] || "#999"),
        borderWidth: 2,
        borderColor: "#ffffff",
      },
    ],
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-center text-2xl font-bold text-[var(--primary)] sm:text-3xl">
        รางวัลที่ได้รับ
      </h1>

      {/* Doughnut Chart */}
      {Object.keys(typeCounts).length > 0 && (
        <div className="mb-8 flex justify-center">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-sm">
            <Doughnut
              data={chartData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: {
                      padding: 16,
                      font: { size: 13 },
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="ค้นหาชื่อหรือรางวัล..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />
        <select
          value={awardTypeFilter}
          onChange={(e) => handleFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        >
          <option value="">ทุกประเภท</option>
          {Object.entries(AWARD_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
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
                <th
                  className="cursor-pointer px-4 py-3 text-left font-semibold text-[var(--primary)]"
                  onClick={() => handleSort("name")}
                >
                  ชื่อ-นามสกุล <SortIcon field="name" />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left font-semibold text-[var(--primary)]"
                  onClick={() => handleSort("award")}
                >
                  ชื่อรางวัล <SortIcon field="award" />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left font-semibold text-[var(--primary)]"
                  onClick={() => handleSort("type")}
                >
                  ประเภท <SortIcon field="type" />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left font-semibold text-[var(--primary)]"
                  onClick={() => handleSort("year")}
                >
                  ปี <SortIcon field="year" />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--primary)]">
                  รายละเอียด
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
              ) : sortedAwards.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[var(--muted)]">
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                sortedAwards.map((award) => (
                  <tr
                    key={award.id}
                    className="border-b border-[var(--border)] transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      {award.alumni.firstName} {award.alumni.lastName}
                    </td>
                    <td className="px-4 py-3">{award.awardName}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block rounded-full px-3 py-1 text-xs font-medium text-white"
                        style={{
                          backgroundColor:
                            AWARD_COLORS[award.awardType] || "#999",
                        }}
                      >
                        {AWARD_TYPE_LABELS[award.awardType] || award.awardType}
                      </span>
                    </td>
                    <td className="px-4 py-3">{award.year + 543}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-[var(--muted)]">
                      {award.description || "-"}
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
