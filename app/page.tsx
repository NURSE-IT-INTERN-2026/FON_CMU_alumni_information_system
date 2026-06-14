import { redirect } from "next/navigation";

// App root (served at the basePath, i.e. /alumni/) — send to the staff dashboard.
// Unauthenticated users are then bounced to /login by proxy.ts + the (admin) layout.
export default function RootPage() {
  redirect("/management/dashboard");
}
