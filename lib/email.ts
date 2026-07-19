// Alumni mail goes through the CMU Email API (the university's SMTP relay):
// a two-step OAuth flow — POST /EmailApi/GetToken (client credentials) returns
// a 24h Bearer token, then POST /EmailApi/SendEmail sends the message.
// All alumni notifications route through here: email verification, password
// reset, signup approved/rejected. The four exported helpers keep their
// signatures stable; only the transport lives in this file.
//
// Bodies are PLAIN TEXT (the API `message` field accepts `\n` / `<br/>` for
// line breaks). Do not reintroduce HTML bodies — the relay renders `message`
// as text, so markup would show up verbatim. Links are raw URLs.

type TokenCache = { token: string; expiresAt: number };

// Token lives 24h; refresh 1h before expiry so a send never hits a stale token.
const TOKEN_REFRESH_BUFFER_MS = 60 * 60 * 1000;

let tokenCache: TokenCache | null = null;

type CmuEmailConfig = {
  baseUrl: string;
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  systemName: string;
};

// Read env at call time (not module load) so tests can set vars + fresh-import.
function getConfig(): CmuEmailConfig {
  return {
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
    apiUrl: process.env.CMU_EMAIL_API_BASE_URL || "",
    clientId: process.env.CMU_EMAIL_CLIENT_ID || "",
    clientSecret: process.env.CMU_EMAIL_CLIENT_SECRET || "",
    systemName:
      process.env.CMU_EMAIL_SYSTEM_NAME ||
      "ระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มช.",
  };
}

function endpoint(apiUrl: string, path: string): string {
  return `${apiUrl.replace(/\/$/, "")}${path}`;
}

/**
 * Returns a cached Bearer access token, fetching a fresh one when none is
 * cached or the cached token is within 1h of expiry. Throws if the API is not
 * configured or GetToken fails — callers decide whether to swallow.
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + TOKEN_REFRESH_BUFFER_MS) {
    return tokenCache.token;
  }

  const { apiUrl, clientId, clientSecret } = getConfig();
  if (!apiUrl || !clientId || !clientSecret) {
    throw new Error(
      "CMU Email API not configured (set CMU_EMAIL_API_BASE_URL, CMU_EMAIL_CLIENT_ID, CMU_EMAIL_CLIENT_SECRET)"
    );
  }

  const res = await fetch(endpoint(apiUrl, "/EmailApi/GetToken"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    access_token?: string;
    expires_in?: number;
    message?: string;
  };
  if (!res.ok || !data.success || !data.access_token) {
    throw new Error(
      `CMU Email GetToken failed: ${data.message ?? res.status}`
    );
  }

  const expiresInSec = Number(data.expires_in) || 86400;
  tokenCache = {
    token: data.access_token,
    expiresAt: now + expiresInSec * 1000,
  };
  return tokenCache.token;
}

type SendEmailInput = {
  to: string;
  subject: string;
  message: string;
};

/**
 * Shared email primitive. Sends alumni mail via the CMU Email API (GetToken →
 * SendEmail). Throws on failure so callers can decide whether to swallow
 * (best-effort notifications) or surface the error.
 */
async function sendEmail({ to, subject, message }: SendEmailInput): Promise<void> {
  const token = await getAccessToken();
  const { apiUrl, systemName } = getConfig();

  const res = await fetch(endpoint(apiUrl, "/EmailApi/SendEmail"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      subject,
      sent_to: to,
      message,
      system_name: systemName,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
  };
  if (!res.ok || data.success === false) {
    throw new Error(
      `CMU Email SendEmail failed: ${data.message ?? res.status}`
    );
  }
}

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string
): Promise<void> {
  const { baseUrl } = getConfig();
  const resetUrl = `${baseUrl}/alumni/graduates/reset-password?token=${resetToken}`;

  await sendEmail({
    to,
    subject:
      "รีเซ็ตรหัสผ่าน - ระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มช.",
    message: [
      "รีเซ็ตรหัสผ่าน",
      "",
      "ท่านได้รับอีเมลนี้เนื่องจากมีการขอรีเซ็ตรหัสผ่านสำหรับระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่",
      "",
      "กรุณาเปิดลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง):",
      resetUrl,
      "",
      "หากท่านไม่ได้เป็นผู้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยต่ออีเมลนี้ รหัสผ่านของท่านจะยังคงเดิม",
      "",
      "© คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่",
    ].join("\n"),
  });
}

