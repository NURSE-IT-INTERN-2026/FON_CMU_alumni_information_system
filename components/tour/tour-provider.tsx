"use client";

import { createContext, useContext, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { toast } from "sonner";
import { TOURS, tourForPath, type TourArea, type TourDefinition, type TourStep } from "@/lib/tours";
import { markTourCompleted } from "@/lib/tour-storage";
import { useRole } from "@/lib/role-context";
import TourOverlay from "@/components/tour/tour-overlay";

export type TourStatus = "idle" | "starting" | "running";

export interface TourContextValue {
  area: TourArea;
  isActive: boolean;
  tour: TourDefinition | null;
  /** Index into tour.steps; -1 while idle/starting. */
  stepIndex: number;
  step: TourStep | null;
  status: TourStatus;
  start(tourId?: string): void;
  next(): void;
  back(): void;
  goTo(index: number): void;
  /** completed=true (finished the last step) records completion; false = ข้าม. */
  end(completed: boolean): void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside <TourProvider>");
  return ctx;
}

/** Default patience for the FIRST step's target (covers react-query isPending). */
const DEFAULT_START_WAIT_MS = 8000;
/** Default patience when advancing to a step. */
const DEFAULT_STEP_WAIT_MS = 3000;

function isStepReady(step: TourStep): boolean {
  if (step.target === null) return true;
  return document.querySelector(`[data-tour="${step.target}"]`) !== null;
}

/** Poll via rAF until the step's target exists or the timeout elapses. */
function waitForStep(step: TourStep, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const tick = () => {
      if (isStepReady(step)) return resolve(true);
      if (performance.now() - startedAt >= timeoutMs) return resolve(false);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

interface TourProviderProps {
  area: TourArea;
  /** Alumni: the alum's id (completion flag scope). Admin: omitted — the role scopes it. */
  userId?: string;
  children: React.ReactNode;
}

export function TourProvider({ area, userId, children }: TourProviderProps) {
  const pathname = usePathname();
  const role = useRole(); // defaults to "admin" outside RoleProvider; only used as the admin-side scope
  const scope = userId ?? role;

  const [status, setStatus] = useState<TourStatus>("idle");
  const [tour, setTour] = useState<TourDefinition | null>(null);
  const [stepIndex, setStepIndex] = useState(-1);

  // Guards async waits against a newer start()/end() invalidating them.
  const runToken = useRef(0);

  function end(completed: boolean) {
    runToken.current += 1;
    if (completed && tour) markTourCompleted(tour.id, scope);
    setStatus("idle");
    setTour(null);
    setStepIndex(-1);
  }

  function start(tourId?: string) {
    const next =
      (tourId ? TOURS.find((t) => t.id === tourId && t.area === area) : undefined) ??
      tourForPath(area, pathname);
    if (!next) {
      toast.info("ยังไม่มีคำแนะนำสำหรับหน้านี้");
      return;
    }

    const token = ++runToken.current;
    setStatus("starting");
    setTour(next);
    setStepIndex(-1);

    // Wait for the first step's target (pages load data async), then open.
    void (async () => {
      const first = next.steps[0];
      const startWait = Math.max(DEFAULT_START_WAIT_MS, first.waitFor ?? 0);
      await waitForStep(first, startWait);
      if (token !== runToken.current) return;

      // Drop steps whose targets are absent at open and run the walk on a
      // filtered clone — the overlay's counter/dots/isLast all read
      // tour.steps, so numbering adapts and dropped steps cost no wait.
      // target:null steps are always kept (closing card / advance() fallback);
      // the waitFor-skip in advance() remains the mid-walk-unmount fallback.
      const active: TourDefinition = { ...next, steps: next.steps.filter(isStepReady) };
      if (!active.steps.some((s) => s.target !== null)) {
        // No targeted step ever mounted — don't run a closing-card-only tour.
        toast.info("ยังไม่มีเนื้อหาให้แนะนำในหน้านี้ โปรดลองอีกครั้งเมื่อข้อมูลโหลดเสร็จ");
        setStatus("idle");
        setTour(null);
        return;
      }
      setTour(active);
      setStepIndex(0);
      setStatus("running");
    })();
  }

  /** Walk in `dir` from `from`: wait for the immediate next step, then skip absent ones; fall back to a centered step. */
  function advance(from: number, dir: 1 | -1) {
    if (!tour) return;
    const token = ++runToken.current;

    void (async () => {
      let i = from + dir;
      if (i >= 0 && i < tour.steps.length) {
        const ok = await waitForStep(tour.steps[i], tour.steps[i].waitFor ?? DEFAULT_STEP_WAIT_MS);
        if (token !== runToken.current) return;
        if (ok) {
          setStepIndex(i);
          return;
        }
        // Timed out — skip absent steps without further waiting.
        i += dir;
        while (i >= 0 && i < tour.steps.length) {
          if (isStepReady(tour.steps[i])) {
            setStepIndex(i);
            return;
          }
          i += dir;
        }
      }
      // Nothing available in that direction — land on a centered step
      // (forward: the closing card; backward: the intro-ish first one).
      const fallback =
        dir === 1
          ? tour.steps.map((s) => s.target).lastIndexOf(null)
          : tour.steps.findIndex((s) => s.target === null);
      if (fallback !== -1) setStepIndex(fallback);
    })();
  }

  function next() {
    if (!tour || status !== "running") return;
    if (stepIndex >= tour.steps.length - 1) {
      end(true);
      return;
    }
    advance(stepIndex, 1);
  }

  function back() {
    if (!tour || status !== "running" || stepIndex <= 0) return;
    advance(stepIndex, -1);
  }

  function goTo(index: number) {
    if (!tour || status !== "running") return;
    const clamped = Math.max(0, Math.min(tour.steps.length - 1, index));
    if (isStepReady(tour.steps[clamped])) {
      runToken.current += 1;
      setStepIndex(clamped);
      return;
    }
    advance(clamped - 1, 1);
  }

  return (
    <TourContext.Provider
      value={{
        area,
        isActive: status !== "idle",
        tour,
        stepIndex,
        step: tour && stepIndex >= 0 ? tour.steps[stepIndex] : null,
        status,
        start,
        next,
        back,
        goTo,
        end,
      }}
    >
      <MotionConfig reducedMotion="user">
        {children}
        <TourOverlay />
      </MotionConfig>
    </TourContext.Provider>
  );
}
