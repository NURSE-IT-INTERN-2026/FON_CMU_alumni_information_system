import { redirect } from "next/navigation";
import { getAlumniSession } from "@/lib/auth";
import AlumniHeader from "@/components/AlumniHeader";
import AlumniSidebar from "@/components/AlumniSidebar";
import Footer from "@/components/Footer";

export default async function AuthedGraduatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAlumniSession();

  // Require an alumni session for every page in this route group.
  if (!session || !session.alumni) {
    redirect("/login");
  }

  // First-login gate: alumni must accept the Terms of Service before they can
  // use any authenticated page. The TOS page lives outside this group so it is
  // reachable before acceptance (otherwise this redirect would loop).
  if (!session.alumni.tosAcceptedAt) {
    redirect("/graduates/tos");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <AlumniHeader alumni={session.alumni} />
      <div className="flex flex-1">
        <AlumniSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="min-w-0 flex-1">{children}</main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
