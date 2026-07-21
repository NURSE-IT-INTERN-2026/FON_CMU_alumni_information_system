// Client-safe, pure helpers for the news management page's status-group selection.
// News selection is locked to ONE status group at a time so that the bulk action
// (publish for unpublished; pin/discontinue for published) is unambiguous.
// No Prisma / server-only imports — safe to import from client components.

export type NewsStatus = "DRAFT" | "PUBLISHED" | "DISCONTINUED";

/** The two selection groups. PUBLISHED is its own group; DRAFT + DISCONTINUED share "unpublished". */
export type SelectionGroup = "published" | "unpublished";

/** Map a news status to its selection group. */
export function statusGroup(status: NewsStatus): SelectionGroup {
  return status === "PUBLISHED" ? "published" : "unpublished";
}

/** Can a card with this status be toggled into the selection right now? */
export function canSelect(itemStatus: NewsStatus, currentGroup: SelectionGroup | null): boolean {
  return currentGroup === null || statusGroup(itemStatus) === currentGroup;
}

/**
 * Resolve which on-page ids "select all on this page" should target, and which
 * group it would lock to.
 * - If a group is already locked: target only that group's items on the page.
 * - If no group is locked and the page is homogeneous (single group): target all
 *   on-page items and report that group (select-all auto-locks it).
 * - If no group is locked and the page is MIXED: return no target + null group
 *   (the caller disables select-all until the user clicks a card to pick a group).
 */
export function resolveSelectAllTargetIds<T extends { id: string; status: NewsStatus }>(
  pageItems: T[],
  currentGroup: SelectionGroup | null,
): { ids: string[]; group: SelectionGroup | null } {
  if (pageItems.length === 0) return { ids: [], group: currentGroup };

  if (currentGroup !== null) {
    return {
      ids: pageItems.filter((n) => statusGroup(n.status) === currentGroup).map((n) => n.id),
      group: currentGroup,
    };
  }

  const groups = new Set(pageItems.map((n) => statusGroup(n.status)));
  if (groups.size === 1) {
    const group = [...groups][0];
    return { ids: pageItems.map((n) => n.id), group };
  }

  // Mixed page, no locked group — can't pick one silently.
  return { ids: [], group: null };
}
