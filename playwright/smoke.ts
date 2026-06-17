/**
 * Lightweight render smoke for converted pages that share the proven
 * useEntityList mechanics. Usage: `npx tsx playwright/smoke.ts <urlPath> <h1Substring>`
 * Asserts the page renders its heading and logs no client console errors.
 * Dedicated scripts (check-associations.ts, …) cover pages with bespoke flows.
 */
import { adminSession } from "./auth";

async function main() {
  const urlPath = process.argv[2];
  const title = process.argv[3];
  const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  if (!urlPath || !title) {
    console.error("usage: npx tsx playwright/smoke.ts <urlPath> <h1Substring>");
    process.exit(2);
  }

  const { browser, page } = await adminSession();
  const clientErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") clientErrors.push(m.text()); });
  page.on("pageerror", (e) => clientErrors.push("pageerror: " + e.message));

  let pass = false;
  let detail = "";
  try {
    await page.goto(`${BASE}${urlPath}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(`h1:has-text('${title}')`, { timeout: 15000 });
    const real = clientErrors.filter((e) => !/favicon|404|Failed to load resource/i.test(e));
    if (real.length === 0) pass = true;
    else detail = JSON.stringify(real, null, 2);
  } catch (e) {
    detail = (e as Error).message;
    await page.screenshot({ path: "playwright/smoke-fail.png", fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  console.log(`${pass ? "✓ PASS" : "✗ FAIL"} ${urlPath} (h1: ${title})${detail ? "\n" + detail : ""}`);
  process.exit(pass ? 0 : 1);
}

main();
