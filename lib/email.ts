import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string
): Promise<void> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const resetUrl = `${baseUrl}/alumni/reset-password?token=${resetToken}`;

  await transporter.sendMail({
    from:
      process.env.SMTP_FROM ||
      '"FON CMU Alumni" <noreply@cmu.ac.th>',
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
