/**
 * Profile section heading — a purple left bar + purple-dark title + short gold
 * underline. Replaces the old plain gray `<h3 className="text-[var(--muted)]">`
 * on the alumni profile pages (admin `/management/alumni/[id]` + self `/graduates/profile`)
 * so sections read as brand purple & gold instead of a wall of gray.
 *
 * Presentational only — no `"use client"` (imported by client profile pages, where it
 * becomes part of the client bundle).
 */
export function SectionHeading({
  title,
  className = "",
}: {
  title: string;
  className?: string;
}) {
  return (
    <div className={`mb-3 flex items-start gap-2 ${className}`}>
      <span className="mt-0.5 h-5 w-1 shrink-0 rounded-full bg-[var(--primary)]" />
      <div>
        <h3 className="text-sm font-semibold leading-tight text-[var(--primary-dark)]">{title}</h3>
        <span className="mt-1 block h-0.5 w-8 rounded-full bg-[var(--accent)]" />
      </div>
    </div>
  );
}
