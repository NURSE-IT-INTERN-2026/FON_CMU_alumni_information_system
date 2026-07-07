import nodemailer from "nodemailer";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// From address used for every alumni-facing email. SMTP_FROM is preferred,
// falling back to a sensible default. Configure a real sending address in .env.
const fromAddress =
  process.env.SMTP_FROM ||
  '"FON CMU Alumni" <noreply@cmu.ac.th>';

// nodemailer SMTP transporter — the sole email provider for alumni mail
// (verification, password reset, signup approved/rejected). Configure via the
// SMTP_* env vars (see .env.example).
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Shared email primitive. Sends alumni mail via the nodemailer SMTP
 * transporter. Throws on failure so callers can decide whether to swallow
 * (best-effort notifications) or surface the error.
 */
async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  await transporter.sendMail({ from: fromAddress, to, subject, html });
}

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string
): Promise<void> {
  const resetUrl = `${baseUrl}/alumni/graduates/reset-password?token=${resetToken}`;

  await sendEmail({
    to,
    subject:
      "รีเซ็ตรหัสผ่าน - ระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มช.",
    html: `
      <div style="font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f5f7fa; border-radius: 8px;">
        <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #5b21b6; margin: 0; font-size: 22px;">รีเซ็ตรหัสผ่าน</h2>
          </div>
          <p style="color: #1a1a2e; font-size: 16px; line-height: 1.6;">
            ท่านได้รับอีเมลนี้เนื่องจากมีการขอรีเซ็ตรหัสผ่านสำหรับระบบสารสนเทศศิษย์เก่า
            คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
          </p>
          <p style="color: #1a1a2e; font-size: 16px; line-height: 1.6;">
            กรุณาคลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่
            <span style="color: #e53e3e; font-weight: 600;">(ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง)</span>
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="display: inline-block; background-color: #5b21b6; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
              รีเซ็ตรหัสผ่าน
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            หากปุ่มด้านบนไม่ทำงาน กรุณาคัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์:
          </p>
          <p style="color: #3182ce; font-size: 14px; word-break: break-all;">
            ${resetUrl}
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 13px; line-height: 1.5;">
            หากท่านไม่ได้เป็นผู้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยต่ออีเมลนี้ รหัสผ่านของท่านจะยังคงเดิม
          </p>
        </div>
        <div style="text-align: center; margin-top: 16px;">
          <p style="color: #9ca3af; font-size: 12px;">
            © คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
          </p>
        </div>
      </div>
    `,
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
  const verifyUrl = `${baseUrl}/alumni/graduates/verify-email?token=${verifyToken}`;

  await sendEmail({
    to,
    subject:
      "ยืนยันอีเมล - ระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มช.",
    html: `
      <div style="font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f5f7fa; border-radius: 8px;">
        <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #5b21b6; margin: 0; font-size: 22px;">ยืนยันที่อยู่อีเมล</h2>
          </div>
          <p style="color: #1a1a2e; font-size: 16px; line-height: 1.6;">
            เรียน ${name},
          </p>
          <p style="color: #1a1a2e; font-size: 16px; line-height: 1.6;">
            ขอบคุณที่ลงทะเบียนในระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
            กรุณาคลิกปุ่มด้านล่างเพื่อยืนยันที่อยู่อีเมลของท่าน
            <span style="color: #e53e3e; font-weight: 600;">(ลิงก์นี้จะหมดอายุใน 24 ชั่วโมง)</span>
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}" style="display: inline-block; background-color: #5b21b6; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
              ยืนยันอีเมล
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            หากปุ่มด้านบนไม่ทำงาน กรุณาคัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์:
          </p>
          <p style="color: #3182ce; font-size: 14px; word-break: break-all;">
            ${verifyUrl}
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 13px; line-height: 1.5;">
            หากท่านไม่ได้เป็นผู้ลงทะเบียน กรุณาเพิกเฉยต่ออีเมลนี้
          </p>
        </div>
        <div style="text-align: center; margin-top: 16px;">
          <p style="color: #9ca3af; font-size: 12px;">
            © คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
          </p>
        </div>
      </div>
    `,
  });
}

/**
 * Sent when an admin approves a pending signup — the alumni can now log in.
 * `name` is the alumni's current display name (prefix + first + last).
 */
export async function sendSignupApprovedEmail(to: string, name: string): Promise<void> {
  const loginUrl = `${baseUrl}/alumni/login`;

  await sendEmail({
    to,
    subject:
      "บัญชีของท่านได้รับอนุมัติแล้ว - ระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มช.",
    html: `
      <div style="font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f5f7fa; border-radius: 8px;">
        <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #2e7d32; margin: 0; font-size: 22px;">บัญชีของท่านได้รับอนุมัติแล้ว</h2>
          </div>
          <p style="color: #1a1a2e; font-size: 16px; line-height: 1.6;">
            เรียน ${name},
          </p>
          <p style="color: #1a1a2e; font-size: 16px; line-height: 1.6;">
            การลงทะเบียนของท่านสำหรับระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
            ได้รับการอนุมัติแล้ว ท่านสามารถเข้าสู่ระบบได้ทันที
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${loginUrl}" style="display: inline-block; background-color: #2e7d32; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
              เข้าสู่ระบบ
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            หากปุ่มด้านบนไม่ทำงาน กรุณาคัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์:
          </p>
          <p style="color: #3182ce; font-size: 14px; word-break: break-all;">
            ${loginUrl}
          </p>
        </div>
        <div style="text-align: center; margin-top: 16px;">
          <p style="color: #9ca3af; font-size: 12px;">
            © คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
          </p>
        </div>
      </div>
    `,
  });
}

/**
 * Sent when an admin rejects a pending signup. Deliberately vague — no field
 * details, just "contact the admin" — so the alumni knows to follow up.
 */
export async function sendSignupRejectedEmail(
  to: string,
  name: string,
  reason?: string | null,
): Promise<void> {
  await sendEmail({
    to,
    subject:
      "แจ้งผลการพิจารณาการลงทะเบียน - ระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มช.",
    html: `
      <div style="font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f5f7fa; border-radius: 8px;">
        <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #c62828; margin: 0; font-size: 22px;">แจ้งผลการพิจารณาการลงทะเบียน</h2>
          </div>
          <p style="color: #1a1a2e; font-size: 16px; line-height: 1.6;">
            เรียน ${name},
          </p>
          <p style="color: #1a1a2e; font-size: 16px; line-height: 1.6;">
            การลงทะเบียนของท่านสำหรับระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
            ยังไม่ได้รับการอนุมัติ หากท่านมีข้อสงสัยหรือต้องการสอบถามรายละเอียดเพิ่มเติม
            กรุณาติดต่อผู้ดูแลระบบ
          </p>
          ${reason ? `
          <p style="color: #1a1a2e; font-size: 16px; line-height: 1.6;">
            <strong>หมายเหตุ:</strong> ${reason}
          </p>` : ""}
        </div>
        <div style="text-align: center; margin-top: 16px;">
          <p style="color: #9ca3af; font-size: 12px;">
            © คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
          </p>
        </div>
      </div>
    `,
  });
}