/**
 * Email-ownership verification email sent at signup (and on resend). Clicking
 * the link flips the account UNVERIFIED → PENDING (enters the admin queue).
 * `name` is the applicant's first+last name for the greeting.
 */
export async function sendEmailVerificationEmail(
  to: string,
  name: string,
  verifyToken: string,
): Promise<void> {
  const { baseUrl } = getConfig();
  const verifyUrl = `${baseUrl}/alumni/graduates/verify-email?token=${verifyToken}`;

  await sendEmail({
    to,
    subject:
      "ยืนยันอีเมล - ระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มช.",
    message: [
      "ยืนยันที่อยู่อีเมล",
      "",
      `เรียน ${name},`,
      "",
      "ขอบคุณที่ลงทะเบียนในระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่ กรุณาเปิดลิงก์ด้านล่างเพื่อยืนยันที่อยู่อีเมลของท่าน (ลิงก์นี้จะหมดอายุใน 24 ชั่วโมง):",
      verifyUrl,
      "",
      "หากท่านไม่ได้เป็นผู้ลงทะเบียน กรุณาเพิกเฉยต่ออีเมลนี้",
      "",
      "© คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่",
    ].join("\n"),
  });
}

/**
 * Sent when an admin approves a pending signup — the alumni can now log in.
 * `name` is the alumni's current display name (prefix + first + last).
 */
export async function sendSignupApprovedEmail(to: string, name: string): Promise<void> {
  const { baseUrl } = getConfig();
  const loginUrl = `${baseUrl}/alumni/login`;

  await sendEmail({
    to,
    subject:
      "บัญชีของท่านได้รับอนุมัติแล้ว - ระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มช.",
    message: [
      "บัญชีของท่านได้รับอนุมัติแล้ว",
      "",
      `เรียน ${name},`,
      "",
      "การลงทะเบียนของท่านสำหรับระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่ ได้รับการอนุมัติแล้ว ท่านสามารถเข้าสู่ระบบได้ทันที:",
      loginUrl,
      "",
      "© คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่",
    ].join("\n"),
  });
}

/**
 * Sent when an admin rejects a pending signup. Carries the admin's reason
 * (required at the reject endpoint) and a ยื่นคำขอใหม่ link so the alumni can
 * re-apply directly from the email. `to` is the recipient, so including it in
 * the reapply link's ?email= is safe (no leak beyond the inbox owner).
 */
export async function sendSignupRejectedEmail(
  to: string,
  name: string,
  reason?: string | null,
): Promise<void> {
  const { baseUrl } = getConfig();
  const reapplyUrl = `${baseUrl}/alumni/graduates/reapply?email=${encodeURIComponent(to)}`;

  const lines = [
    "แจ้งผลการพิจารณาการลงทะเบียน",
    "",
    `เรียน ${name},`,
    "",
    "การลงทะเบียนของท่านสำหรับระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่ ยังไม่ได้รับการอนุมัติ",
  ];
  if (reason && reason.trim()) {
    lines.push("", `เหตุผลที่ปฏิเสธ: ${reason}`);
  }
  lines.push(
    "",
    "ท่านสามารถแก้ไขข้อมูลและยื่นคำขอใหม่ได้ที่ลิงก์ด้านล่าง:",
    reapplyUrl,
    "",
    "© คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่",
  );

  await sendEmail({
    to,
    subject:
      "แจ้งผลการพิจารณาการลงทะเบียน - ระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มช.",
    message: lines.join("\n"),
  });
}
