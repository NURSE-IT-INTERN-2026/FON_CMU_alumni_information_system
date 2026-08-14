"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import PhotoAvatar from "@/components/forum/PhotoAvatar";
import ForumBody from "@/components/forum/ForumBody";
import { assetUrl } from "@/lib/asset-url";
import { DEGREE_LEVEL_OPTIONS } from "@/lib/constants";
import type { AlumniDirectoryIdentity } from "@/lib/forum-identity";

/**
 * Public community-profile view of one directory member. Shows only what the
 * member chose to publish (identity + their CommunityProfile); an opted-out
 * or unknown id renders the "ไม่พบ" state (the API 404s).
 */
export default function DirectoryMemberPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.community.directoryDetail(id),
    queryFn: () => apiFetch<{ alumni: AlumniDirectoryIdentity }>(`/api/directory/${id}`),
    retry: false,
  });

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (isError || !data?.alumni) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <h1 className="mb-3 text-xl font-bold text-[var(--primary)]">ไม่พบสมาชิก</h1>
          <p className="mb-6 text-sm text-[var(--muted)]">
            สมาชิกท่านนี้ไม่อยู่ในไดเรกทอรีศิษย์เก่าอีกต่อไป (อาจยกเลิกการเข้าร่วมแล้ว)
          </p>
          <Link href="/graduates/directory">
            <Button variant="outline">กลับไดเรกทอรีศิษย์เก่า</Button>
          </Link>
        </div>
      </div>
    );
  }

  const a = data.alumni;
  const p = a.communityProfile;
  const photoUrl = p?.photoUrl ?? a.photoUrl;
  const degreeLabel = DEGREE_LEVEL_OPTIONS.find((o) => o.value === a.degreeLevel)?.label ?? a.degreeLevel;

  const contactRows: { label: string; value: string | null; href?: string }[] = [
    { label: "อีเมล", value: p?.contactEmail ?? null, href: p?.contactEmail ? `mailto:${p.contactEmail}` : undefined },
    { label: "Facebook", value: p?.facebookUrl ?? null, href: p?.facebookUrl ?? undefined },
    { label: "LINE ID", value: p?.lineId ?? null },
    { label: "LinkedIn", value: p?.linkedinUrl ?? null, href: p?.linkedinUrl ?? undefined },
    { label: "เว็บไซต์อื่น ๆ", value: p?.otherLink ?? null, href: p?.otherLink ?? undefined },
  ];
  const hasContact = contactRows.some((r) => r.value);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/graduates/directory" className="mb-4 inline-block text-sm text-[var(--primary)] hover:underline">
        ← ไดเรกทอรีศิษย์เก่า
      </Link>

      <div className="rounded-xl bg-white p-6 shadow-sm sm:p-8">
        {/* Identity header */}
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assetUrl(photoUrl)}
              alt={`${a.prefix}${a.firstName} ${a.lastName}`}
              className="h-24 w-24 shrink-0 rounded-full border-4 border-[var(--primary)]/10 object-cover"
            />
          ) : (
            <PhotoAvatar identity={a} size="md" />
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[var(--primary)]">
              {a.prefix}{a.firstName} {a.lastName}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {[a.cohort && `รุ่น ${a.cohort}`, degreeLabel, a.graduationYear ? `สำเร็จการศึกษา พ.ศ. ${a.graduationYear + 543}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        {/* Work + location */}
        {(p?.currentWorkplace || p?.currentPosition || p?.province || p?.country) && (
          <div className="mt-6 grid grid-cols-1 gap-3 rounded-lg bg-[var(--background)] p-4 text-sm sm:grid-cols-2">
            {p?.currentWorkplace && (
              <p><span className="text-[var(--muted)]">สถานที่ทำงานปัจจุบัน:</span> {p.currentWorkplace}</p>
            )}
            {p?.currentPosition && (
              <p><span className="text-[var(--muted)]">ตำแหน่ง:</span> {p.currentPosition}</p>
            )}
            {(p?.province || p?.country) && (
              <p>
                <span className="text-[var(--muted)]">พื้นที่:</span>{" "}
                {[p?.province, p?.country].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        )}

        {/* Bio */}
        {p?.bio && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-[var(--foreground)]">แนะนำตัว</h2>
            <ForumBody text={p.bio} />
          </div>
        )}

        {/* Published contact */}
        {hasContact && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-[var(--foreground)]">ข้อมูลติดต่อที่เผยแพร่</h2>
            <div className="space-y-1.5 text-sm">
              {contactRows
                .filter((r) => r.value)
                .map((r) => (
                  <p key={r.label}>
                    <span className="text-[var(--muted)]">{r.label}:</span>{" "}
                    {r.href ? (
                      <a
                        href={r.href}
                        target={r.href.startsWith("mailto:") ? undefined : "_blank"}
                        rel="noreferrer"
                        className="break-all text-[var(--primary)] hover:underline"
                      >
                        {r.value}
                      </a>
                    ) : (
                      <span className="break-all">{r.value}</span>
                    )}
                  </p>
                ))}
            </div>
          </div>
        )}

        {!p && (
          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            สมาชิกท่านนี้ยังไม่ได้กรอกข้อมูลโปรไฟล์ชุมชน
          </p>
        )}
      </div>
    </div>
  );
}
