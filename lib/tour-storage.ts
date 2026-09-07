/**
 * localStorage persistence for product-tour completion (lib/tours.ts).
 *
 * Key shape: `tour-completed:<tourId>:<scope>` where scope is the alumni id
 * (alumni portal) or the admin role (no client-side user id on the admin
 * side). localStorage is per-browser, so this only gates re-offering UX —
 * the 'i' header button always replays regardless of the flag.
 */

function completedKey(tourId: string, userScope: string): string {
  return `tour-completed:${tourId}:${userScope}`;
}

export function isTourCompleted(tourId: string, userScope: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(completedKey(tourId, userScope)) === "true";
  } catch {
    // Private mode / storage disabled — treat as not completed.
    return false;
  }
}

export function markTourCompleted(tourId: string, userScope: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(completedKey(tourId, userScope), "true");
  } catch {
    // Quota exceeded / storage disabled — best-effort only.
  }
}
