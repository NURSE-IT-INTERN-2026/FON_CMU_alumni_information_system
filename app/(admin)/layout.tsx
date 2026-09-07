import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { RoleProvider } from "@/lib/role-context";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";
import { DragScrollController } from "@/components/table-pan/DragScrollController";
import { TourProvider } from "@/components/tour/tour-provider";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session || !session.user) {
    redirect("/login");
  }

  return (
    <RoleProvider role={session.user.role}>
      <TourProvider area="admin">
        <DragScrollController />
        <div className="flex min-h-screen flex-col">
          <a href="#main-content" className="skip-link">ข้ามไปเนื้อหาหลัก</a>
          <Header user={{ firstName: session.user.firstName, lastName: session.user.lastName }} />
          <div className="flex flex-1">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <main id="main-content" className="min-w-0 flex-1">{children}</main>
              <Footer />
            </div>
          </div>
        </div>
      </TourProvider>
    </RoleProvider>
  );
}
