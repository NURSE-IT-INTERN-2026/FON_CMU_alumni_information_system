import { redirect } from "next/navigation";
import { getAlumniSession } from "@/lib/auth";
import AlumniHeader from "@/components/AlumniHeader";

export default async function AlumniPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAlumniSession();

  if (!session || !session.alumni) {
    redirect("/alumni/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <AlumniHeader alumni={session.alumni} />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
      <footer className="border-t border-[var(--border)] bg-white py-4 text-center text-xs text-[var(--muted)]">
        © {2568 + new Date().getFullYear() - 2025} คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
      </footer>
    </div>
  );
}
