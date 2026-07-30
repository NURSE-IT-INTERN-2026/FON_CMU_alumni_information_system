// Thin pass-through layout for the /graduates segment.
//
// Public self-service pages (signup, forgot-password, reset-password) live
// directly under /graduates and are served by this layout — no auth, no shell.
//
// Authenticated alumni pages (profile, news) live under the (authed) route
// group, whose own layout enforces the alumni session and renders the
// header + sidebar + footer shell.

// Force dynamic rendering so proxy.ts's nonce-based CSP injects a nonce into
// Next.js's inline scripts. Nonce auto-injection only happens on dynamically
// rendered pages; without this the public /graduates pages would be statically
// prerendered (no nonce) and the CSP would block their inline scripts.
export const dynamic = "force-dynamic";

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
