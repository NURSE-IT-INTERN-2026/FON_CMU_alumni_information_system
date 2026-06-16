// Thin pass-through layout for the /graduates segment.
//
// Public self-service pages (signup, forgot-password, reset-password) live
// directly under /graduates and are served by this layout — no auth, no shell.
//
// Authenticated alumni pages (profile, news) live under the (authed) route
// group, whose own layout enforces the alumni session and renders the
// header + sidebar + footer shell.

export default async function GraduatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <main className="flex-1">{children}</main>
    </div>
  );
}
