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
