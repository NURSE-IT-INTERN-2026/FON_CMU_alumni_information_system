"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Provides a stable QueryClient for the whole app.
 *
 * The client is created once per browser session via useState so it (and its
 * cache) survives re-renders — creating it in render body would reset the
 * cache and default options on every render. Wrap the app at the root layout.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Keep cached data fresh for 30s rather than refetching on every
            // mount (React Query's default staleTime is 0).
            staleTime: 30_000,
            // Admin tool: don't silently refetch when the tab regains focus.
            refetchOnWindowFocus: false,
            // One retry before surfacing an error to the UI.
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
