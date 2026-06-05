import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "fon-cmu-session";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  // Nonce-based CSP: removes unsafe-inline and unsafe-eval for scripts in production.
  // style-src keeps unsafe-inline because Tailwind CSS and sanitized news content rely on it.
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src https://www.youtube.com https://player.vimeo.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  // Auth check: redirect to login if no session cookie
  const session = request.cookies.get(SESSION_COOKIE);
  if (!session) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.headers.set("Content-Security-Policy", cspHeader);
    return response;
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", cspHeader);

  return response;
}

export const config = {
  matcher: [
    "/((?!login|intern/api/auth|intern/api/alumni-auth|api/auth|api/alumni-auth|api/alumni-profile|api/alumni-accounts|_next/static|_next/image|favicon\\.ico|robots\\.txt|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp)).*)",
  ],
};
