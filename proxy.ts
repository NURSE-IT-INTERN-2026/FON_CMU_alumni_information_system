import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "fon-cmu-session";

export function proxy(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE);

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon\\.ico|robots\\.txt|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp)).*)",
  ],
};
