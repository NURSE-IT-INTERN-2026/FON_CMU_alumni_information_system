// @vitest-environment happy-dom
// End-to-end runtime test for the product-tour engine: TourProvider + the
// radix/framer overlay. Renders every step target of the alumni-profile tour
// so each advance resolves without hitting the skip timeout.
//
// NOT covered here (happy-dom + radix Escape is documented-flaky — verified
// manually in the browser): Escape-to-skip, focus restore, scrollIntoView.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { TourProvider, useTour } from "@/components/tour/tour-provider";
import { TOURS } from "@/lib/tours";

vi.mock("next/navigation", () => ({
  usePathname: () => "/graduates/profile",
}));

// CONTRACT: this harness renders TOURS[0] — `alumni-profile` must remain the
// registry's FIRST entry (lib/tours.ts) even as the alumni block is reordered.

function HarnessInner({ omitTarget }: { omitTarget?: string }) {
  const { start } = useTour();
  return (
    <>
      <button onClick={() => start("alumni-profile")}>start-tour</button>
      {TOURS[0].steps
        .filter((s) => s.target !== null && s.target !== omitTarget)
        .map((s) => (
          <div key={s.target} data-tour={s.target as string}>
            {s.target}
          </div>
        ))}
    </>
  );
}

function Harness({ omitTarget }: { omitTarget?: string }) {
  return (
    <TourProvider area="alumni" userId="test-user-1">
      <HarnessInner omitTarget={omitTarget} />
    </TourProvider>
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("product tour runtime", () => {
  it("opens the overlay on start() with the first step content", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("start-tour"));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(screen.getByText("ข้อมูลส่วนตัวของท่าน")).toBeTruthy();
    expect(screen.getByText(/ขั้นที่ 1\/7/)).toBeTruthy();
  });

  it("advances through ถัดไป / ก่อนหน้า and keeps the footer state consistent", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("start-tour"));
    await screen.findByRole("dialog");

    // ก่อนหน้า disabled on the first step.
    expect((screen.getByText("ก่อนหน้า") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByText("ถัดไป"));
    await waitFor(() => expect(screen.getByText("ปุ่มแก้ไข")).toBeTruthy());
    expect(screen.getByText(/ขั้นที่ 2\/7/)).toBeTruthy();
    expect((screen.getByText("ก่อนหน้า") as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByText("ก่อนหน้า"));
    await waitFor(() => expect(screen.getByText("ข้อมูลส่วนตัวของท่าน")).toBeTruthy());
  });

  it("drops absent-target steps at start and renumbers the walk (adaptive step count)", async () => {
    // Omit registry step 1's target (alumni-profile-edit) → 7-step tour walks as 6.
    // The waitFor's default 1s timeout doubles as the no-stall tripwire: the old
    // engine burned DEFAULT_STEP_WAIT_MS (3000ms) skipping an absent step.
    render(<Harness omitTarget="alumni-profile-edit" />);
    fireEvent.click(screen.getByText("start-tour"));

    const dialog = await screen.findByRole("dialog");
    expect(screen.getByText(/ขั้นที่ 1\/6/)).toBeTruthy();
    expect(dialog.querySelectorAll("span.rounded-full")).toHaveLength(6); // progress dots

    fireEvent.click(screen.getByText("ถัดไป"));
    // Registry step 2 is the next card — the absent step was DROPPED, not skipped
    // (a skip would show "ขั้นที่ 3/7" and stall 3s first).
    await waitFor(() => expect(screen.getByText(/ขั้นที่ 2\/6/)).toBeTruthy());
    expect(screen.getByText("ข้อมูลส่วนตัว")).toBeTruthy();

    // Walk to the end: closing card is numbered last and still completes the tour.
    for (let i = 2; i < 6; i++) {
      fireEvent.click(screen.getByText("ถัดไป"));
      if (i < 5) {
        const stepLabel = new RegExp(`ขั้นที่ ${i + 1}/6`);
        await waitFor(() => expect(screen.getByText(stepLabel)).toBeTruthy());
      }
    }
    await waitFor(() => expect(screen.getByText("เสร็จสิ้น")).toBeTruthy());
    fireEvent.click(screen.getByText("เสร็จสิ้น"));
    await waitFor(() =>
      expect(window.localStorage.getItem("tour-completed:alumni-profile:test-user-1")).toBe("true"),
    );
  });

  it("records completion in localStorage when the last step's เสร็จสิ้น is clicked, and ข้าม does not", async () => {
    const last = TOURS[0].steps.length - 1;
    for (let run = 0; run < 2; run++) {
      render(<Harness />);
      fireEvent.click(screen.getByText("start-tour"));
      await screen.findByRole("dialog");

      for (let i = 0; i < last; i++) {
        fireEvent.click(screen.getByText("ถัดไป"));
        // Wait for the step to land before clicking again (targets resolve
        // asynchronously via the rAF availability poll). NOTE: a regex literal
        // does NOT interpolate — build the pattern with new RegExp.
        const stepLabel = new RegExp(`ขั้นที่ ${i + 2}/7`);
        await waitFor(() => expect(screen.getByText(stepLabel)).toBeTruthy());
      }
      await waitFor(() => expect(screen.getByText("เสร็จสิ้น")).toBeTruthy());

      if (run === 0) {
        fireEvent.click(screen.getByText("เสร็จสิ้น"));
        await waitFor(() =>
          expect(window.localStorage.getItem("tour-completed:alumni-profile:test-user-1")).toBe("true"),
        );
        // Overlay is gone.
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      } else {
        fireEvent.click(screen.getByText("ข้าม"));
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        expect(window.localStorage.getItem("tour-completed:alumni-profile:test-user-1")).toBeNull();
      }
      cleanup();
      window.localStorage.clear();
    }
  });
});
