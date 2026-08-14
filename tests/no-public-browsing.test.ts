// @vitest-environment node
/**
 * No-public-browsing regression guard. The system serves only two authenticated
 * audiences (staff + graduates); every data API must require a valid session.
 * This test has two parts:
 *
 *  Part A (static, comprehensive): scan EVERY `export async function GET` under
 *   `app/api/` and assert its handler body calls a session/permission gate — so a
 *   future ungated GET fails CI. The only public GETs (OAuth login start, OAuth
 *   callback, logout) are an explicit allowlist.
 *
 *  Part B (runtime): with both session helpers mocked to return null, a handful
 *   of representative routes (covering the `getSession` pattern and the
 *   `getSession`+`getAlumniSession` dual-audience pattern) must respond 401.
 */
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

// --------------------------------------------------------------------------- //
// Part A — static comprehensive guard
// --------------------------------------------------------------------------- //

const API_ROOT = path.resolve(process.cwd(), "app/api");

/** GET handlers that are legitimately reachable without a session. */
const PUBLIC_ALLOWLIST = new Set([
  "app/api/auth/cmu-login/route.ts", // starts the CMU OAuth login flow
  "app/api/auth/callback/route.ts", // Microsoft Entra ID OAuth callback (redirect URI)
  "app/api/auth/cleanup/route.ts", // cron session cleanup — gated by CLEANUP_SECRET bearer, not a session
]);

/** A session/permission gate call inside a handler body. */
const GATE_RE =
  /getSession|getAlumniSession|checkWritePermission|checkSuperAdminPermission|checkNonExecutivePermission|checkAlumniSession|resolveForumReader|requireForumAlumni|resolveForumStaffOrOwner|resolveEventReader|resolveEventCreator|resolveEventStaffOrAlumni|resolveGroupReader|requireGroupMember|authorize\s*\(/;

/** Extract one named async handler's body (from its `export` to the next `export` / EOF). */
function handlerBody(content: string, name: "GET"): string | null {
  const startIdx = content.indexOf(`export async function ${name}`);
  if (startIdx === -1) return null;
  const nextExport = content.indexOf("export async function ", startIdx + 1);
  return content.slice(startIdx, nextExport === -1 ? undefined : nextExport);
}

function listRouteFiles(): string[] {
  return fs
    .readdirSync(API_ROOT, { recursive: true })
    .map((p) => String(p))
    .filter((p) => p.endsWith("route.ts"))
    .map((p) => path.join("app/api", p).split(path.sep).join("/"));
}

describe("no-public-browsing (static): every API GET is session-gated", () => {
  const routes = listRouteFiles();

  it("found the API directory (sanity)", () => {
    expect(routes.length, "expected to discover app/api route files").toBeGreaterThan(0);
  });

  it("every non-allowlisted GET handler calls a session/permission gate", () => {
    const violations: string[] = [];
    for (const rel of routes) {
      if (PUBLIC_ALLOWLIST.has(rel)) continue;
      const content = fs.readFileSync(rel, "utf8");
      const body = handlerBody(content, "GET");
      if (body === null) continue; // no GET handler
      if (!GATE_RE.test(body)) violations.push(rel);
    }
    expect(
      violations,
      `ungated GET handlers (no session/permission gate in the GET body): ${violations.join(", ")}`,
    ).toEqual([]);
  });

  it("the public allowlist only lists routes that actually exist and have a GET", () => {
    for (const rel of PUBLIC_ALLOWLIST) {
      const content = fs.readFileSync(rel, "utf8");
      expect(handlerBody(content, "GET"), `${rel} is allowlisted but has no GET`).not.toBeNull();
    }
  });
});

// --------------------------------------------------------------------------- //
// Part B — runtime: anonymous (no session) ⇒ 401
// --------------------------------------------------------------------------- //
// Mock both session helpers to null so every gated route short-circuits to 401
// before any DB/URL work. Keep the real module's other exports intact.
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getSession: async () => null,
  getAlumniSession: async () => null,
}));

// Representative routes covering each gating pattern. Imported AFTER vi.mock.
const { GET: getAwards } = await import("@/app/api/awards/route");
const { GET: getAlumniList } = await import("@/app/api/alumni/route");
const { GET: getAlumniExport } = await import("@/app/api/alumni/export/route");
const { GET: getFilterFacets } = await import("@/app/api/filter-facets/route");
const { GET: getAlumniAgency } = await import("@/app/api/alumni-agency/route");
const { GET: getNews } = await import("@/app/api/news/route"); // dual-audience
const { GET: getCmuLookup } = await import("@/app/api/cmu-alumni/lookup/route"); // dual-audience
const { GET: getForumTopics } = await import("@/app/api/forum/topics/route"); // forum dual-audience (resolveForumReader)
const { GET: getEvents } = await import("@/app/api/events/route"); // events broadcast (resolveEventReader)
const { GET: getFeed } = await import("@/app/api/feed/route"); // feed opt-in (resolveForumReader)
const { GET: getCommunityProfile } = await import("@/app/api/community-profile/route"); // own profile (requireForumAlumni)
const { GET: getDirectory } = await import("@/app/api/directory/route"); // directory (resolveForumReader)
const { GET: getGroups } = await import("@/app/api/groups/route"); // groups (resolveGroupReader)

const req = (p: string) => new NextRequest(`http://localhost/alumni${p}`);

describe("no-public-browsing (runtime): anonymous request ⇒ 401", () => {
  it("getSession-gated routes return 401 with no session", async () => {
    for (const [label, res] of [
      ["awards", await getAwards(req("/api/awards"))],
      ["alumni list", await getAlumniList(req("/api/alumni"))],
      ["alumni export", await getAlumniExport(req("/api/alumni/export"))],
      ["filter-facets", await getFilterFacets(req("/api/filter-facets"))],
      ["alumni-agency", await getAlumniAgency(req("/api/alumni-agency"))],
    ] as const) {
      expect(res.status, `${label} should be 401 for anonymous`).toBe(401);
    }
  });

  it("dual-audience (getSession + getAlumniSession) routes return 401 with neither session", async () => {
    expect((await getNews(req("/api/news"))).status).toBe(401);
    // cmu-alumni/lookup takes studentId/alumniId query params, but the gate fires first.
    expect((await getCmuLookup(req("/api/cmu-alumni/lookup?studentId=1"))).status).toBe(401);
    // forum topics GET gates via resolveForumReader (wraps the dual session check).
    expect((await getForumTopics(req("/api/forum/topics"))).status).toBe(401);
    // events GET gates via resolveEventReader (broadcast, but anon is still blocked).
    expect((await getEvents(req("/api/events"))).status).toBe(401);
    // feed GET gates via resolveForumReader (opt-in, like the forum).
    expect((await getFeed(req("/api/feed"))).status).toBe(401);
    // community V2: own community profile + directory both gate via forum-guard.
    expect((await getCommunityProfile(req("/api/community-profile"))).status).toBe(401);
    expect((await getDirectory(req("/api/directory"))).status).toBe(401);
    // groups GET gates via resolveGroupReader (same opt-in entry as the forum).
    expect((await getGroups(req("/api/groups"))).status).toBe(401);
  });
});
