/**
 * Per-page TanStack Query check for the associations page.
 * Proves: useEntityList renders, refetch on query-key change (search), and
 * mutation invalidation (UI delete -> list refetch). No real data is harmed —
 * a throwaway association is created (tied to a real alumni) then soft-deleted.
 */
import { adminSession } from "./auth";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const MARKER = `__RQ_ASSOC_${Date.now()}__`;

const results: [string, boolean][] = [];
const ok = (n: string) => { results.push([n, true]); console.log("  ✓", n); };
const bad = (n: string, d = "") => { results.push([n, false]); console.log("  ✗", n, d); };

async function main() {
  const { browser, page } = await adminSession();
  const clientErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") clientErrors.push(m.text()); });
  page.on("pageerror", (e) => clientErrors.push("pageerror: " + e.message));

  try {
    // 1) Need a real alumni studentId (FK). Grab one via the API.
    const alumniRes = await page.request.get(`${BASE}/alumni/api/alumni?pageSize=1`);
    const alumniJson = await alumniRes.json();
    const studentId: string | undefined = alumniJson?.data?.[0]?.studentId;
    const fullName: string = alumniJson?.data?.[0]
      ? `${alumniJson.data[0].prefix ?? ""}${alumniJson.data[0].firstName ?? ""} ${alumniJson.data[0].maidenLastName ?? ""}`.trim()
      : "ทดสอบ ระบบ";

    console.log("\n[1] Render (useEntityList fetch + render)");
    await page.goto(`${BASE}/alumni/management/associations`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1:has-text('สมาคม/ชมรมศิษย์เก่า')", { timeout: 15000 });
    ok("associations page renders");

    if (!studentId) {
      bad("no alumni found to seed — skipping create/delete cycle (render-only)");
    } else {
      console.log("\n[2] Seed throwaway association via API");
      const createRes = await page.request.post(`${BASE}/alumni/api/associations`, {
        data: { studentId, fullName, associationName: MARKER, position: "ทดสอบ", recordedYear: 2569 },
      });
      if (!createRes.ok()) { bad("seed create failed", String(createRes.status())); throw new Error("seed"); }
      ok(`created marker association (${studentId})`);

      console.log("\n[3] Search -> useEntityList refetch on key change");
      await page.getByPlaceholder(/ค้นหา/).fill(MARKER);
      await page.waitForSelector(`tr:has-text("${MARKER}")`, { timeout: 10000 });
      ok("marker row appears after search (refetch on key change)");

      console.log("\n[4] UI delete -> invalidate -> refetch");
      await page.getByRole("button", { name: "จัดการข้อมูล" }).click(); // enter manage mode
      const row = page.locator(`tr`, { hasText: MARKER });
      await row.locator('button[title="ลบ"]').click();
      await page.locator(".fixed button", { hasText: "ยืนยัน" }).click();
      await page.waitForSelector(`tr:has-text("${MARKER}")`, { state: "detached", timeout: 10000 });
      ok("marker row gone after delete (mutation onSuccess -> invalidate -> refetch)");
    }

    console.log("\n[5] Client console errors");
    const real = clientErrors.filter((e) => !/favicon|404|Failed to load resource/i.test(e));
    if (real.length === 0) ok("no client console errors / uncaught exceptions");
    else bad("client console errors", JSON.stringify(real, null, 2));
  } catch (e) {
    bad("THREW", (e as Error).message);
    await page.screenshot({ path: "playwright/check-associations-fail.png", fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  console.log("\n================ SUMMARY ================");
  const pass = results.filter(([, p]) => p).length;
  console.log(`${pass}/${results.length} checks passed`);
  process.exit(results.every(([, p]) => p) ? 0 : 1);
}

main();
