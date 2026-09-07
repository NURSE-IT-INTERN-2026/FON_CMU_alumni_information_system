/**
 * Pure geometry math for the product-tour overlay (components/tour/*).
 *
 * Everything here is synchronous and DOM-free so it is node-testable
 * (tests/tour-geometry.test.ts). The overlay feeds it measured rects
 * (getBoundingClientRect, viewport-relative) and receives final positions.
 */

export type StepPlacement = "below" | "above" | "left" | "right";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/** Padding between the target element and the spotlight edge. */
export const TOUR_PAD = 8;
/** Gap between the spotlight edge and the tooltip card. */
export const TOUR_GAP = 12;
/** Max tooltip-card width (also the width basis before measuring). */
export const CARD_MAX_W = 340;
/** Minimum distance the card keeps from the viewport edges. */
const VIEWPORT_MARGIN = 8;

const OPPOSITE: Record<StepPlacement, StepPlacement> = {
  below: "above",
  above: "below",
  left: "right",
  right: "left",
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function clampX(x: number, vp: Viewport, card: { width: number }): number {
  return clamp(x, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, vp.width - card.width - VIEWPORT_MARGIN));
}

function clampY(y: number, vp: Viewport, card: { height: number }): number {
  return clamp(y, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, vp.height - card.height - VIEWPORT_MARGIN));
}

/** Expand a measured rect by `pad` on every side (the spotlight rect). */
export function padRect(r: Rect, pad: number): Rect {
  return {
    x: r.x - pad,
    y: r.y - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

/**
 * Spotlight rect for a centered (target: null) step: a hole in the middle of
 * the viewport that the tooltip card is centered on. Shrunk to fit narrow
 * viewports so the ring stays visible.
 */
export function centeredRect(vp: Viewport, w: number, h: number): Rect {
  const width = Math.max(0, Math.min(w, vp.width - VIEWPORT_MARGIN * 2));
  const height = Math.max(0, Math.min(h, vp.height - VIEWPORT_MARGIN * 2));
  return {
    x: (vp.width - width) / 2,
    y: (vp.height - height) / 2,
    width,
    height,
  };
}

function positionFor(
  placement: StepPlacement,
  target: Rect,
  vp: Viewport,
  card: { width: number; height: number },
): { x: number; y: number } {
  switch (placement) {
    case "below":
      return {
        x: clampX(target.x + target.width / 2 - card.width / 2, vp, card),
        y: target.y + target.height + TOUR_GAP,
      };
    case "above":
      return {
        x: clampX(target.x + target.width / 2 - card.width / 2, vp, card),
        y: target.y - TOUR_GAP - card.height,
      };
    case "right":
      return {
        x: target.x + target.width + TOUR_GAP,
        y: clampY(target.y + target.height / 2 - card.height / 2, vp, card),
      };
    case "left":
      return {
        x: target.x - TOUR_GAP - card.width,
        y: clampY(target.y + target.height / 2 - card.height / 2, vp, card),
      };
  }
}

function fits(
  pos: { x: number; y: number },
  vp: Viewport,
  card: { width: number; height: number },
): boolean {
  return (
    pos.x >= VIEWPORT_MARGIN &&
    pos.y >= VIEWPORT_MARGIN &&
    pos.x + card.width <= vp.width - VIEWPORT_MARGIN &&
    pos.y + card.height <= vp.height - VIEWPORT_MARGIN
  );
}

/**
 * Resolve the tooltip-card position for a step: prefer `preferred`, flip to the
 * opposite side when the card would overflow the viewport, and clamp into the
 * viewport (8px margin) when neither side fits. Returns the final top-left
 * corner plus the placement actually used.
 */
export function computeTooltipPosition(
  target: Rect,
  vp: Viewport,
  card: { width: number; height: number },
  preferred: StepPlacement,
): { x: number; y: number; placement: StepPlacement } {
  const primary = positionFor(preferred, target, vp, card);
  if (fits(primary, vp, card)) return { ...primary, placement: preferred };

  const alt = OPPOSITE[preferred];
  const secondary = positionFor(alt, target, vp, card);
  if (fits(secondary, vp, card)) return { ...secondary, placement: alt };

  // Neither side fits (tiny viewport / tall card): keep the preferred side and
  // fully clamp both axes so the card stays reachable.
  return {
    x: clampX(primary.x, vp, card),
    y: clampY(primary.y, vp, card),
    placement: preferred,
  };
}
