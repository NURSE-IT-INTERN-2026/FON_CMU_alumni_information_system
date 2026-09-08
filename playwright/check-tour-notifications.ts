/**
 * Walks the `alumni-notifications` product tour end-to-end on the real page,
 * for BOTH step-count paths of the adaptive engine:
 *   - forum-test2 (0 notifications)  → mark-all target absent → 3 steps, 1/3–3/3, no stall
 *   - forum-test  (1 unread, seeded) → 4 steps, 1/4–4/4
 * Asserts each card's exact counter text (ขั้นที่ X/N), the spotlight geometry
 * (hole = target + TOUR_PAD per side; closing step = centered 320×220 halo),
 * card/hole non-overlap on targeted steps, overlay close on เสร็จสิ้น, and — on
 * the 3-step path — that the first advance does NOT stall (pre-fix: the absent
 * mark-all target burned a 3000ms skip-wait).
 * Screenshots land in /tmp/tour-notifications-<tag>-step-<n>.png.
 *
 * Prereq: forum-test@fon-cmu.local has ≥1 UNREAD notification. Seed one (dev DB):
 *   INSERT INTO notifications (id, "alumniId", type, title, "readAt", "createdAt")
 *   SELECT gen_random_uuid(), id, 'LIKE_ON_MY_POST', 'ทดสอบทัวร์', NULL, now()
 *   FROM alumni WHERE email = 'forum-test@fon-cmu.local';
 *
 *   npx tsx playwright/check-tour-notifications.ts
 *   # ALUMNI_PASSWORD overrides both accounts' password (default Test1234!)
 */
import { alumniSession } from "./auth";
import type { Page } from "playwright";
import { TOUR_PAD } from "../lib/tour-geometry"; // spotlight inflates target rects by this pad per side

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const PASSWORD = process.env.ALUMNI_PASSWORD ?? "Test1234!";
const results: [string, boolean][] = [];
const ok = (n: string) => { results.push([n, true]); console.log("  ✓", n); };
const bad = (n: string, d = "") => { results.push([n, false]); console.log("  ✗", n, d); };

// Full declared walk (lib/tours.ts) — the mark-all step (index 1) is dropped
// from the expected walk when its target is absent at open.
const STEP_TITLES = ["การแจ้งเตือน", "ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว", "รายการแจ้งเตือน", "พร้อมใช้งานแล้ว"];
const STEP_TARGETS: (string | null)[] = ["notifications-heading", "notifications-mark-all", "notifications-list", null];

interface Box { x: number; y: number; w: number; h: number }

