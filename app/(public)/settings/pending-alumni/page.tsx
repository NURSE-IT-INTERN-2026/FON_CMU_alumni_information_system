"use client";

import { useEffect, useState, useCallback } from "react";
import { useCanWrite } from "@/lib/role-context";

interface PendingAlumni {
  id: string;
  studentId: string;
  prefix: string;
  firstName: string;
  maidenLastName: string;
  newLastName: string | null;
  cohort: string | null;
  degreeLevel: string;
  birthDate: string | null;
  cmuEmail: string | null;
  email: string | null;
  passwordHash: string | null;
  updatedAt: string;
}

const DEGREE_LABELS: Record<string, string> = {
  DOCTORAL: "ปริญญาเอก",
  MASTER: "ปริญญาโท",
  BACHELOR: "ปริญญาตรี",
  NURSING_ASSISTANT: "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล",
  ASSOCIATE: "อนุปริญญา",
};

export default function PendingAlumniPage() {
  const canWrite = useCanWrite();
  const [pendingList, setPendingList] = useState<PendingAlumni[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    type: "approve" | "reject";
    alumni: PendingAlumni;
  } | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch("/api/alumni-auth/pending");
      if (res.ok) {
        const data = await res.json();
        setPendingList(data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  async function handleAction(type: "approve" | "reject", alumniId: string) {
    setActionLoading(alumniId);
    try {
      const res = await fetch(`/api/alumni-auth/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumniId }),
      });

      if (res.ok) {
        setPendingList((prev) => prev.filter((a) => a.id !== alumniId));
      }
    } catch {
      // Silently fail
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear() + 543;
    return `${day}/${month}/${year}`;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          รอการอนุมัติศิษย์เก่า
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          ศิษย์เก่าที่ลงทะเบียนใหม่และรอการอนุมัติจากผู้ดูแลระบบ
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : pendingList.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-[var(--success)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-[var(--foreground)]">ไม่มีคำขอที่รอการอนุมัติ</p>
          <p className="mt-1 text-sm text-[var(--muted)]">ศิษย์เก่าทุกคนได้รับการอนุมัติแล้ว</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingList.map((alumni) => (
            <div
              key={alumni.id}
              className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">
                      {alumni.prefix}{alumni.firstName} {alumni.maidenLastName}
                      {alumni.newLastName && ` (${alumni.newLastName})`}
                    </h3>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      รอการอนุมัติ
                    </span>
                    {alumni.prefix === "-" && (
                      <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                        รอตรวจสอบข้อมูล
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                    <div>
                      <span className="text-[var(--muted)]">รหัสนักศึกษา:</span>{" "}
                      <span className="font-medium">{alumni.studentId}</span>
                    </div>
                    <div>
                      <span className="text-[var(--muted)]">รุ่น:</span>{" "}
                      <span className="font-medium">{alumni.cohort || "-"}</span>
                    </div>
                    <div>
                      <span className="text-[var(--muted)]">ระดับปริญญา:</span>{" "}
                      <span className="font-medium">{DEGREE_LABELS[alumni.degreeLevel] || alumni.degreeLevel}</span>
                    </div>
                    <div>
                      <span className="text-[var(--muted)]">วันเกิด:</span>{" "}
                      <span className="font-medium">{alumni.birthDate || "-"}</span>
                    </div>
                    <div>
                      <span className="text-[var(--muted)]">อีเมล CMU:</span>{" "}
                      <span className="font-medium">{alumni.cmuEmail || "-"}</span>
                    </div>
                    <div>
                      <span className="text-[var(--muted)]">อีเมล:</span>{" "}
                      <span className="font-medium">{alumni.email || "-"}</span>
                    </div>
                    <div>
                      <span className="text-[var(--muted)]">วิธีสมัคร:</span>{" "}
                      <span className="font-medium">
                        {alumni.cmuEmail && !alumni.passwordHash ? "CMU OAuth" : alumni.passwordHash ? "อีเมล/รหัสผ่าน" : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--muted)]">วันที่สมัคร:</span>{" "}
                      <span className="font-medium">{formatDate(alumni.updatedAt)}</span>
                    </div>
                  </div>
                </div>

                {canWrite && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setConfirmModal({ type: "approve", alumni })}
                      disabled={actionLoading === alumni.id}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--success)] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actionLoading === alumni.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                      อนุมัติ
                    </button>
                    <button
                      onClick={() => setConfirmModal({ type: "reject", alumni })}
                      disabled={actionLoading === alumni.id}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--danger)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--danger)] transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actionLoading === alumni.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--danger)] border-t-transparent" />
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      )}
                      ปฏิเสธ
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  confirmModal.type === "approve" ? "bg-green-100" : "bg-red-100"
                }`}
              >
                {confirmModal.type === "approve" ? (
                  <svg className="h-5 w-5 text-[var(--success)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-[var(--danger)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                )}
              </div>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                {confirmModal.type === "approve" ? "อนุมัติคำขอ" : "ปฏิเสธคำขอ"}
              </h3>
            </div>
            <p className="mb-6 text-sm text-[var(--muted)]">
              {confirmModal.type === "approve"
                ? `ท่านต้องการอนุมัติคำขอของ ${confirmModal.alumni.prefix}${confirmModal.alumni.firstName} ${confirmModal.alumni.maidenLastName} หรือไม่? ศิษย์เก่าจะสามารถเข้าถึงและแก้ไขข้อมูลส่วนตัวได้`
                : `ท่านต้องการปฏิเสธคำขอของ ${confirmModal.alumni.prefix}${confirmModal.alumni.firstName} ${confirmModal.alumni.maidenLastName} หรือไม่? ศิษย์เก่าจะไม่สามารถเข้าสู่ระบบได้`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => handleAction(confirmModal.type, confirmModal.alumni.id)}
                disabled={actionLoading === confirmModal.alumni.id}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  confirmModal.type === "approve"
                    ? "bg-[var(--success)] hover:opacity-90"
                    : "bg-[var(--danger)] hover:opacity-90"
                }`}
              >
                {actionLoading === confirmModal.alumni.id && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {confirmModal.type === "approve" ? "อนุมัติ" : "ปฏิเสธ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
