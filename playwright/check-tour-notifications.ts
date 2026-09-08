/**
 * Walks the `alumni-notifications` product tour end-to-end on the real page:
 * starts it via the header 'i' button, steps through every step (including the
 * conditional "ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว" step, which only mounts when the
 * account has ≥1 UNREAD notification), and asserts the overlay closes on
 * เสร็จสิ้น. Screenshots land in /tmp/tour-notifications-step-<n>.png.
 *
 * Prereq: the account has ≥1 unread notification. Seed one if needed (dev DB):
 *   INSERT INTO notifications (id, "alumniId", type, title, "readAt", "createdAt")
 *   SELECT gen_random_uuid(), id, 'LIKE_ON_MY_POST', 'ทดสอบทัวร์', NULL, now()
 *   FROM alumni WHERE email = 'forum-test@fon-cmu.local';
 *
 *   npx tsx playwright/check-tour-notifications.ts
 *   # ALUMNI_EMAIL/ALUMNI_PASSWORD override creds (defaults: forum-test account)
 */
import { alumniSession } from "./auth";
import { TOUR_PAD } from "../lib/tour-geometry"; // spotlight inflates target rects by this pad per side

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const results: [string, boolean][] = [];
const ok = (n: string) => { results.push([n, true]); console.log("  ✓", n); };
const bad = (n: string, d = "") => { results.push([n, false]); console.log("  ✗", n, d); };

// Step titles from the `alumni-notifications` TourDefinition (lib/tours.ts)
const STEP_TITLES = ["การแจ้งเตือน", "ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว", "รายการแจ้งเตือน", "พร้อมใช้งานแล้ว"];
// data-tour target ids per step (null = centered closing card) — mirrors the definition.
const STEP_TARGETS: (string | null)[] = ["notifications-heading", "notifications-mark-all", "notifications-list", null];

interface Box { x: number; y: number; w: number; h: number }

/** Reads the spotlight hole (inline box-shadow div), the target element, the tooltip card, in-page. */
async function readGeometry(page: import("playwright").Page, targetSel: string | null): Promise<{
  hole: Box | null; target: Box | null; card: Box | null; vw: number; vh: number;
}> {
  // NOTE: no inner functions in the evaluate callback — tsx/esbuild `keepNames`
  // injects __name() calls around inner function definitions, which then don't
  // exist in the browser context.
  const raw = await page.evaluate((sel: string | null) => {
    const divs = document.querySelectorAll("div");
    let hole: DOMRect | null = null;
    for (let i = 0; i < divs.length; i++) {
      const d = divs[i] as HTMLElement;
      if ((d.style.boxShadow || "").indexOf("9999px") !== -1) { hole = d.getBoundingClientRect(); break; }
    }
    const cardEl = document.querySelector('[role="dialog"]');
    const targetEl = sel ? document.querySelector(sel) : null;
    return {
      hole: hole ? { x: hole.x, y: hole.y, width: hole.width, height: hole.height } : null,
      target: targetEl ? (() => { const r = targetEl.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })() : null,
      card: cardEl ? (() => { const r = cardEl.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })() : null,
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  }, targetSel);
  const box = (r: { x: number; y: number; width: number; height: number } | null): Box | null =>
    r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
  return { hole: box(raw.hole), target: box(raw.target), card: box(raw.card), vw: raw.vw, vh: raw.vh };
}

/** mm-style helpers over Box */
const center = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
/** Intrusion depth (px) of card into hole along each axis (0 when disjoint). */
const overlapDepth = (a: Box, b: Box) => ({
  w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)),
  h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)),
});

