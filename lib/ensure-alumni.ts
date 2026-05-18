import prisma from "@/lib/prisma";

export async function ensureAlumni(studentId: string, fullName: string) {
  const existing = await prisma.alumni.findUnique({ where: { studentId } });
  if (existing) return existing;

  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] || "ไม่ทราบ";
  const maidenLastName = parts.slice(1).join(" ") || "ไม่ทราบ";

  return prisma.alumni.create({
    data: {
      studentId,
      prefix: "นางสาว",
      firstName,
      maidenLastName,
    },
  });
}
