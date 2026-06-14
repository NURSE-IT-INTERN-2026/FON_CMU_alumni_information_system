import { redirect } from "next/navigation";

// /management index — the dashboard lives at /management/dashboard.
export default function ManagementIndexPage() {
  redirect("/management/dashboard");
}
