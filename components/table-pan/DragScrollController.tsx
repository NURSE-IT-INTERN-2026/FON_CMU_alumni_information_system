"use client";

import { useEffect } from "react";

/**
 * Drag-to-pan horizontal scroll for wide management tables.
 *
 * Lets an admin click-and-drag a table left/right to scroll it sideways, so they
 * don't have to scroll to the bottom of a tall table to reach the horizontal
 * scrollbar. Mounted once in the admin layout; delegated `document` listeners
 * auto-cover every `<div className="overflow-x-auto"><table>` (current + future).
 *
 * Coexists with existing interactions:
 * - Mouse/trackpad only — touch already scrolls natively.
 * - Skips interactive elements (button/link/input/select/textarea/contenteditable)
 *   so edit/delete/sort/links keep working.
 * - A genuine drag suppresses the resulting `click` (so a row doesn't navigate
 *   after a pan); a plain click still navigates/sorts. Decided by a 5px threshold.
 */
const MOVE_THRESHOLD = 5;
const INTERACTIVE_SELECTOR =
  "button, a, input, select, textarea, [contenteditable], [data-no-drag]";

/**
 * Attach the drag-to-pan listeners to `doc` (+ `window` for move/up). Returns a
 * cleanup that detaches them. Extracted from the component so it can be unit-tested
 * against a DOM document without rendering React.
 */
export function attachDragScroll(doc: Document): () => void {
  let container: HTMLElement | null = null;
  let startX = 0;
  let startScroll = 0;
  let active = false;
  let moved = false;
  // Set on pointerup after a drag; consumed by the capture click handler so the
  // post-drag click doesn't trigger row navigation. Reset on every pointerdown.
  let justDragged = false;

  const onPointerDown = (e: PointerEvent) => {
    justDragged = false;
    // Touch/pen scroll natively; only intercept the mouse.
    if (e.pointerType !== "mouse") return;
    if (e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;
    // Don't hijack clicks on buttons/links/inputs/etc.
    if (target.closest(INTERACTIVE_SELECTOR)) return;

    // Only pan a horizontally-scrollable table container.
    const scroller = target.closest<HTMLElement>(".overflow-x-auto");
    if (!scroller) return;
    if (!scroller.querySelector("table")) return;
    if (scroller.scrollWidth <= scroller.clientWidth + 1) return;

    container = scroller;
    active = true;
    moved = false;
    startX = e.clientX;
    startScroll = container.scrollLeft;
    container.classList.add("drag-panning");
    container.style.userSelect = "none";

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!active || !container) return;
    const dx = e.clientX - startX;
    // Don't pan until the pointer crosses the threshold — a click with a little
    // mouse jitter should stay a click (no pan, no suppressed navigation).
    if (!moved && Math.abs(dx) <= MOVE_THRESHOLD) return;
    moved = true;
    container.scrollLeft = startScroll - dx;
  };

  const onPointerUp = () => {
    if (!active) return;
    active = false;
    if (container) {
      container.classList.remove("drag-panning");
      container.style.userSelect = "";
    }
    if (moved) justDragged = true;
    container = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  };

  // Capture phase so this runs BEFORE the row's <tr onClick> (bubble) and can
  // stop the click from reaching it after a drag.
  const onClickCapture = (e: MouseEvent) => {
    if (justDragged) {
      e.preventDefault();
      e.stopPropagation();
      justDragged = false;
    }
  };

  doc.addEventListener("pointerdown", onPointerDown);
  doc.addEventListener("click", onClickCapture, true);
  return () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    doc.removeEventListener("pointerdown", onPointerDown);
    doc.removeEventListener("click", onClickCapture, true);
  };
}

export function DragScrollController() {
  useEffect(() => attachDragScroll(document), []);
  return null;
}
