// Login is otherwise a static ("use client") page. Force dynamic rendering so
// proxy.ts's nonce-based CSP injects a nonce into Next.js's inline scripts
// (nonce auto-injection only happens on dynamically rendered pages).
export const dynamic = "force-dynamic";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
