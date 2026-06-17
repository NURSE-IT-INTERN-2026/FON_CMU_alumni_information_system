/**
 * Centralised React Query key factory.
 *
 * Always build keys through this object so call sites can invalidate by
 * hierarchy, e.g. `queryClient.invalidateQueries({ queryKey: queryKeys.trash.all })`
 * wipes every trash query regardless of its page/search arguments.
 *
 * Keys are arrays of the form `[scope, ...args]`. Include every variable that
 * changes the request shape (entity, page, search) so the cache keys correctly
 * and stale data isn't reused for a different request.
 */
export const queryKeys = {
  trash: {
    all: ["trash"] as const,
    list: (opts: { entity: string; page: number; search: string }) =>
      ["trash", "list", opts] as const,
  },
  // Add more scopes as pages migrate, e.g.:
  // alumni: {
  //   all: ["alumni"] as const,
  //   list: (opts: { page: number; search: string }) =>
  //     ["alumni", "list", opts] as const,
  // },
} as const;
