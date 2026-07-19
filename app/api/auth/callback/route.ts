import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSession, setSessionCookie } from "@/lib/auth";
import {
  exchangeCodeForToken,
  fetchCmuProfile,
  clearOAuthCookies,
} from "@/lib/oauth";
import { BASE_PATH } from "@/lib/constants";
import { getBaseUrl } from "@/lib/base-url";

function loginRedirect(error: string) {
  return NextResponse.redirect(
    new URL(`${BASE_PATH}/login?error=${error}`, getBaseUrl())
  );
}

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl();

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
    } catch (err) {
      console.error("Token exchange error:", err);
      return loginRedirect("oauth_token_failed");
    }

    // Fetch CMU user profile
    let profile;
    try {
      profile = await fetchCmuProfile(accessToken);
    } catch (err) {
      console.error("Profile fetch error:", err);
      return loginRedirect("oauth_profile_failed");
    }

    const response = await handleAdminOAuth(profile, baseUrl);

    // Clean up OAuth cookies
    for (const cookie of clearOAuthCookies()) {
      response.cookies.set(cookie);
    }

    return response;
  } catch (err) {
    console.error("OAuth callback error:", err);
    return loginRedirect("oauth_error");
  }
}

async function handleAdminOAuth(
  profile: { email: string; firstName: string; lastName: string },
  baseUrl: string
): Promise<NextResponse> {
  // Match email to existing AdminUser
  const user = await prisma.adminUser.findUnique({
    where: { email: profile.email },
  });

  if (!user || !user.isActive) {
    return loginRedirect("oauth_user_not_found");
  }

  // Create admin session
  const token = await createSession(user.id);

  await prisma.adminUser.update({
    where: { id: user.id },
    data: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      lastLoginAt: new Date(),
    },
  });

  const response = NextResponse.redirect(new URL(BASE_PATH, baseUrl));
  response.cookies.set(setSessionCookie(token));

  return response;
}
