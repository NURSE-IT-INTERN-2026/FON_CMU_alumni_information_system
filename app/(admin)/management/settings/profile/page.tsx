import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

function formatDate(date: Date | null) {
  if (!date) return "-";
  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = session.user;

  const roleLabels: Record<string, string> = {
    superadmin: "ผู้ดูแลระบบสูงสุด",
    admin: "ผู้ดูแลระบบ",
    executive: "ผู้บริหาร",
  };
  const roleLabel = roleLabels[user.role] || user.role;

  const fields = [
    { label: "ชื่อ", value: user.firstName },
    { label: "นามสกุล", value: user.lastName },
    { label: "อีเมล", value: user.email },
    { label: "ตำแหน่ง", value: roleLabel },
    {
      label: "วันที่เพิ่มเข้าสู่ระบบ",
      value: formatDate(user.createdAt),
    },
    {
      label: "แก้ไขล่าสุด",
      value: formatDate(user.updatedAt),
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-2xl font-bold text-[var(--primary)] sm:text-3xl">
        ข้อมูลส่วนตัว
      </h1>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="divide-y divide-gray-100">
          {fields.map((field) => (
            <div
              key={field.label}
              className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:gap-0"
            >
              <span className="w-48 shrink-0 text-sm font-medium text-gray-500">
                {field.label}
              </span>
              <span className="text-sm text-gray-900">{field.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
