import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { RoleProvider } from "@/lib/role-context";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <RoleProvider role={session.user.role}>
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="min-w-0 flex-1">{children}</main>
            <Footer />
          </div>
        </div>
      </div>
    </RoleProvider>
  );
}
