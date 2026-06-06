"use client";

export default function PendingApprovalPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-10 w-10 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-[var(--foreground)]">
          รอการอนุมัติจากผู้ดูแลระบบ
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          บัญชีของท่านอยู่ระหว่างการตรวจสอบโดยผู้ดูแลระบบ
          ท่านจะสามารถเข้าถึงและแก้ไขข้อมูลส่วนตัวได้หลังจากได้รับการอนุมัติแล้ว
        </p>
        <div className="mt-6">
          <a
            href="/api/alumni-auth/logout"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
            ออกจากระบบ
          </a>
        </div>
      </div>
    </div>
  );
}
