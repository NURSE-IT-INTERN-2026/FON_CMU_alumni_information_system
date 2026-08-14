// TEMPORARY dev helper — delete before commit.
import prisma from "../lib/prisma";
import { hashPassword } from "../lib/auth";

async function main() {
  const me = await prisma.alumni.findUnique({ where: { email: "v2dev@test.local" } });
  const other = await prisma.alumni.findFirst({
    where: { communityOptedInAt: { not: null }, id: { not: me!.id }, deletedAt: null },
    orderBy: { communityOptedInAt: "desc" },
  });
  if (!other) { console.log("NONE"); return; }
  await prisma.alumni.update({
    where: { id: other.id },
    data: { email: other.email ?? "v2dev2@test.local", passwordHash: await hashPassword("devtest1234") },
  });
  console.log("SECOND:", other.email ?? "v2dev2@test.local", other.id);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
