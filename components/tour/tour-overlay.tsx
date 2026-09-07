"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { motion, useReducedMotion } from "framer-motion";
import { useTour } from "@/components/tour/tour-provider";
import { useTargetRect } from "@/components/tour/use-target-rect";
import {
  CARD_MAX_W,
  VIEWPORT_MARGIN,
  centeredRect,
  clampRectToViewport,
  computeTooltipPosition,
} from "@/lib/tour-geometry";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Hole size for centered (target: null) steps. */
const CENTERED_HOLE = { width: 320, height: 220 };

const SPRING = { type: "spring", stiffness: 320, damping: 32 } as const;

/**
 * The tour overlay: a radix modal Dialog (focus trap/restore, Escape,
 * aria-modal, scroll lock — never a hand-rolled fixed overlay) whose transparent
 * Overlay blocks interaction, a spring-animated spotlight "hole" drawn with a
 * 9999px box-shadow dim, and the tooltip card as the Dialog content positioned
 * by lib/tour-geometry around the measured target rect.
 */
export default function TourOverlay() {
  const { status, tour, step, stepIndex, next, back, end } = useTour();
  const running = status === "running";

  // Hooks must run before the idle early-return.
  const { rect, viewport, topOffset } = useTargetRect(step?.target ?? null, status !== "idle");
  const prefersReduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const primaryBtnRef = useRef<HTMLButtonElement | null>(null);
  const [cardSize, setCardSize] = useState({ width: CARD_MAX_W, height: 220 });

  // Measure the rendered card so computeTooltipPosition can flip/clamp with
  // its real height (content length varies per step). rAF-wrapped to satisfy
  // react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!running) return;
    const el = cardRef.current;
    if (!el) return;
    let raf = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setCardSize({ width: el.offsetWidth, height: el.offsetHeight });
      });
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [running, stepIndex]);

  // Bring the target into view when the step changes (programmatic scrolls
  // still work under radix's body scroll lock; the capture-phase listener in
  // useTargetRect keeps the spotlight glued while smooth-scrolling). Targets
  // TALLER than the viewport (big tables) are NOT centered — centering pushes
  // the top (column headers) off-screen behind the sticky navbar — instead
  // their top is parked just below the navbar.
  useEffect(() => {
    if (!running || !step?.target) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) return;
    const behavior: ScrollBehavior = prefersReduced ? "auto" : "smooth";
    const header = document.querySelector<HTMLElement>("header");
    const headerBottom = Math.max(0, header?.getBoundingClientRect().bottom ?? 0);
    const r = el.getBoundingClientRect();
    const fits = r.height <= window.innerHeight - headerBottom - VIEWPORT_MARGIN * 2;
    if (fits) {
      el.scrollIntoView({ block: "center", behavior });
    } else {
      window.scrollTo({
        top: r.top + window.scrollY - headerBottom - VIEWPORT_MARGIN,
        behavior,
      });
    }
  }, [running, stepIndex, step, prefersReduced]);

  if (status === "idle" || !tour || !step) return null;

  // Hide everything until the first measurement lands (one rAF) so the card
  // never flashes at the top-left corner.
  const measured = viewport.width > 0;
  const open = running && measured;

  // Clamp the hole to the visible viewport (below the sticky header): without
  // this a tall/wide target's raw rect extends off-screen and over the navbar,
  // making the navbar fall inside the highlight hole.
  const spot = clampRectToViewport(
    rect ?? centeredRect(viewport, CENTERED_HOLE.width, CENTERED_HOLE.height),
    viewport,
    topOffset,
  );
  const pos = step.target
    ? computeTooltipPosition(spot, viewport, cardSize, step.placement ?? "below")
    : {
        x: (viewport.width - cardSize.width) / 2,
        y: (viewport.height - cardSize.height) / 2,
      };
  const isLast = stepIndex >= tour.steps.length - 1;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) end(false); // Escape / dismiss = ข้าม
      }}
    >
      <DialogPrimitive.Portal>
        {/* Click blocker (visual dim comes from the spotlight's box-shadow). */}
        <DialogPrimitive.Overlay asChild>
          <motion.div
            className="fixed inset-0 z-[60] bg-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: prefersReduced ? 0 : 0.2 }}
          />
        </DialogPrimitive.Overlay>

        {/* Spotlight hole: ring + full-viewport dim in one box-shadow. */}
        <motion.div
          aria-hidden
          className="pointer-events-none fixed z-[61] rounded-xl"
          style={{
            boxShadow:
              "0 0 0 2px var(--accent), 0 0 0 9999px rgba(0, 0, 0, 0.55)",
          }}
          initial={false}
          animate={{
            left: spot.x,
            top: spot.y,
            width: spot.width,
            height: spot.height,
          }}
          transition={prefersReduced ? { duration: 0 } : SPRING}
        />

        <DialogPrimitive.Content asChild
          onOpenAutoFocus={(e) => {
            // Focus the primary action, not the first tabbable (ข้าม).
            e.preventDefault();
            primaryBtnRef.current?.focus();
          }}
          onInteractOutside={(e) => {
            // Stray clicks on the dim must not end the tour — Escape / ข้าม only.
            e.preventDefault();
          }}
        >
          <motion.div
            ref={cardRef}
            className="fixed left-0 top-0 z-[70] w-[min(340px,calc(100vw-2rem))] rounded-xl border bg-background p-4 text-foreground shadow-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, x: pos.x, y: pos.y }}
            transition={
              prefersReduced
                ? { duration: 0 }
                : { opacity: { duration: 0.2 }, x: SPRING, y: SPRING }
            }
          >
            <motion.div
              key={stepIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReduced ? 0 : 0.18 }}
            >
              <p className="text-xs font-medium text-muted-foreground">
                ขั้นที่ {stepIndex + 1}/{tour.steps.length}
              </p>
              <DialogPrimitive.Title className="mt-1 text-sm font-bold text-primary">
                {step.title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </DialogPrimitive.Description>
            </motion.div>

            {/* Progress dots */}
            <div className="mt-3 flex items-center gap-1.5" aria-hidden>
              {tour.steps.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    i === stepIndex
                      ? "bg-primary"
                      : i < stepIndex
                        ? "bg-primary/40"
                        : "bg-muted",
                  )}
                />
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => end(false)}
              >
                ข้าม
              </Button>
              <span className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={back}
                disabled={stepIndex <= 0}
              >
                ก่อนหน้า
              </Button>
              <Button ref={primaryBtnRef} size="sm" onClick={next}>
                {isLast ? "เสร็จสิ้น" : "ถัดไป"}
              </Button>
            </div>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
