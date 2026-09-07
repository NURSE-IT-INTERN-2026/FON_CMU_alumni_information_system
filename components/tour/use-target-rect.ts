"use client";

import { useEffect, useState } from "react";
import { TOUR_PAD, padRect, type Rect, type Viewport } from "@/lib/tour-geometry";

export interface TargetMeasurement {
  /** Padded, viewport-relative spotlight rect; null when the target is absent (or the step is centered). */
  rect: Rect | null;
  viewport: Viewport;
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
        const r = el?.getBoundingClientRect();
        setMeasurement({
          rect: r ? padRect({ x: r.left, y: r.top, width: r.width, height: r.height }, TOUR_PAD) : null,
          viewport: { width: window.innerWidth, height: window.innerHeight },
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
