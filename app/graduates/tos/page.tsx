import { redirect } from "next/navigation";
import { getAlumniSession } from "@/lib/auth";
import TosConsent from "./TosConsent";

export const dynamic = "force-dynamic";

export default async function TosPage() {
  // Reachable only with a valid alumni session. Lives outside the (authed)
  // group so the TOS gate in that layout doesn't redirect-loop back here.
  const session = await getAlumniSession();
  if (!session || !session.alumni) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-[var(--primary)]">
          ข้อตกลงและเงื่อนไขการใช้งานระบบสารสนเทศศิษย์เก่า
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
        </p>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-gray-700">
          <p>
            ระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
            จัดทำขึ้นเพื่อเก็บรวบรวม แสดง และให้ศิษย์เก้าได้ปรับปรุงข้อมูลของตนเอง
            รวมถึงใช้สำหรับการติดต่อและเผยแพร่ข่าวสารของคณะ
          </p>
          <p>เมื่อท่านยอมรับข้อตกลงฯ นี้ ท่านตกลงที่จะ:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>ให้ข้อมูลที่เป็นจริงและถูกต้อง รวมถึงปรับปรุงข้อมูลของตนเองให้เป็นปัจจุบัน</li>
            <li>ใช้ข้อมูลภายในระบบเพื่อวัตถุประสงค์ที่เหมาะสมและชอบด้วยกฎหมายเท่านั้น</li>
            <li>เคารพสิทธิและความเป็นส่วนตัวของศิษย์เก่าท่านอื่น</li>
          </ul>
          <p>
            คณะจะเก็บรักษาข้อมูลของท่านไว้เป็นความลับ และใช้เพื่อการดำเนินงานของระบบ
            ตามนโยบายการคุ้มครองข้อมูลส่วนบุคคล การเข้าใช้งานระบบจะมีการบันทึกกิจกรรม
            (activity log) เพื่อความปลอดภัยและการตรวจสอบ
          </p>
          <p>
            หากท่านไม่ยอมรับข้อตกลงฯ นี้ ท่านจะไม่สามารถใช้งานระบบได้
            และจะถูกนำออกจากระบบโดยอัตโนมัติ
          </p>
        </div>

        <TosConsent />
      </div>
    </div>
  );
}
