import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSession, createAlumniSession, setSessionCookie } from "@/lib/auth";
import {
  exchangeCodeForToken,
  fetchCmuProfile,
  clearOAuthCookies,
  setPendingEmailCookie,
} from "@/lib/oauth";

function adminLoginRedirect(error: string) {
  return NextResponse.redirect(
    new URL(`/login?error=${error}`, process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000")
  );
}

function alumniLoginRedirect(error: string) {
  return NextResponse.redirect(
    new URL(`/login?error=${error}`, process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000")
  );
}

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Detect flow type
    const flowType = request.cookies.get("cmu-oauth-flow")?.value || "admin";
    const isAlumniFlow = flowType === "alumni";
    console.log(`[OAuth Callback] flowType=${flowType}, isAlumniFlow=${isAlumniFlow}`);
    const loginRedirect = isAlumniFlow ? alumniLoginRedirect : adminLoginRedirect;

    // OAuth provider error (e.g. user denied)
    if (error) {
      return loginRedirect("oauth_denied");
    }

    // Validate state for CSRF protection
    const stateCookieName = isAlumniFlow ? "alumni-oauth-state" : "cmu-oauth-state";
    const cookieState = request.cookies.get(stateCookieName)?.value;
    if (!state || state !== cookieState) {
      return loginRedirect("oauth_invalid_state");
    }

    // Retrieve PKCE code verifier
    const verifierCookieName = isAlumniFlow ? "alumni-oauth-verifier" : "cmu-oauth-verifier";
    const codeVerifier = request.cookies.get(verifierCookieName)?.value;
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

    let response: NextResponse;

    if (isAlumniFlow) {
      response = await handleAlumniOAuth(profile, baseUrl);
    } else {
      response = await handleAdminOAuth(profile, baseUrl);
    }

    // Clean up all OAuth cookies
    for (const cookie of clearOAuthCookies()) {
      response.cookies.set(cookie);
    }

    return response;
  } catch (err) {
    console.error("OAuth callback error:", err);
    const flowType = request.cookies.get("cmu-oauth-flow")?.value || "admin";
    return flowType === "alumni"
      ? alumniLoginRedirect("oauth_error")
      : adminLoginRedirect("oauth_error");
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
    return adminLoginRedirect("oauth_user_not_found");
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

  const response = NextResponse.redirect(new URL("/", baseUrl));
  response.cookies.set(setSessionCookie(token));

  return response;
}

async function handleAlumniOAuth(
  profile: { email: string; firstName: string; lastName: string; organizationName?: string },
  baseUrl: string
): Promise<NextResponse> {
  console.log(`[Alumni OAuth] Profile: email=${profile.email}, org=${profile.organizationName}`);

  // Always redirect to identity verification page with the CMU email.
  // The verify-identity page handles matching against alumni records,
  // checking approval status, and creating sessions.
  console.log("[Alumni OAuth] Redirecting to verify-identity");
  const response = NextResponse.redirect(
    new URL("/alumni/verify-identity", baseUrl)
  );
  response.cookies.set(setPendingEmailCookie(profile.email));
  return response;
}
