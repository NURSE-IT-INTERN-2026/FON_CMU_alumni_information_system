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
  alumni: {
    all: ["alumni"] as const,
    // The all-alumni manage page's FETCH-ONCE base: the full raw CMU list +
    // full local list, param-free (search/facets/sort/dedupe are applied
    // client-side in a useMemo, so interactions never refetch). Prefixed by
    // `.all` so existing alumni invalidations still wipe it.
    manageBase: () => ["alumni", "manageBase"] as const,
  },
  education: {
    all: ["education"] as const,
    list: (alumniId: string) => ["education", "list", alumniId] as const,
  },

  // Bespoke-param pages.
  news: {
    all: ["news"] as const,
    list: (o: {
      page: number;
      search: string;
      statusFilter: string;
    }) => ["news", "list", o] as const,
    // Pinned "ประชาสัมพันธ์สำคัญ" section — stable key (the server enforces
    // PUBLISHED-only for alumni). Covered by `.all` invalidation.
    pinned: () => ["news", "pinned"] as const,
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
  alumniAccounts: {
    all: ["alumniAccounts"] as const,
    // Just the PENDING count — drives the red badge on the sidebar accounts
    // menu item. Separate from `.all` so it isn't wiped by list invalidations.
    pendingCount: () => ["alumniAccounts", "pendingCount"] as const,
  },

  // Dashboard aggregation endpoints.
  dashboard: {
    all: ["dashboard"] as const,
    stats: () => ["dashboard", "stats"] as const,
    chart: () => ["dashboard", "chart"] as const,
  },

  // Alumni-portal engagement analytics (login activity / accounts).
  alumniActivity: {
    all: ["alumniActivity"] as const,
    stats: () => ["alumniActivity", "stats"] as const,
  },

  // CMU Registrar sync (การดึงข้อมูล page) — compare + materialize, plus the
  // local-cache vs live-CMU comparison tables.
  cmuSync: {
    all: ["cmuSync"] as const,
    compare: () => ["cmuSync", "compare"] as const,
    // "ข้อมูลในระบบ" — local cmu_graduates cache (dedupe=false, raw records).
    local: (o: { page: number; search: string }) => ["cmuSync", "local", o] as const,
    // "ข้อมูลล่าสุดจากทะเบียน" — live CMU (server-paginated).
    live: (o: { page: number; search: string }) => ["cmuSync", "live", o] as const,
  },

  // Alumni profile — graduates portal (me) + admin edit-by-id.
  alumniProfile: {
    all: ["alumniProfile"] as const,
    me: () => ["alumniProfile", "me"] as const,
    admin: (id: string) => ["alumniProfile", "admin", id] as const,
    activity: (id: string) => ["alumniProfile", "activity", id] as const,
  },

  // Alumni community forum — graduates portal (membership + topics + replies)
  // and the admin moderation reports queue. `.all` wipes everything forum-
  // related on a mutation.
  forum: {
    all: ["forum"] as const,
    membership: () => ["forum", "membership"] as const,
    topics: (o: { page: number; search: string; sort: string }) =>
      ["forum", "topics", o] as const,
    topic: (id: string) => ["forum", "topic", id] as const,
    replies: (topicId: string, page: number) =>
      ["forum", "replies", topicId, page] as const,
    reports: (o: { page: number; status: string; resourceType: string }) =>
      ["forum", "reports", o] as const,
  },

  // Alumni community events — list (upcoming/past) + detail. `.all` wipes
  // everything event-related on a mutation.
  events: {
    all: ["events"] as const,
    list: (o: { page: number; search: string; scope: string }) =>
      ["events", "list", o] as const,
    detail: (id: string) => ["events", "detail", id] as const,
  },

  // Alumni activity feed — stream + a post's comments. `.all` wipes on a
  // post/like/comment mutation.
  feed: {
    all: ["feed"] as const,
    list: (o: { page: number }) => ["feed", "list", o] as const,
    post: (id: string) => ["feed", "post", id] as const,
    comments: (postId: string, page: number) =>
      ["feed", "comments", postId, page] as const,
  },

  // Community profile + directory (alumni community V2). `.all` wipes both on
  // a profile mutation (the directory reads the profile).
  community: {
    all: ["community"] as const,
    profile: () => ["community", "profile"] as const,
    directory: (o: {
      page: number;
      search: string;
      cohort: string;
      degreeLevel: string;
      province: string;
      country: string;
    }) => ["community", "directory", o] as const,
    directoryDetail: (id: string) => ["community", "directoryDetail", id] as const,
  },

  // Groups (alumni community V2) — list + detail (+ myMembership flag).
  groups: {
    all: ["groups"] as const,
    list: (o: { page: number; search: string; kind: string }) =>
      ["groups", "list", o] as const,
    detail: (slug: string) => ["groups", "detail", slug] as const,
  },

  // Job board + mentorship (alumni community V2).
  jobs: {
    all: ["jobs"] as const,
    list: (o: { page: number; search: string; province: string; scope: string }) =>
      ["jobs", "list", o] as const,
    detail: (id: string) => ["jobs", "detail", id] as const,
  },
  mentorship: {
    all: ["mentorship"] as const,
    mentors: (o: { search: string }) => ["mentorship", "mentors", o] as const,
    myProfile: () => ["mentorship", "myProfile"] as const,
    requests: () => ["mentorship", "requests"] as const,
  },

  // Announcements + event photo albums (alumni community V2).
  announcements: {
    all: ["announcements"] as const,
    list: () => ["announcements", "list"] as const,
    // Admin management list — distinct from `list()` (alumni adds ?since=true,
    // a different response shape).
    adminList: () => ["announcements", "adminList"] as const,
  },
  eventPhotos: {
    all: ["eventPhotos"] as const,
    list: (eventId: string) => ["eventPhotos", "list", eventId] as const,
  },

  // Notifications (community V2) — badge key separate from `.all` so it isn't
  // wiped by list invalidations (mirrors alumniAccounts.pendingCount).
  notifications: {
    all: ["notifications"] as const,
    list: (o: { page: number }) => ["notifications", "list", o] as const,
    unreadCount: () => ["notifications", "unreadCount"] as const,
  },

  // field-changes — powers useHotFields.
  fieldChanges: {
    all: ["fieldChanges"] as const,
    for: (o: { resourceType: string; idsKey: string }) =>
      ["fieldChanges", o] as const,
  },
} as const;
