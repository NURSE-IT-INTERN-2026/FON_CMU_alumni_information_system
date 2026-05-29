"use client";

import { createContext, useContext } from "react";

const RoleContext = createContext<string>("executive");

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
  return useRole() !== "executive";
}

export function useIsAdmin() {
  const role = useRole();
  return role === "admin" || role === "superadmin";
}
