"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CONTENT_REPORT_REASON_VALUES,
  FORUM_REPORT_REASON_LABELS,
} from "@/lib/validations";

/**
 * Report-a-post dialog. Reusable for a topic or a reply — pass the
 * `resourceType` + `resourceId`. The server rejects self-reports (400) and
 * duplicate reports (upsert re-opens). Plain inline feedback (no toast — the
 * project mounts no Toaster).
 */
export default function ReportDialog({
  resourceType,
  resourceId,
  open,
  onOpenChange,
}: {
  resourceType: "FORUM_TOPIC" | "FORUM_REPLY";
  resourceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function reset() {
    setReason("");
    setDetail("");
    setError(null);
    setDone(false);
  }

  async function submit() {
    if (!reason) {
      setError("กรุณาเลือกเหตุผลในการรายงาน");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/forum/reports", {
        method: "POST",
        json: {
          resourceType,
          resourceId,
          reason,
          reasonDetail: detail.trim() || undefined,
        },
      });
      setDone(true);
      // Close shortly after the success message so the user sees confirmation.
      setTimeout(() => {
        onOpenChange(false);
        reset();
      }, 1200);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>รายงานเนื้อหา</DialogTitle>
          <DialogDescription>
            รายงานเนื้อหาที่ไม่เหมาะสมให้ผู้ดูแลพิจารณา
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <p className="py-4 text-center text-sm text-green-600">
            ส่งการรายงานเรียบร้อยแล้ว ขอบคุณที่ช่วยกันดูแลชุมชน
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
                เหตุผลในการรายงาน <span className="text-red-500">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
              >
                <option value="">— เลือกเหตุผล —</option>
                {CONTENT_REPORT_REASON_VALUES.map((r) => (
                  <option key={r} value={r}>
                    {FORUM_REPORT_REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
                รายละเอียดเพิ่มเติม <span className="text-[var(--muted)]">(ไม่บังคับ)</span>
              </label>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
                placeholder="อธิบายเพิ่มเติมเกี่ยวกับเนื้อหาที่รายงาน"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        {!done && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              ยกเลิก
            </Button>
            <Button onClick={submit} disabled={submitting || !reason}>
              {submitting ? "กำลังส่ง..." : "ส่งการรายงาน"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