async function main() {
  const creds = {
    email: process.env.ALUMNI_EMAIL ?? "forum-test@fon-cmu.local",
    password: process.env.ALUMNI_PASSWORD ?? "Test1234!",
  };
  const { browser, page } = await alumniSession(creds);
  const clientErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") clientErrors.push(m.text()); });
  page.on("pageerror", (e) => clientErrors.push("pageerror: " + e.message));

  try {
    console.log("\n[1] Notifications page renders with unread state + 'i' tour button");
    await page.goto(`${BASE}/alumni/graduates/notifications`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('h1[data-tour="notifications-heading"]', { timeout: 15000 });
    ok("notifications page rendered");

    const unreadBadge = page.locator("h1").filter({ hasText: "ที่ยังไม่ได้อ่าน" });
    // Wait — the h1 mounts before the notifications query resolves (badge gated on unreadCount).
    try {
      await unreadBadge.first().waitFor({ state: "visible", timeout: 10000 });
      ok("unread badge present (mark-all step will mount)");
    } catch {
      bad("no unread notifications — step 'ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว' will be skipped", "seed one unread row");
    }

    const iBtn = page.locator('button[aria-label="คำแนะนำการใช้งานหน้านี้"]');
    if (await iBtn.isVisible()) ok("'i' (คำแนะนำการใช้งาน) button visible");
    else bad("'i' button not visible", "tours are desktop-only (lg:) — run at a desktop viewport");

    console.log("\n[2] Walk all 4 tour steps (card + spotlight geometry)");
    await iBtn.click();
    for (let i = 0; i < STEP_TITLES.length; i++) {
      const isLast = i === STEP_TITLES.length - 1;
      const card = page.getByRole("dialog").filter({ hasText: STEP_TITLES[i] });
      try {
        // Engine waits up to 8s for step 0's target (react-query isPending) — match that.
        await card.first().waitFor({ state: "visible", timeout: 8000 });
        ok(`step ${i + 1}/4 card shows "${STEP_TITLES[i]}"`);
      } catch {
        bad(`step ${i + 1}/4 card "${STEP_TITLES[i]}" never appeared`, "target never mounted (step skipped?)");
        break; // further steps are unreachable — stop walking
      }
      // Let the spotlight spring settle before measuring/shooting.
      await page.waitForTimeout(700);

      // Geometry: hole must frame the target, inflated by the engine's TOUR_PAD
      // per side (lib/tour-geometry.ts), or be the centered 320×220 halo behind
      // the closing card (CENTERED_HOLE, tour-overlay.tsx) on the null step.
      const g = await readGeometry(page, STEP_TARGETS[i] ? `[data-tour="${STEP_TARGETS[i]}"]` : null);
      if (!g.hole) {
        bad(`step ${i + 1}/4 spotlight hole not found in DOM`);
      } else if (STEP_TARGETS[i] && g.target) {
        const t = g.target;
        const expected = { x: t.x - TOUR_PAD, y: t.y - TOUR_PAD, w: t.w + TOUR_PAD * 2, h: t.h + TOUR_PAD * 2 };
        const fits =
          near(g.hole.x, expected.x, 2) && near(g.hole.y, expected.y, 2) &&
          near(g.hole.w, expected.w, 4) && near(g.hole.h, expected.h, 4);
        if (fits) {
          ok(`step ${i + 1}/4 spotlight frames [${STEP_TARGETS[i]}] +${TOUR_PAD}px pad (hole ${Math.round(g.hole.w)}×${Math.round(g.hole.h)} @ ${Math.round(g.hole.x)},${Math.round(g.hole.y)})`);
        } else {
          bad(`step ${i + 1}/4 spotlight MISALIGNED on [${STEP_TARGETS[i]}]`,
            `hole ${JSON.stringify(g.hole)} vs expected ${JSON.stringify(expected)} (target ${JSON.stringify(t)})`);
        }
      } else if (!STEP_TARGETS[i]) {
        // CENTERED_HOLE = 320×220 (components/tour/tour-overlay.tsx); the card floats over it (z-70 > z-61) by design.
        const hc = center(g.hole);
        if (near(hc.x, g.vw / 2, 24) && near(hc.y, g.vh / 2, 24) && near(g.hole.w, 320, 8) && near(g.hole.h, 220, 8)) {
          ok("step 4/4 closing hole is the centered 320×220 halo");
        } else {
          bad("step 4/4 closing hole not the centered halo", `hole ${JSON.stringify(g.hole)} viewport ${g.vw}×${g.vh}`);
        }
      }
      if (g.hole && g.card && STEP_TARGETS[i]) {
        // Card-overlap only matters on targeted steps — the null step's card sits on its halo intentionally.
        const ov = overlapDepth(g.card, g.hole);
        if (ov.w <= 6 || ov.h <= 6) ok(`step ${i + 1}/4 tooltip card clear of the hole (intrusion ${Math.round(ov.w)}×${Math.round(ov.h)}px)`);
        else bad(`step ${i + 1}/4 tooltip card OVERLAPS the spotlight hole`, `intrusion ${Math.round(ov.w)}×${Math.round(ov.h)}px`);
      }

      await page.screenshot({ path: `/tmp/tour-notifications-step-${i}.png` });
      await page.getByRole("dialog").getByRole("button", { name: isLast ? "เสร็จสิ้น" : "ถัดไป" }).click();
    }

    console.log("\n[3] Overlay closed after เสร็จสิ้น");
    await page.waitForTimeout(400); // exit transition
    const stillOpen = await page.getByRole("dialog").isVisible().catch(() => false);
    if (!stillOpen) ok("tour overlay closed");
    else bad("tour overlay still open after เสร็จสิ้น");

    console.log("\n[4] Client console errors");
    const real = clientErrors.filter((e) => !/favicon|404|Failed to load resource/i.test(e));
    if (real.length === 0) ok("no client console errors / uncaught exceptions");
    else bad("client console errors", JSON.stringify(real, null, 2));
  } catch (e) {
    bad("THREW", (e as Error).message);
    await page.screenshot({ path: "playwright/check-tour-notifications-fail.png", fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  console.log("\n================ SUMMARY ================");
  const pass = results.filter(([, p]) => p).length;
  console.log(`${pass}/${results.length} checks passed`);
  process.exit(results.every(([, p]) => p) ? 0 : 1);
}

main();
