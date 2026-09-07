import { describe, it, expect } from "vitest";
import {
  padRect,
  centeredRect,
  computeTooltipPosition,
  TOUR_GAP,
  type Rect,
  type Viewport,
} from "@/lib/tour-geometry";

const VP: Viewport = { width: 1280, height: 800 };

function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

describe("padRect", () => {
  it("expands the rect by pad on every side", () => {
    expect(padRect(rect(100, 100, 200, 50), 8)).toEqual(rect(92, 92, 216, 66));
  });

  it("is additive (pad twice = pad 2x once)", () => {
    const r = rect(10, 10, 100, 100);
    expect(padRect(padRect(r, 4), 4)).toEqual(padRect(r, 8));
  });
});

describe("centeredRect", () => {
  it("centers a hole in the viewport", () => {
    const out = centeredRect(VP, 320, 160);
    expect(out.x).toBeCloseTo((1280 - 320) / 2);
    expect(out.y).toBeCloseTo((800 - 160) / 2);
  });

  it("shrinks to fit a narrow viewport", () => {
    const out = centeredRect({ width: 200, height: 400 }, 320, 160);
    expect(out.width).toBe(184); // 200 - 2*8 margin
    expect(out.height).toBe(160);
  });
});

describe("computeTooltipPosition", () => {
  const CARD = { width: 340, height: 160 };

  it("places the card below a centered target by default", () => {
    const target = rect(470, 100, 340, 40);
    const out = computeTooltipPosition(target, VP, CARD, "below");
    expect(out.placement).toBe("below");
    expect(out.y).toBe(100 + 40 + TOUR_GAP);
    expect(out.x + CARD.width / 2).toBeCloseTo(470 + 170); // horizontally centered on target
  });

  it("flips above when the card would overflow the bottom", () => {
    const target = rect(470, 700, 340, 60);
    const out = computeTooltipPosition(target, VP, CARD, "below");
    expect(out.placement).toBe("above");
    expect(out.y + CARD.height + TOUR_GAP).toBeCloseTo(700);
  });

  it("flips below when preferred=above doesn't fit", () => {
    const target = rect(470, 40, 340, 60);
    const out = computeTooltipPosition(target, VP, CARD, "above");
    expect(out.placement).toBe("below");
    expect(out.y).toBe(40 + 60 + TOUR_GAP);
  });

  it("places right/left beside the target, vertically centered", () => {
    const target = rect(600, 330, 200, 140);
    const right = computeTooltipPosition(target, VP, CARD, "right");
    expect(right.x).toBe(600 + 200 + TOUR_GAP);
    expect(right.y + CARD.height / 2).toBeCloseTo(330 + 70);

    const left = computeTooltipPosition(target, VP, CARD, "left");
    expect(left.placement).toBe("left");
    expect(left.x + CARD.width + TOUR_GAP).toBe(600);
  });

  it("clamps horizontally so the card never leaves the viewport", () => {
    const target = rect(0, 300, 80, 40); // near the left edge
    const out = computeTooltipPosition(target, VP, CARD, "below");
    expect(out.x).toBeGreaterThanOrEqual(8);
    expect(out.x + CARD.width).toBeLessThanOrEqual(VP.width - 8);
  });

  it("clamps vertically for left/right placement near the top edge", () => {
    const target = rect(600, 0, 100, 30);
    const out = computeTooltipPosition(target, VP, CARD, "right");
    expect(out.y).toBeGreaterThanOrEqual(8);
  });

  it("clamps sanely when the card is taller than the viewport", () => {
    const vp: Viewport = { width: 360, height: 240 };
    const tallCard = { width: 320, height: 400 };
    const target = rect(20, 20, 320, 40);
    const out = computeTooltipPosition(target, vp, tallCard, "below");
    // Clamped, not negative, and the card's top stays reachable.
    expect(out.y).toBeGreaterThanOrEqual(8);
    expect(out.x).toBeGreaterThanOrEqual(8);
  });
});
