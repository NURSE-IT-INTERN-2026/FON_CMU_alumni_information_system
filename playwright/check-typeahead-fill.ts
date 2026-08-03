/**
 * Live check: picking an alumni via the typeahead auto-fills every possible
 * identity field in each form that has one.
 *
 * Covers:
 *  - graduate-committee: NEW `cohort` (รุ่นที่) fill (+ identity captured).
 *  - alumni-agency:       NEW `cohort` (รุ่น) + `englishName` (ชื่ออังกฤษ) + identity.
 *  - awards:              regression (identity + major still fill).
 *
 * Modelled on playwright/check-associations.ts. No real data is harmed — we only
 * open the create form, pick an alumni, and read field values (never submit).
 *
 * Note on graduate-committee: its CREATE form intentionally shows identity via
 * the `nameSearch` (displayName) typeahead field rather than separate
 * firstName/lastName/prefix inputs (those render only in edit mode). selectAlumni
 * still setValue's them, so they ARE captured in RHF state and submitted
 * (onSave spreads `...data`). So we assert cohort (new, visible) + that the
 * nameSearch display contains the firstName (proves identity captured).
 */
import { adminSession } from "./auth";
import type { Page } from "playwright";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const results: [string, boolean][] = [];
const ok = (n: string) => { results.push([n, true]); console.log("  ✓", n); };
const bad = (n: string, d = "") => { results.push([n, false]); console.log("  ✗", n, d); };
const has = (vals: string[], s: string | undefined | null) =>
  !!s && vals.some((v) => v === s);
const contains = (vals: string[], s: string | undefined | null) =>
  !!s && vals.some((v) => v.includes(s));

interface AlumniPick {
  studentId: string; firstName: string; lastName: string;
  major: string; cohort: string; englishName: string; homeAddress: string;
}

async function formValues(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"),
    ).map((e) => e.value),
  );
}

/** Open the create form, type the alumni's name, click their dropdown result. */
async function openAndSelect(page: Page, path: string, a: AlumniPick) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByRole("button", { name: "เพิ่มข้อมูล" }).first().click();
  await page.waitForSelector("h2:has-text('เพิ่มข้อมูล')", { timeout: 10000 });
  const nameInput = page.getByPlaceholder(/พิมพ์ชื่อเพื่อค้นหาศิษย์เก่า/).first();
  await nameInput.fill(a.firstName);
  const result = page.locator("button", { hasText: a.studentId }).first();
  await result.waitFor({ timeout: 10000 });
  await result.click();
  await page.waitForTimeout(350); // let react-hook-form setValue propagate
  return formValues(page);
}

async function main() {
  const { browser, page } = await adminSession();
  const clientErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") clientErrors.push(m.text()); });
  page.on("pageerror", (e) => clientErrors.push("pageerror: " + e.message));

  try {
    // Pick a local alumni that has a cohort (prefer one also carrying englishName/
    // major/homeAddress so we can exercise every fill).
    const res = await page.request.get(`${BASE}/alumni/api/alumni?pageSize=400`);
    const json = await res.json();
    const all = (json?.data ?? []) as Array<Record<string, unknown>>;
    const scoreOf = (x: Record<string, unknown>) =>
      // Weight englishName highest so a single run exercises the englishName fill
      // whenever any candidate carries it; major + homeAddress are tie-breakers.
      (String(x.englishName ?? "").trim() ? 100 : 0) +
      (String(x.major ?? "").trim() ? 1 : 0) +
      (String(x.homeAddress ?? "").trim() ? 1 : 0);
    const cand = all.filter((x) => String(x.cohort ?? "").trim());
    if (cand.length === 0) { bad("no local alumni with a cohort — cannot verify"); throw new Error("no-cohort"); }
    cand.sort((p, q) => scoreOf(q) - scoreOf(p));
    const b = cand[0];
    const a: AlumniPick = {
      studentId: String(b.studentId ?? ""),
      firstName: String(b.firstName ?? ""),
      lastName: String(b.lastName ?? ""),
      major: String(b.major ?? ""),
      cohort: String(b.cohort ?? ""),
      englishName: String(b.englishName ?? ""),
      homeAddress: String(b.homeAddress ?? ""),
    };
    console.log(`\nUsing alumni ${a.studentId} (${a.firstName}) cohort="${a.cohort}" englishName="${a.englishName || "(none)"}" homeAddress="${a.homeAddress ? "(set)" : "(none)"}"`);

    // ── graduate-committee ──
    console.log("\n[graduate-committee] typeahead fill");
    {
      const v = await openAndSelect(page, "/alumni/management/graduate-committee", a);
      if (has(v, a.studentId)) ok("studentId filled"); else bad("studentId NOT filled", JSON.stringify(v));
      if (has(v, a.major)) ok(`major filled = "${a.major}"`); else bad("major NOT filled", JSON.stringify(v));
      if (has(v, a.cohort)) ok(`cohort (รุ่นที่) filled = "${a.cohort}"`); else bad("cohort NOT filled", JSON.stringify(v));
      // Create mode shows identity via the nameSearch/displayName field.
      if (contains(v, a.firstName)) ok("identity captured (nameSearch contains firstName)"); else bad("identity NOT captured", JSON.stringify(v));
    }

    // ── alumni-agency ──
    console.log("\n[alumni-agency] typeahead fill");
    {
      const v = await openAndSelect(page, "/alumni/management/alumni-agency", a);
      if (has(v, a.studentId)) ok("studentId filled"); else bad("studentId NOT filled", JSON.stringify(v));
      if (has(v, a.firstName)) ok("firstName filled"); else bad("firstName NOT filled", JSON.stringify(v));
      if (has(v, a.cohort)) ok(`cohort (รุ่น) filled = "${a.cohort}"`); else bad("cohort NOT filled", JSON.stringify(v));
      if (a.englishName) {
        if (has(v, a.englishName)) ok(`englishName (ชื่ออังกฤษ) filled = "${a.englishName}"`); else bad("englishName NOT filled", JSON.stringify(v));
      } else ok("englishName skipped — picked alumni has none");
      if (a.homeAddress) {
        if (has(v, a.homeAddress)) ok("homeAddress (ที่อยู่บ้าน) filled"); else bad("homeAddress NOT filled", JSON.stringify(v));
      } else ok("homeAddress skipped — picked alumni has none");
    }

    // ── awards (regression) ──
    console.log("\n[awards] typeahead fill (regression)");
    {
      const v = await openAndSelect(page, "/alumni/management/awards", a);
      if (has(v, a.studentId)) ok("studentId filled"); else bad("studentId NOT filled", JSON.stringify(v));
      if (has(v, a.firstName)) ok("firstName filled"); else bad("firstName NOT filled", JSON.stringify(v));
      if (has(v, a.major)) ok(`major filled = "${a.major}"`); else bad("major NOT filled", JSON.stringify(v));
    }

    console.log("\n[client errors]");
    const real = clientErrors.filter((e) => !/favicon|404|Failed to load resource/i.test(e));
    if (real.length === 0) ok("no client console errors / uncaught exceptions");
    else bad("client console errors", JSON.stringify(real, null, 2));
  } catch (e) {
    bad("THREW", (e as Error).message);
    await page.screenshot({ path: "playwright/check-typeahead-fill-fail.png", fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  console.log("\n================ SUMMARY ================");
  const pass = results.filter(([, p]) => p).length;
  console.log(`${pass}/${results.length} checks passed`);
  process.exit(results.every(([, p]) => p) ? 0 : 1);
}

main();
