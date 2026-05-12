"use client";

import { useEffect, useState, useCallback } from "react";
import { PAGE_SIZE } from "@/lib/constants";

interface AssociationMember {
  id: string;
  associationName: string;
  position: string;
  termYear: number;
  alumni: {
    firstName: string;
    lastName: string;
  };
}

interface ApiResponse {
  data: AssociationMember[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function AssociationsPage() {
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        search,
      });
      const res = await fetch(`/api/associations?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ApiResponse = await res.json();
      setMembers(data.data);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const groupedMembers = members.reduce<Record<string, AssociationMember[]>>(
    (acc, member) => {
      if (!acc[member.associationName]) {
        acc[member.associationName] = [];
      }
      acc[member.associationName].push(member);
      return acc;
    },
    {}
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-center text-2xl font-bold text-[var(--primary)] sm:text-3xl">
        สมาคม/ชมรมศิษย์เก่า
      </h1>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="ค้นหาชื่อสมาคม ชมรม หรือสมาชิก..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] sm:max-w-md"
        />
      </div>

      {/* Grouped Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm">
          <p className="text-[var(--muted)]">ไม่พบข้อมูล</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedMembers).map(([name, groupMembers]) => (
            <div
              key={name}
              className="overflow-hidden rounded-lg bg-white shadow-sm"
            >
              <div className="border-b border-[var(--border)] bg-[var(--primary)] px-5 py-3">
                <h3 className="text-base font-semibold text-white">{name}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-gray-50">
                      <th className="px-4 py-2.5 text-left font-semibold text-[var(--primary)]">
                        ชื่อ-นามสกุล
                      </th>
                      <th className="px-4 py-2.5 text-left font-semibold text-[var(--primary)]">
                        ตำแหน่ง
                      </th>
                      <th className="px-4 py-2.5 text-left font-semibold text-[var(--primary)]">
                        ปี
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupMembers.map((member) => (
                      <tr
                        key={member.id}
                        className="border-b border-[var(--border)] transition-colors last:border-b-0 hover:bg-gray-50"
                      >
                        <td className="px-4 py-2.5">
                          {member.alumni.firstName} {member.alumni.lastName}
                        </td>
                        <td className="px-4 py-2.5">{member.position}</td>
                        <td className="px-4 py-2.5">{member.termYear + 543}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
