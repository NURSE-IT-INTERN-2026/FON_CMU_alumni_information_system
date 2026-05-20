import { randomBytes, createHash, randomUUID } from "crypto";

const OAUTH_STATE_COOKIE = "cmu-oauth-state";
const OAUTH_VERIFIER_COOKIE = "cmu-oauth-verifier";
const OAUTH_COOKIE_MAX_AGE = 600; // 10 minutes

export function generateCodeVerifier(): string {
  return randomBytes(64).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function generateState(): string {
  return randomUUID();
}

export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string
): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.CALLBACK_URL!,
    client_id: process.env.CLIENT_ID!,
    client_secret: process.env.CLIENT_SECRET!,
    code_verifier: codeVerifier,
  });

  const res = await fetch(process.env.TOKEN_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("No access_token in token response");
  }

  return data.access_token as string;
}

export async function fetchCmuProfile(
  accessToken: string
): Promise<{ email: string; firstName: string; lastName: string }> {
  const res = await fetch(process.env.BASICINFO_URL!, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Profile fetch failed: ${res.status}`);
  }

  const json = await res.json();

  const profile = json.data ?? json;
  const email =
    profile.cmuAccount ??
    profile.email ??
    profile.mail ??
    profile.preferred_username;
  const firstName = profile.firstName ?? profile.given_name ?? "";
  const lastName = profile.lastName ?? profile.family_name ?? "";

  if (!email) {
    throw new Error("No email found in CMU profile response");
  }

  return { email, firstName, lastName };
}

export function setOAuthCookies(state: string, verifier: string) {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: OAUTH_COOKIE_MAX_AGE,
    path: "/",
  };

  return [
    { name: OAUTH_STATE_COOKIE, value: state, ...base },
    { name: OAUTH_VERIFIER_COOKIE, value: verifier, ...base },
  ];
}

export function clearOAuthCookies() {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 0,
    path: "/",
    value: "",
  };

  return [
    { name: OAUTH_STATE_COOKIE, ...base },
    { name: OAUTH_VERIFIER_COOKIE, ...base },
  ];
}
