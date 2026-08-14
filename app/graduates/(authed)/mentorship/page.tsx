"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch, ApiError } from "@/lib/api-client";
import SearchInput from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import PhotoAvatar from "@/components/forum/PhotoAvatar";
import { MENTORSHIP_STATUS_LABELS } from "@/lib/validations";
import type { AlumniPublicIdentity } from "@/lib/forum-identity";

/**
 * Light mentorship (community V2): browse mentors → send a request → mentor
 * accepts/declines → the ACCEPT payload reveals the mentor's contact info.
 * Tabs: หาพี่เลี้ยง / คำขอของฉัน / เป็นพี่เลี้ยง.
 */

interface MentorItem {
  id: string;
  alumniId: string;
  expertise: string;
  capacity: number;
  accepting: boolean;
  openRequests: number;
  isMe: boolean;
  alumni: AlumniPublicIdentity & {
    communityProfile: { currentWorkplace: string | null; currentPosition: string | null; province: string | null } | null;
  };
}
interface RequestItem {
  id: string;
  mentorId: string;
  menteeId: string;
  message: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  createdAt: string;
  direction: "sent" | "received";
  mentor: AlumniPublicIdentity;
  mentee: AlumniPublicIdentity;
}

const inputClass = "w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm";

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-green-100 text-green-700",
  DECLINED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export default function MentorshipPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"find" | "requests" | "mentor">("find");
  const [search, setSearch] = useState("");
  const [requestTo, setRequestTo] = useState<MentorItem | null>(null);
  const [message, setMessage] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [contact, setContact] = useState<{ contactEmail: string | null; phones: string[] } | null>(null);
  const [mentorForm, setMentorForm] = useState<{ expertise: string; capacity: number; accepting: boolean } | null>(null);
  const [mentorError, setMentorError] = useState<string | null>(null);

  const { data: membership, isPending: membershipLoading } = useQuery({
    queryKey: queryKeys.forum.membership(),
    queryFn: () => apiFetch<{ optedIn: boolean }>("/api/alumni-profile/community-membership"),
  });
  const optedIn = membership?.optedIn ?? false;

  const mentorsQ = useQuery({
    queryKey: queryKeys.mentorship.mentors({ search }),
    queryFn: () => {
      const params = new URLSearchParams({ all: "true", pageSize: "60" });
      if (search) params.set("search", search);
      return apiFetch<{ data: MentorItem[] }>(`/api/mentors?${params}`);
    },
    enabled: optedIn,
  });
  const mentors = mentorsQ.data?.data ?? [];

  const myProfileQ = useQuery({
    queryKey: queryKeys.mentorship.myProfile(),
    queryFn: () => apiFetch<{ profile: { expertise: string; capacity: number; accepting: boolean } | null }>("/api/mentors?me=true"),
    enabled: optedIn,
  });

  const requestsQ = useQuery({
    queryKey: queryKeys.mentorship.requests(),
    queryFn: () => apiFetch<{ data: RequestItem[] }>("/api/mentorship-requests"),
    enabled: optedIn,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.mentorship.all });
  };

  const sendRequest = useMutation({
    mutationFn: () =>
      apiFetch("/api/mentorship-requests", { method: "POST", json: { mentorId: requestTo!.alumniId, message: message.trim() } }),
    onSuccess: () => {
      setRequestTo(null);
      setMessage("");
      setRequestError(null);
      invalidate();
    },
    onError: (e) => setRequestError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาดในการส่งคำขอ"),
  });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "decline" | "cancel" }) => {
      setContact(null);
      return apiFetch<{ request: RequestItem; mentorContact?: { contactEmail: string | null; phones: string[] } }>(
        `/api/mentorship-requests/${id}`,
        { method: "POST", json: { action } },
      );
    },
    onSuccess: (res, vars) => {
      if (vars.action === "accept" && res.mentorContact) setContact(res.mentorContact);
      invalidate();
    },
    onError: (e) => setRequestError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });

  const saveMentor = useMutation({
    mutationFn: () => apiFetch("/api/mentors", { method: "PUT", json: mentorForm }),
    onSuccess: () => {
      setMentorForm(null);
      setMentorError(null);
      invalidate();
    },
    onError: (e) => setMentorError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาดในการบันทึก"),
  });

  // --- Join card (not opted in) ---
  if (!membershipLoading && !optedIn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-xl bg-white p-8 shadow-sm">
          <h1 className="mb-3 text-2xl font-bold text-[var(--primary)]">ระบบพี่เลี้ยง</h1>
          <p className="mb-6 text-sm leading-relaxed text-[var(--muted)]">
            ระบบพี่เลี้ยงเชื่อมศิษย์เก่าที่มีประสบการณ์กับศิษย์เก่าที่กำลังมองหาคำแนะนำ
            กรุณาเข้าร่วมชุมชนก่อนใช้งาน
          </p>
          <Link href="/graduates/forum"><Button>เข้าร่วมชุมชน</Button></Link>
        </div>
      </div>
    );
  }

  if (membershipLoading) {
    return (
      <div className="flex justify-center py-16"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" /></div>
    );
  }

  const myProfile = myProfileQ.data?.profile ?? null;
  const requests = requestsQ.data?.data ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-[var(--primary)] sm:text-3xl">ระบบพี่เลี้ยง</h1>

      {/* Contact reveal (accept response) */}
      {contact && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
          <p className="mb-1 font-semibold text-green-700">ติดต่อพี่เลี้ยงได้ที่</p>
          <p>อีเมล: {contact.contactEmail ?? "—"}</p>
          {contact.phones.length > 0 && <p>โทร: {contact.phones.join(", ")}</p>}
          <button className="mt-2 text-xs text-[var(--muted)] hover:underline" onClick={() => setContact(null)}>ปิด</button>
        </div>
      )}
      {requestError && tab !== "find" && <p className="mb-4 text-sm text-red-600">{requestError}</p>}

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-[var(--border)]">
        {([["find", "หาพี่เลี้ยง"], ["requests", `คำขอของฉัน (${requests.filter((r) => r.status === "PENDING").length})`], ["mentor", "เป็นพี่เลี้ยง"]] as const).map(
          ([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === key ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
              {label}
            </button>
          ),
        )}
      </div>

      {tab === "find" && (
        <div>
          <div className="mb-5">
            <SearchInput value={search} onSearch={setSearch} placeholder="ค้นหาข้อเชี่ยวชาญหรือชื่อพี่เลี้ยง..." formClassName="w-full" />
          </div>
          {mentorsQ.isPending ? (
            <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" /></div>
          ) : mentors.length === 0 ? (
            <div className="rounded-lg bg-white py-12 text-center shadow-sm"><p className="text-sm text-[var(--muted)]">ยังไม่มีพี่เลี้ยงอาสา — เป็นคนแรกได้เลยในแท็บ “เป็นพี่เลี้ยง”</p></div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {mentors.map((m) => (
                <div key={m.id} className={`rounded-lg bg-white p-4 shadow-sm ${!m.accepting ? "opacity-60" : ""}`}>
                  <PhotoAvatar identity={m.alumni} size="sm" />
                  <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
                    🎓 ข้อเชี่ยวชาญ: {m.expertise}
                  </p>
                  {m.alumni.communityProfile?.currentWorkplace && (
                    <p className="mt-1 text-xs text-[var(--muted)]">💼 {m.alumni.communityProfile.currentWorkplace}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
                    <span className="text-xs text-[var(--muted)]">
                      {m.accepting ? `รับได้ ${m.capacity} คน (กำลังร้องขอ ${m.openRequests})` : "พักรับคำขอ"}
                    </span>
                    {!m.isMe && (
                      <Button variant="outline" className="h-8 px-3 text-xs" disabled={!m.accepting} onClick={() => { setRequestTo(m); setMessage(""); setRequestError(null); }}>
                        ขอคำปรึกษา
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "requests" && (
        <div className="space-y-3">
          {requestsQ.isPending ? (
            <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" /></div>
          ) : requests.length === 0 ? (
            <div className="rounded-lg bg-white py-12 text-center shadow-sm"><p className="text-sm text-[var(--muted)]">ยังไม่มีคำขอ</p></div>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="rounded-lg bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium">
                      {r.direction === "sent" ? "ถึง" : "จาก"}{" "}
                      {r.direction === "sent" ? `${r.mentor.prefix}${r.mentor.firstName} ${r.mentor.lastName}` : `${r.mentee.prefix}${r.mentee.firstName} ${r.mentee.lastName}`}
                    </p>
                    <p className="text-xs text-[var(--muted)]">{r.direction === "sent" ? "คำขอที่ฉันส่ง" : "คำขอที่ฉันได้รับ"}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${STATUS_BADGE[r.status]}`}>
                    {MENTORSHIP_STATUS_LABELS[r.status]}
                  </span>
                </div>
                <p className="whitespace-pre-line rounded-md bg-gray-50 p-3 text-sm">{r.message}</p>
                {r.status === "PENDING" && (
                  <div className="mt-3 flex justify-end gap-2">
                    {r.direction === "sent" ? (
                  <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => act.mutate({ id: r.id, action: "cancel" })} disabled={act.isPending}>
                    ยกเลิกคำขอ
                  </Button>
                    ) : (
                      <>
                        <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => act.mutate({ id: r.id, action: "decline" })} disabled={act.isPending}>ปฏิเสธ</Button>
                        <Button className="h-8 px-3 text-xs" onClick={() => act.mutate({ id: r.id, action: "accept" })} disabled={act.isPending}>ตอบรับ</Button>
                      </>
                    )}
                  </div>
                )}
                {r.status === "ACCEPTED" && r.direction === "sent" && (
                  <p className="mt-2 text-xs text-green-700">พี่เลี้ยงตอบรับแล้ว — ข้อมูลติดต่อแสดงในกล่องสีเขียวด้านบน</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "mentor" && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-semibold text-[var(--foreground)]">โปรไฟล์พี่เลี้ยงของฉัน</h2>
          <p className="mb-4 text-sm text-[var(--muted)]">
            อาสาเป็นพี่เลี้ยงให้ศิษย์เก่าท่านอื่น — เมื่อตอบรับคำขอ ข้อมูลติดต่อของท่าน (อีเมลติดต่อ/เบอร์โทร) จะแสดงต่อผู้ขอเท่านั้น
          </p>
          {mentorForm ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">ข้อเชี่ยวชาญที่ให้คำปรึกษา *</label>
                <input value={mentorForm.expertise} onChange={(e) => setMentorForm({ ...mentorForm, expertise: e.target.value })} maxLength={200} placeholder="เช่น การพยาบาลผู้สูงอายุ, การบริหารการพยาบาล" className={inputClass} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">จำนวนที่รับ (1–10)</label>
                  <input type="number" min={1} max={10} value={mentorForm.capacity} onChange={(e) => setMentorForm({ ...mentorForm, capacity: Number(e.target.value) })} className={inputClass} />
                </div>
                <label className="flex items-center gap-2 pt-6 text-sm">
                  <input type="checkbox" checked={mentorForm.accepting} onChange={(e) => setMentorForm({ ...mentorForm, accepting: e.target.checked })} />
                  เปิดรับคำขอ
                </label>
              </div>
              {mentorError && <p className="text-sm text-red-600">{mentorError}</p>}
              <div className="flex gap-2">
                <Button onClick={() => saveMentor.mutate()} disabled={saveMentor.isPending || mentorForm.expertise.trim().length < 1}>
                  {saveMentor.isPending ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
                <Button variant="outline" onClick={() => setMentorForm(null)} disabled={saveMentor.isPending}>ยกเลิก</Button>
              </div>
            </div>
          ) : myProfile ? (
            <div>
              <p className="text-sm"><span className="text-[var(--muted)]">ข้อเชี่ยวชาญ:</span> {myProfile.expertise}</p>
              <p className="mt-1 text-sm"><span className="text-[var(--muted)]">จำนวนที่รับ:</span> {myProfile.capacity} คน</p>
              <p className="mt-1 text-sm">
                <span className="text-[var(--muted)]">สถานะ:</span>{" "}
                {myProfile.accepting ? "🟢 เปิดรับคำขอ" : "⏸️ พักรับคำขอ"}
              </p>
              <Button variant="outline" className="mt-4" onClick={() => setMentorForm({ expertise: myProfile.expertise, capacity: myProfile.capacity, accepting: myProfile.accepting })}>
                แก้ไข
              </Button>
            </div>
          ) : (
            <Button onClick={() => setMentorForm({ expertise: "", capacity: 1, accepting: true })}>อาสาเป็นพี่เลี้ยง</Button>
          )}
        </div>
      )}

      {/* Request dialog */}
      {requestTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-lg font-semibold">ขอคำปรึกษา</h3>
            <p className="mb-3 text-sm text-[var(--muted)]">
              ถึง {requestTo.alumni.prefix}{requestTo.alumni.firstName} {requestTo.alumni.lastName} ({requestTo.expertise})
            </p>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={2000}
              placeholder="แนะนำตัวและบอกสิ่งที่อยากปรึกษา..." className={inputClass} />
            {requestError && <p className="mt-2 text-sm text-red-600">{requestError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRequestTo(null)} disabled={sendRequest.isPending}>ยกเลิก</Button>
              <Button onClick={() => sendRequest.mutate()} disabled={sendRequest.isPending || message.trim().length < 1}>
                {sendRequest.isPending ? "กำลังส่ง..." : "ส่งคำขอ"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
