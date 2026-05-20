import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSession, setSessionCookie } from "@/lib/auth";
import {
  exchangeCodeForToken,
  fetchCmuProfile,
  clearOAuthCookies,
} from "@/lib/oauth";

function loginRedirect(error: string) {
  return NextResponse.redirect(
    new URL(`/login?error=${error}`, process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000")
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // OAuth provider error (e.g. user denied)
    if (error) {
      return loginRedirect("oauth_denied");
    }

    // Validate state for CSRF protection
    const cookieState = request.cookies.get("cmu-oauth-state")?.value;
    if (!state || state !== cookieState) {
      return loginRedirect("oauth_invalid_state");
    }

    // Retrieve PKCE code verifier
    const codeVerifier = request.cookies.get("cmu-oauth-verifier")?.value;
    if (!codeVerifier || !code) {
      return loginRedirect("oauth_expired");
    }

    // Exchange authorization code for access token
    let accessToken: string;
    try {
      accessToken = await exchangeCodeForToken(code, codeVerifier);
    } catch {
      return loginRedirect("oauth_token_failed");
    }

    // Fetch CMU user profile
    let profile: { email: string; firstName: string; lastName: string };
    try {
      profile = await fetchCmuProfile(accessToken);
    } catch {
      return loginRedirect("oauth_profile_failed");
    }

    // Match email to existing AdminUser
    const user = await prisma.adminUser.findUnique({
      where: { email: profile.email },
    });

    if (!user || !user.isActive) {
      return loginRedirect("oauth_user_not_found");
    }

    // Create session
    const token = await createSession(user.id);

    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        lastLoginAt: new Date(),
      },
    });

    // Set session cookie and clean up OAuth cookies
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const response = NextResponse.redirect(new URL("/", baseUrl));
    response.cookies.set(setSessionCookie(token));

    for (const cookie of clearOAuthCookies()) {
      response.cookies.set(cookie);
    }

    return response;
  } catch {
    return loginRedirect("oauth_error");
  }
}
