"use client";

import { useEffect, useState } from "react";
import { TOUR_PAD, padRect, type Rect, type Viewport } from "@/lib/tour-geometry";

export interface TargetMeasurement {
  /** Padded, viewport-relative spotlight rect; null when the target is absent (or the step is centered). */
  rect: Rect | null;
  viewport: Viewport;
  /**
   * Bottom edge of the page's sticky header (both authed layouts render one
   * `<header class="sticky top-0 z-50 …">` as the first element; the tour
   * overlay portals to body and contains no `<header>`). Spotlight rects are
   * clamped below it so the hole never covers the navbar. 0 when absent.
   */
  topOffset: number;
}

/**
 * Measure the `[data-tour="<target>"]` element (padded by TOUR_PAD) plus the
 * viewport, and keep both in sync: window resize, any scroll (capture, so
 * inner `.overflow-x-auto` scrollers and drag-to-pan pans count), and target
 * resizes. `target: null` steps report `rect: null` (the overlay renders the
 * centered hole itself).
 *
 * All measurement happens inside rAF callbacks (never synchronously in the
 * effect body) to satisfy react-hooks/set-state-in-effect.
 */
export function useTargetRect(target: string | null, active: boolean): TargetMeasurement {
  const [measurement, setMeasurement] = useState<TargetMeasurement>({
    rect: null,
    viewport: { width: 0, height: 0 },
    topOffset: 0,
  });

  useEffect(() => {
    if (!active) return;

    let raf = 0;
    let observed: HTMLElement | null = null;
    const observer = new ResizeObserver(() => measure());

    function measure() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = target
          ? document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
          : null;
        if (el !== observed) {
          observer.disconnect();
          observed = el;
          if (el) observer.observe(el);
        }
        // Keep the header under observation too (its height drives topOffset).
        const header = document.querySelector<HTMLElement>("header");
        if (header) observer.observe(header);
        const r = el?.getBoundingClientRect();
        setMeasurement({
          rect: r ? padRect({ x: r.left, y: r.top, width: r.width, height: r.height }, TOUR_PAD) : null,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          topOffset: Math.max(0, header?.getBoundingClientRect().bottom ?? 0),
        });
      });
    }

    measure();
    window.addEventListener("resize", measure);
    document.addEventListener("scroll", measure, { capture: true, passive: true });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("scroll", measure, { capture: true });
    };
  }, [target, active]);

  return measurement;
}
