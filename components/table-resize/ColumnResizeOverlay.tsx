"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ColResizeHandle } from "./ColResizeHandle";

/** The slice of the resize hook the overlay needs. */
export type ResizeApi = {
  widths: Record<string, number>;
  isSuperAdmin: boolean;
  startResize: (i: number) => (e: React.PointerEvent<HTMLDivElement>) => void;
  resetColumn: (i: number) => void;
};

type HandlePos = { left: number; height: number; index: number };

/**
 * Floats a drag grip over every header-cell's right border (the column divider).
 * Re-measures on scroll, resize, and whenever widths change, so grips stay glued
 * to the dividers as columns grow/shrink and as the table scrolls horizontally.
 *
 * Positioned absolutely against the table's scroll container — that container
 * must be `position: relative` (pages add `relative` to the `overflow-x-auto`
 * div) and the overlay must be rendered inside it (sibling of the `<table>`).
 */
export function ColumnResizeOverlay({
  tableRef,
  resize,
}: {
  tableRef: React.RefObject<HTMLTableElement | null>;
  resize: ResizeApi;
}) {
  const [positions, setPositions] = useState<HandlePos[]>([]);
  const rafRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const table = tableRef.current;
    if (!table) return;
    const container = table.parentElement; // the overflow-x-auto scroll container
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const ths = table.querySelectorAll<HTMLTableCellElement>("thead th");
    if (ths.length === 0) {
      setPositions([]);
      return;
    }
    let height = 0;
    const pos: HandlePos[] = [];
    ths.forEach((th, index) => {
      const r = th.getBoundingClientRect();
      height = Math.max(height, r.height);
      pos.push({ left: r.right - cRect.left, height: r.height, index });
    });
    setPositions(pos.map((p) => ({ ...p, height })));
  }, [tableRef]);

  // rAF-throttled re-measure (scroll/resize fire many times per second).
  const scheduleMeasure = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      measure();
    });
  }, [measure]);

  // Re-measure after a width change lands in the DOM (handles follow the divider).
  useLayoutEffect(() => {
    if (!resize.isSuperAdmin) return;
    measure();
  }, [measure, resize.widths, resize.isSuperAdmin]);

  // Track horizontal scroll + container/table resize (superadmins only — others
  // can't resize, so skip the observers entirely).
  useEffect(() => {
    if (!resize.isSuperAdmin) return;
    const table = tableRef.current;
    if (!table) return;
    const container = table.parentElement;
    if (!container) return;
    const onScrollOrResize = () => scheduleMeasure();
    container.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    const ro = new ResizeObserver(() => scheduleMeasure());
    ro.observe(container);
    ro.observe(table);
    return () => {
      container.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      ro.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [tableRef, scheduleMeasure, resize.isSuperAdmin]);

  if (!resize.isSuperAdmin || positions.length === 0) return null;

  return (
    <div className="pointer-events-none absolute left-0 top-0 z-20">
      {positions.map((p) => (
        <div
          key={p.index}
          className="pointer-events-auto absolute"
          style={{
            left: p.left,
            top: 0,
            height: p.height,
            width: 10,
            transform: "translateX(-50%)",
          }}
        >
          <ColResizeHandle
            onPointerDown={resize.startResize(p.index)}
            onReset={() => resize.resetColumn(p.index)}
          />
        </div>
      ))}
    </div>
  );
}
