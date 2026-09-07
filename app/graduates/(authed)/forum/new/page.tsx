"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

const BODY_MAX = 10000;
const TITLE_MAX = 200;

export default function NewTopicPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const t = title.trim();
    const b = body.trim();
    if (!t) return setError("กรุณากรอกหัวข้อ");
    if (!b) return setError("กรุณากรอกเนื้อหา");
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiFetch<{ id: string }>("/api/forum/topics", {
        method: "POST",
        json: { title: t, body: b },
      });
      router.push(`/graduates/forum/${created.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/graduates/forum" className="text-sm text-[var(--muted)] hover:text-[var(--primary)]">
          ← กลับสู่กระดานสนทนา
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--primary)]" data-tour="forum-new-heading">ตั้งกระทู้ใหม่</h1>
      </div>

      <div className="space-y-5 rounded-lg bg-white p-6 shadow-sm">
        <div data-tour="forum-new-title">
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
            หัวข้อ <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={TITLE_MAX}
            className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
            placeholder="หัวข้อของกระทู้"
          />
          <p className="mt-1 text-right text-xs text-[var(--muted)]">{title.length}/{TITLE_MAX}</p>
        </div>

        <div data-tour="forum-new-body">
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
            เนื้อหา <span className="text-red-500">*</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={BODY_MAX}
            rows={12}
            className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
            placeholder="แบ่งปันความรู้ ประสบการณ์ หรือเริ่มการสนทนา…"
          />
          <p className="mt-1 text-right text-xs text-[var(--muted)]">{body.length.toLocaleString()}/{BODY_MAX.toLocaleString()}</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2" data-tour="forum-new-submit">
          <Link href="/graduates/forum">
            <Button variant="outline" disabled={submitting}>ยกเลิก</Button>
          </Link>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "กำลังโพสต์..." : "โพสต์กระทู้"}
          </Button>
        </div>
      </div>
    </div>
  );
}
