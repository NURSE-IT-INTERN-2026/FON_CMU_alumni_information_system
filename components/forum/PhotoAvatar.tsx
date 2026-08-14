"use client";

import { assetUrl } from "@/lib/asset-url";
import { formatAlumniPublicName, type AlumniPublicIdentity } from "@/lib/forum-identity";
import { DEGREE_LEVEL_OPTIONS, DEGREE_COLORS } from "@/lib/constants";

function degreeLabel(level: string): string {
  return DEGREE_LEVEL_OPTIONS.find((o) => o.value === level)?.label ?? level;
}

/**
 * Renders an alumni's PUBLIC identity (the fields in SELECT_ALUMNI_PUBLIC_IDENTITY):
 * avatar (photoUrl via assetUrl, with initials fallback) + name + cohort/degree.
 * Never receives contact fields — the identity select structurally excludes them.
 */
export default function PhotoAvatar({
  identity,
  size = "md",
}: {
  identity: AlumniPublicIdentity;
  size?: "sm" | "md";
}) {
  const name = formatAlumniPublicName(identity);
  const initials = (identity.firstName?.[0] ?? "?") + (identity.lastName?.[0] ?? "");
  const dim = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  const color = DEGREE_COLORS[identity.degreeLevel] ?? "#5b21b6";
  const subtitle = [identity.cohort ? `รุ่น ${identity.cohort}` : null, degreeLabel(identity.degreeLevel)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center gap-2.5">
      {identity.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={assetUrl(identity.photoUrl)}
          alt={name}
          className={`${dim} shrink-0 rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${dim} flex shrink-0 items-center justify-center rounded-full font-semibold text-white`}
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--foreground)]">{name}</p>
        {subtitle && <p className="truncate text-xs text-[var(--muted)]">{subtitle}</p>}
      </div>
    </div>
  );
}
