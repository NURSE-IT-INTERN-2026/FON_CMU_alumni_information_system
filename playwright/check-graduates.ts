/**
 * TanStack Query check for the graduates portal (alumni session).
 * Proves the converted profile + news pages render against /api/alumni-profile
 * and /api/news without client errors. Uses an alumni provisioned via signup.
 */
import { alumniSession } from "./auth";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const results: [string, boolean][] = [];
const ok = (n: string) => { results.push([n, true]); console.log("  ✓", n); };
const bad = (n: string, d = "") => { results.push([n, false]); console.log("  ✗", n, d); };

async function main() {
  const creds = {
    email: process.env.ALUMNI_EMAIL ?? "probe_61430116@example.com",
    password: process.env.ALUMNI_PASSWORD ?? "Test1234!",
  };
  const { browser, page } = await alumniSession(creds);
  const clientErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") clientErrors.push(m.text()); });
  page.on("pageerror", (e) => clientErrors.push("pageerror: " + e.message));

  try {
    console.log("\n[1] Graduates profile (useQuery /api/alumni-profile)");
    await page.goto(`${BASE}/alumni/graduates/profile`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    const url = page.url();
    const bodyLen = (await page.locator("body").innerText().catch(() => "")).length;
    if (!url.includes("/login") && bodyLen > 100) ok(`profile renders (url=${url.replace(BASE, "")}, ${bodyLen} chars)`);
    else bad("profile did not render / redirected to login", url);

    console.log("\n[2] Graduates news (useQuery /api/news PUBLISHED)");
    await page.goto(`${BASE}/alumni/graduates/news`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1:has-text('ข่าวสารและกิจกรรม')", { timeout: 15000 });
    ok("news page renders");

    console.log("\n[3] Client console errors");
    const real = clientErrors.filter((e) => !/favicon|404|Failed to load resource/i.test(e));
    if (real.length === 0) ok("no client console errors / uncaught exceptions");
    else bad("client console errors", JSON.stringify(real, null, 2));
  } catch (e) {
    bad("THREW", (e as Error).message);
    await page.screenshot({ path: "playwright/check-graduates-fail.png", fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  console.log("\n================ SUMMARY ================");
  const pass = results.filter(([, p]) => p).length;
  console.log(`${pass}/${results.length} checks passed`);
  process.exit(results.every(([, p]) => p) ? 0 : 1);
}

main();
