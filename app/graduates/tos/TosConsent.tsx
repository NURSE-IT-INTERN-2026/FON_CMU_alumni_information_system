"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BASE_PATH } from "@/lib/constants";

/**
 * Buttons for the Terms-of-Service page.
 * - Accept → POST /api/alumni-auth/accept-tos, then go to the profile.
 * - Decline → log out (the GET logout route clears the session and redirects
 *   to /login). Navigating to it directly is cleaner than a client fetch,
 *   since the route responds with a redirect, not JSON.
 */
export default function TosConsent() {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  async function handleAccept() {
    setAccepting(true);
    setError("");
    try {
      const res = await fetch(`${BASE_PATH}/api/alumni-auth/accept-tos`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง");
        setAccepting(false);
        return;
      }
      router.push("/graduates/profile");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองอีกครั้ง");
      setAccepting(false);
    }
  }

  function handleDecline() {
    // GET logout deletes the session, clears the cookie, and redirects to /login.
    window.location.href = `${BASE_PATH}/api/alumni-auth/logout`;
  }

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="rounded-lg bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {accepting ? "กำลังบันทึก..." : "ยอมรับ"}
        </button>
        <button
          onClick={handleDecline}
          disabled={accepting}
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          ปฏิเสธ / ออกจากระบบ
        </button>
      </div>
      <p className="text-xs text-[var(--muted)]">
        * หากไม่ยอมรับข้อตกลงฯ ท่านจะไม่สามารถใช้งานระบบได้
      </p>
    </div>
  );
}