/** Reads the spotlight hole (inline box-shadow div), the target element, the tooltip card, in-page. */
async function readGeometry(page: Page, targetSel: string | null): Promise<{
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

const ACCOUNTS: { tag: string; email: string; expectMarkAll: boolean }[] = [
  { tag: "no-unread", email: "forum-test2@fon-cmu.local", expectMarkAll: false }, // 0 notifications → 3 steps
  { tag: "unread", email: "forum-test@fon-cmu.local", expectMarkAll: true }, // 1 unread (seeded) → 4 steps
];

async function runAccount(tag: string, email: string, expectMarkAll: boolean) {
  console.log(`\n=== ${tag}: ${email} (expect ${expectMarkAll ? 4 : 3} steps) ===`);
  const { browser, page } = await alumniSession({ email, password: PASSWORD });
  const clientErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") clientErrors.push(m.text()); });
  page.on("pageerror", (e) => clientErrors.push("pageerror: " + e.message));

  try {
    console.log("\n[1] Notifications page renders; settle the query before opening the tour");
    await page.goto(`${BASE}/alumni/graduates/notifications`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('h1[data-tour="notifications-heading"]', { timeout: 15000 });
    // Settle: the list target exists (loading/empty/loaded branch) and no spinner remains.
    await page.waitForFunction(
      `document.querySelector('[data-tour="notifications-list"]') !== null &&
       document.querySelector('[data-tour="notifications-list"] .animate-spin') === null`,
      undefined,
      { timeout: 15000 },
    );
    ok("notifications page rendered + query settled");

    const markAllMounted = await page.locator('[data-tour="notifications-mark-all"]').isVisible();
    if (markAllMounted === expectMarkAll) {
      ok(`mark-all target ${markAllMounted ? "present" : "absent"} as expected`);
    } else {
      bad("mark-all target state mismatch",
        `expected ${expectMarkAll ? "mounted" : "absent"} — check the account's unread notifications`);
    }
    // Walk the steps that actually exist (reality wins so geometry checks still run).
    const titles = markAllMounted ? STEP_TITLES : STEP_TITLES.toSpliced(1, 1);
    const targets = markAllMounted ? STEP_TARGETS : STEP_TARGETS.toSpliced(1, 1);
    const N = titles.length;

    const iBtn = page.locator('button[aria-label="คำแนะนำการใช้งานหน้านี้"]');
    if (await iBtn.isVisible()) ok("'i' (คำแนะนำการใช้งาน) button visible");
    else bad("'i' button not visible", "tours are desktop-only (lg:) — run at a desktop viewport");

    console.log(`\n[2] Walk all ${N} tour steps (counter + spotlight geometry)`);
    await iBtn.click();
    for (let i = 0; i < titles.length; i++) {
      const isLast = i === N - 1;
      const card = page.getByRole("dialog").filter({ hasText: titles[i] });
      try {
        // Engine waits up to 8s for step 0's target (react-query isPending) — match that.
        await card.first().waitFor({ state: "visible", timeout: 8000 });
        ok(`step ${i + 1}/${N} card shows "${titles[i]}"`);
      } catch {
        bad(`step ${i + 1}/${N} card "${titles[i]}" never appeared`, "target never mounted (step skipped?)");
        break; // further steps are unreachable — stop walking
      }
      try {
        await page.getByRole("dialog").getByText(`ขั้นที่ ${i + 1}/${N}`, { exact: true }).waitFor({ state: "visible", timeout: 1500 });
        ok(`step counter reads exactly ขั้นที่ ${i + 1}/${N}`);
      } catch {
        const txt = await page.getByRole("dialog").innerText().catch(() => "");
        bad(`step counter is NOT ขั้นที่ ${i + 1}/${N}`, `dialog text: ${txt.replace(/\n/g, " | ").slice(0, 160)}`);
      }

      // Let the spotlight spring settle before measuring/shooting.
      await page.waitForTimeout(700);

      // Geometry: hole must frame the target, inflated by the engine's TOUR_PAD
      // per side (lib/tour-geometry.ts), or be the centered 320×220 halo behind
      // the closing card (CENTERED_HOLE, tour-overlay.tsx) on the null step.
      const g = await readGeometry(page, targets[i] ? `[data-tour="${targets[i]}"]` : null);
      if (!g.hole) {
        bad(`step ${i + 1}/${N} spotlight hole not found in DOM`);
      } else if (targets[i] && g.target) {
        const t = g.target;
        const expected = { x: t.x - TOUR_PAD, y: t.y - TOUR_PAD, w: t.w + TOUR_PAD * 2, h: t.h + TOUR_PAD * 2 };
        const fits =
          near(g.hole.x, expected.x, 2) && near(g.hole.y, expected.y, 2) &&
          near(g.hole.w, expected.w, 4) && near(g.hole.h, expected.h, 4);
        if (fits) {
          ok(`step ${i + 1}/${N} spotlight frames [${targets[i]}] +${TOUR_PAD}px pad`);
        } else {
          bad(`step ${i + 1}/${N} spotlight MISALIGNED on [${targets[i]}]`,
            `hole ${JSON.stringify(g.hole)} vs expected ${JSON.stringify(expected)} (target ${JSON.stringify(t)})`);
        }
      } else if (!targets[i]) {
        // CENTERED_HOLE = 320×220 (components/tour/tour-overlay.tsx); the card floats over it (z-70 > z-61) by design.
        const hc = center(g.hole);
        if (near(hc.x, g.vw / 2, 24) && near(hc.y, g.vh / 2, 24) && near(g.hole.w, 320, 8) && near(g.hole.h, 220, 8)) {
          ok(`step ${i + 1}/${N} closing hole is the centered 320×220 halo`);
        } else {
          bad(`step ${i + 1}/${N} closing hole not the centered halo`, `hole ${JSON.stringify(g.hole)} viewport ${g.vw}×${g.vh}`);
        }
      }
      if (g.hole && g.card && targets[i]) {
        // Card-overlap only matters on targeted steps — the null step's card sits on its halo intentionally.
        const ov = overlapDepth(g.card, g.hole);
        if (ov.w <= 6 || ov.h <= 6) ok(`step ${i + 1}/${N} tooltip card clear of the hole`);
        else bad(`step ${i + 1}/${N} tooltip card OVERLAPS the spotlight hole`, `intrusion ${Math.round(ov.w)}×${Math.round(ov.h)}px`);
      }

      await page.screenshot({ path: `/tmp/tour-notifications-${tag}-step-${i}.png` });

      if (i === 0 && !markAllMounted) {
        // No-stall tripwire on the exact old stall: first advance past the ABSENT
        // mark-all target used to burn DEFAULT_STEP_WAIT_MS (3000ms). Card 2's
        // counter/geometry checks happen on the next loop iteration as usual.
        const t0 = Date.now();
        await page.getByRole("dialog").getByRole("button", { name: "ถัดไป" }).click();
        await page.getByRole("dialog").getByText(`ขั้นที่ 2/${N}`, { exact: true }).waitFor({ state: "visible", timeout: 2000 });
        const dt = Date.now() - t0;
        if (dt < 1500) ok(`no stall: card 2/${N} in ${dt}ms (pre-fix ≈3000ms)`);
        else bad(`stall persists: card 2/${N} took ${dt}ms`, "expected <1500ms");
        continue; // already advanced — skip the loop-bottom ถัดไป click
      }
      await page.getByRole("dialog").getByRole("button", { name: isLast ? "เสร็จสิ้น" : "ถัดไป" }).click();
    }

    console.log("\n[3] Overlay closed after เสร็จสิ้น");
    await page.waitForTimeout(400); // exit transition
    const stillOpen = await page.getByRole("dialog").isVisible().catch(() => false);
    if (!stillOpen) ok("tour overlay closed");
    else bad("tour overlay still open after เสร็จสิ้น");

    const real = clientErrors.filter((e) => !/favicon|404|Failed to load resource/i.test(e));
    if (real.length === 0) ok("no client console errors / uncaught exceptions");
    else bad("client console errors", JSON.stringify(real, null, 2));
  } catch (e) {
    bad(`[${tag}] THREW`, (e as Error).message);
    await page.screenshot({ path: `playwright/check-tour-notifications-${tag}-fail.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
}

async function main() {
  for (const a of ACCOUNTS) await runAccount(a.tag, a.email, a.expectMarkAll);

  console.log("\n================ SUMMARY ================");
  const pass = results.filter(([, p]) => p).length;
  console.log(`${pass}/${results.length} checks passed`);
  process.exit(results.every(([, p]) => p) ? 0 : 1);
}

main();
