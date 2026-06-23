/**
 * Centralised React Query key factory.
 *
 * Always build keys through this object so call sites can invalidate by
 * hierarchy, e.g. `queryClient.invalidateQueries({ queryKey: queryKeys.awards.all })`
 * wipes every awards query regardless of its page/search/sort arguments — the
 * `.all` key is a prefix of every key in that scope.
 *
 * For the standard entity tables (awards, associations, …) the list key is built
 * inside `useEntityList` as `[scope, "list", opts]`, so these scopes only need
 * `.all` here (used for invalidation). Pages with bespoke params (news, logs,
 * dashboard, alumni profile) declare their own `list`/helpers below.
 */
export const queryKeys = {
  trash: {
    all: ["trash"] as const,
    list: (opts: { entity: string; page: number; search: string }) =>
      ["trash", "list", opts] as const,
  },

  // Standard entity tables — list key built by useEntityList; `.all` for invalidation.
  awards: { all: ["awards"] as const },
  associations: { all: ["associations"] as const },
  potentials: { all: ["potentials"] as const },
  graduateCommittee: { all: ["graduateCommittee"] as const },
  modelRepresentatives: { all: ["modelRepresentatives"] as const },
  alumniAgency: { all: ["alumniAgency"] as const },
  alumni: { all: ["alumni"] as const },

  // Bespoke-param pages.
  news: {
    all: ["news"] as const,
    list: (o: {
      page: number;
      search: string;
      statusFilter: string;
      manageMode: boolean;
    }) => ["news", "list", o] as const,
  },
  logs: {
    all: ["logs"] as const,
    list: (o: {
      page: number;
      resource: string;
      action: string;
      source: string;
    }) => ["logs", "list", o] as const,
  },

  // Non-paginated collections.
  users: { all: ["users"] as const },
  alumniAccounts: { all: ["alumniAccounts"] as const },

  // Dashboard aggregation endpoints.
  dashboard: {
    all: ["dashboard"] as const,
    stats: () => ["dashboard", "stats"] as const,
    chart: () => ["dashboard", "chart"] as const,
  },

  // Alumni profile — graduates portal (me) + admin edit-by-id.
  alumniProfile: {
    all: ["alumniProfile"] as const,
    me: () => ["alumniProfile", "me"] as const,
    admin: (id: string) => ["alumniProfile", "admin", id] as const,
    activity: (id: string) => ["alumniProfile", "activity", id] as const,
  },

  // field-changes — powers useHotFields.
  fieldChanges: {
    all: ["fieldChanges"] as const,
    for: (o: { resourceType: string; idsKey: string }) =>
      ["fieldChanges", o] as const,
  },
} as const;
