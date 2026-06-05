import { randomBytes, createHash, randomUUID } from "crypto";

const OAUTH_STATE_COOKIE = "cmu-oauth-state";
const OAUTH_VERIFIER_COOKIE = "cmu-oauth-verifier";
const ALUMNI_OAUTH_STATE_COOKIE = "alumni-oauth-state";
const ALUMNI_OAUTH_VERIFIER_COOKIE = "alumni-oauth-verifier";
const OAUTH_FLOW_COOKIE = "cmu-oauth-flow";
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
    console.error(`Token exchange failed: ${res.status}`, text);
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    console.error("Token response missing access_token:", JSON.stringify(data).slice(0, 200));
    throw new Error("No access_token in token response");
  }

  return data.access_token as string;
}

export interface CmuProfile {
  email: string;
  firstName: string;
  lastName: string;
  organizationName?: string;
}

export async function fetchCmuProfile(
  accessToken: string
): Promise<CmuProfile> {
  const res = await fetch(process.env.BASICINFO_URL!, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Profile fetch failed: ${res.status}`);
  }

  const json = await res.json();

  const profile = json.data ?? json;

  // CMU basicinfo API v3 field names
  const email =
    profile.cmuitaccount ??
    profile.cmuAccount ??
    profile.email ??
    profile.mail ??
    profile.preferred_username;

  const firstName =
    profile.firstname_TH ??
    profile.firstname_EN ??
    profile.firstName ??
    profile.given_name ??
    "";

  const lastName =
    profile.lastname_TH ??
    profile.lastname_EN ??
    profile.lastName ??
    profile.family_name ??
    "";

  const organizationName =
    profile.organization_name_TH ??
    profile.organization_name_EN ??
    profile.organizationNameTH ??
    profile.organizationNameEN ??
    profile.organizationName ??
    "";

  if (!email) {
    throw new Error("No email found in CMU profile response");
  }

  return { email, firstName, lastName, organizationName };
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

export function setAlumniOAuthCookies(state: string, verifier: string) {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: OAUTH_COOKIE_MAX_AGE,
    path: "/",
  };

  return [
    { name: ALUMNI_OAUTH_STATE_COOKIE, value: state, ...base },
    { name: ALUMNI_OAUTH_VERIFIER_COOKIE, value: verifier, ...base },
    { name: OAUTH_FLOW_COOKIE, value: "alumni", ...base },
  ];
}

export function setAdminFlowCookie() {
  return {
    name: OAUTH_FLOW_COOKIE,
    value: "admin",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: OAUTH_COOKIE_MAX_AGE,
    path: "/",
  };
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
    { name: ALUMNI_OAUTH_STATE_COOKIE, ...base },
    { name: ALUMNI_OAUTH_VERIFIER_COOKIE, ...base },
    { name: OAUTH_FLOW_COOKIE, ...base },
  ];
}
