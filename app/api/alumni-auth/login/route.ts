import { NextResponse } from "next/server";
import {
  generateState,
  generateCodeVerifier,
  generateCodeChallenge,
  setAlumniOAuthCookies,
} from "@/lib/oauth";

export async function GET() {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID!,
    response_type: "code",
    redirect_uri: process.env.CALLBACK_URL!,
    scope: process.env.SCOPE!,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authUrl = `${process.env.AUTH_URL}?${params.toString()}`;
  console.log("[Alumni OAuth] Redirecting to CMU, flow cookie will be set to 'alumni'");
  const response = NextResponse.redirect(authUrl);

  for (const cookie of setAlumniOAuthCookies(state, codeVerifier)) {
    response.cookies.set(cookie);
  }

  return response;
}
