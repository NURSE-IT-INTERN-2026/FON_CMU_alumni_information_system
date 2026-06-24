"use client";

import { createContext, useContext } from "react";

const RoleContext = createContext<string>("admin");

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
