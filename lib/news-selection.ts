// Client-safe, pure helpers for the news management page's status-locked selection.
// Selection locks to a single NewsStatus so the bulk action is always unambiguous:
//   DRAFT        -> publish + discontinue
//   DISCONTINUED -> publish (re-publish)
//   PUBLISHED    -> pin/unpin toggle + discontinue
// No Prisma / server-only imports — safe to import from client components.

export type NewsStatus = "DRAFT" | "PUBLISHED" | "DISCONTINUED";

/** Can a card with this status be toggled into the selection right now? */
export function canSelect(itemStatus: NewsStatus, lockedStatus: NewsStatus | null): boolean {
  return lockedStatus === null || itemStatus === lockedStatus;
}

interface PageItem {
  id: string;
  status: NewsStatus;
  pinnedAt: string | null;
}

/**
 * Resolve which on-page ids "select all on this page" should target, and which
 * status it would lock to.
 * - If a status is locked: target only that status's items on the page,
 *   EXCLUDING pinned news (pinned live in the separate "ประชาสัมพันธ์สำคัญ"
 *   section and are never grabbed by select-all).
 * - If no status is locked and the page is homogeneous (a single status): target
 *   all of that status's (non-pinned) items and report that status (select-all
 *   auto-locks it).
 * - If no status is locked and the page is MIXED (≥2 statuses): return no target
 *   + null status (the caller disables select-all until the user clicks a card
 *   to pick a status).
 */
export function resolveSelectAllTargetIds<T extends PageItem>(
  pageItems: T[],
  lockedStatus: NewsStatus | null,
): { ids: string[]; status: NewsStatus | null } {
  if (pageItems.length === 0) return { ids: [], status: lockedStatus };

  if (lockedStatus !== null) {
    return {
      ids: pageItems.filter((n) => n.status === lockedStatus && !n.pinnedAt).map((n) => n.id),
      status: lockedStatus,
    };
  }

  const statuses = new Set(pageItems.filter((n) => !n.pinnedAt).map((n) => n.status));
  if (statuses.size === 1) {
    const status = [...statuses][0];
    return {
      ids: pageItems.filter((n) => n.status === status && !n.pinnedAt).map((n) => n.id),
      status,
    };
  }

  // Mixed page, no locked status — can't pick one silently.
  return { ids: [], status: null };
}

/**
 * What the bulk pin/unpin button should do, given how many of the selected
 * (published) items are currently pinned: 0 -> pin all; all -> unpin all;
 * otherwise toggle each. The button label mirrors this discriminator.
 */
export function pinToggleKind(
  selectedPinnedCount: number,
  selectedCount: number,
): "pin" | "unpin" | "toggle" {
  if (selectedPinnedCount === 0) return "pin";
  if (selectedPinnedCount === selectedCount) return "unpin";
  return "toggle";
}
