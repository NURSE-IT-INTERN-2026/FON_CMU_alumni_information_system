"use client";

import { createContext, useContext } from "react";

const RoleContext = createContext<string>("admin");

/** Thai display label for an admin role value (matches the users page / logs). */
const ROLE_LABELS: Record<string, string> = {
  superadmin: "ผู้ดูแลระบบสูงสุด",
  admin: "ผู้ดูแลระบบ",
  executive: "ผู้บริหาร",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? "ผู้ดูแลระบบ";
}

export function RoleProvider({
  role,
  children,
}: {
  role: string;
  children: React.ReactNode;
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}

export function useCanWrite() {
  const role = useRole();
  return role === "admin" || role === "superadmin";
}

export function useIsAdmin() {
  const role = useRole();
  return role === "admin" || role === "superadmin";
}
