# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Alumni Information System for the Faculty of Nursing, Chiang Mai University (FON CMU). Full product requirements are in `PRD.md`. UI reference screenshots are in `reference/`. Tech stack details in `TECH_STACK.md`.

## Commands

```bash
npm run dev               # Start dev server (http://localhost:3000)
npm run build             # Production build
npm run lint              # ESLint
npm run test              # Run vitest once
npm run test:watch        # Run vitest in watch mode
npx prisma migrate dev    # Run migrations (requires DATABASE_URL in .env)
npx prisma generate       # Regenerate Prisma client after schema changes
npx prisma studio         # Database browser
npx tsx prisma/seed.ts    # Run database seed script
```

## Architecture

### Core Stack

- **Next.js 16.2** with App Router (`app/` directory). This version has breaking changes from earlier Next.js — read the relevant guide in `node_modules/next/dist/docs/` before writing code.
- **React 19.2** with server and client components.
- **Prisma 7** ORM with PostgreSQL. Schema at `prisma/schema.prisma`. Client generates to `app/generated/prisma/` (import from there, not `@prisma/client`).
- **Prisma PostgreSQL adapter** (`@prisma/adapter-pg`) — the Prisma client is initialized with the `PrismaPg` adapter in `lib/prisma.ts`, using `DATABASE_URL` from `.env`.
- **Tailwind CSS 4** with PostCSS plugin (`@tailwindcss/postcss`). CSS-first configuration in `app/globals.css` — no `tailwind.config.js`. Uses `@theme inline` block for custom theme colors (primary: `#1e3a5f` dark blue, accent: `#e8a838` gold).
- **Vitest 4** for testing. Config at `vitest.config.ts`. Tests in `tests/`.
- **Path alias:** `@/*` maps to project root.

### Prisma Client Import Pattern

```ts
import prisma from "@/lib/prisma";
```

The singleton pattern in `lib/prisma.ts` prevents multiple client instances during hot reload. The client is imported from `../app/generated/prisma/client`, **not** `@prisma/client`.

### Database Schema

13 models in `prisma/schema.prisma` (table names from `@@map`):

| Model | Table | Purpose |
|---|---|---|
| `Alumni` | `alumni` | Core alumni records (studentId unique, degreeLevel, cohort) |
| `Award` | `awards` | Awards linked to alumni — split name (`prefix`/`firstName`/`lastName`), `awardType` enum, Buddhist `year`, `link`/`imageUrl` (no legacy `recipientName`) |
| `Association` | `associations` | Professional associations/positions |
| `GraduateCommittee` | `graduate_committees` | Committee memberships |
| `Potential` | `potentials` | Notable alumni potentials |
| `ModelRepresentative` | `model_representatives` | Model representative entries |
| `AlumniAgency` | `alumni_agency` | Alumni agency (Thailand + Abroad toggle) — renamed from `AbroadAlumni` |
| `News` | `news` | News articles (status, rich-text body, cover + up to 4 images) |
| `AdminUser` | `admin_users` | System users with roles |
| `ActivityLog` | `activity_logs` | Audit trail (JSON details) |
| `FieldChangeHistory` | `field_change_history` | Per-field old/new history — drives the orange update indicators (singular table) |
| `PasswordReset` | `password_resets` | Alumni password-reset tokens |
| `Session` | `sessions` | Browser sessions (token-based, `ADMIN` or `ALUMNI`) |

**Enums:**
- `DegreeLevel`: DOCTORAL, MASTER, BACHELOR, ASSOCIATE, NURSING_ASSISTANT
- `AwardType`: INTERNATIONAL, NATIONAL, LOCAL
- `NewsStatus`: DRAFT, PUBLISHED, DISCONTINUED
- `SessionType`: ADMIN, ALUMNI
- `ActorType`: ADMIN, ALUMNI

### Auth & Roles

- **Session-based auth** using `bcryptjs` + HTTP-only cookies (`fon-cmu-session`). Session tokens stored in `Session` model, 7-day expiry.
- **CMU OAuth2** with PKCE via Microsoft Entra ID (`lib/oauth.ts`). Callback at `/intern/api/auth/callback/`.
- **3 Roles:** `superadmin` (full CRUD + user management), `admin` (CRUD + import/export), `executive` (read-only).
- **Alumni portal** (`/graduates/*`): separate self-service session flow — email/password login, identity-verification sign-up, first-login TOS acceptance. Reuses the `Session` model with `sessionType: ALUMNI`; auth routes under `app/api/alumni-auth/`.
- **Role context:** `lib/role-context.tsx` provides `useRole()`, `useCanWrite()`, `useIsAdmin()` hooks.
- **Write permission check:** `lib/permissions.ts` — `checkWritePermission()` returns 401/403 for unauthorized requests.
- **Rate limiting:** `lib/rate-limit.ts` — in-memory sliding-window (5 attempts / 15 min).
- **Auth middleware via `proxy.ts`** (Next.js 16 renamed middleware to proxy) — enforces CSP headers and redirects unauthenticated users. Also enforced at the layout level: `app/(admin)/layout.tsx` guards the admin area; `app/graduates/(authed)/layout.tsx` guards the alumni portal.

### Route Structure

```
app/
├── layout.tsx                    # Root layout (fonts, <html lang="th">)
├── page.tsx                      # Root landing page
├── login/page.tsx                # Admin login (CMU OAuth / email–password testing)
├── news/[id]/page.tsx            # News detail (public)
├── (admin)/                      # Route group — admin area (auth-guarded)
│   ├── layout.tsx                # Admin auth guard + Header/Sidebar/Footer + RoleProvider
│   └── management/               # All admin data pages
│       ├── page.tsx
│       ├── dashboard/            # Dashboard (charts, count cards, latest news)
│       ├── all-alumni/           # All-alumni table
│       ├── new-alumni/           # Alumni creation (full-form with related records)
│       ├── alumni-agency/        # Thailand/Abroad toggle table
│       ├── associations/
│       ├── graduate-committee/
│       ├── model-representatives/
│       ├── awards/
│       ├── potentials/
│       ├── news/                 # News management (cards, not a table)
│       └── settings/{profile,users,logs,trash,alumni/[id]}/
├── admin/{alumni,news,users}/    # Admin-side views (verify purpose before editing)
├── graduates/                    # Alumni ("graduates") portal
│   ├── layout.tsx
│   ├── {signup,forgot-password,reset-password,tos}/
│   └── (authed)/                 # Auth-guarded alumni pages
│       ├── layout.tsx            # Alumni auth guard
│       ├── profile/              # Alumni self-profile (view/edit)
│       └── news/ + news/[id]/    # Alumni news (read-only)
├── api/                          # REST API routes
│   ├── alumni/                   # CRUD + import/export/bulk-delete + create-with-related + update-with-related/[id]
│   ├── alumni-agency/            # CRUD + import/export/bulk-delete (renamed from abroad-alumni)
│   ├── alumni-accounts/[id]/     # Admin alumni-account mgmt (+ /suspend)
│   ├── alumni-auth/              # signup, login-email, forgot/reset-password, accept-tos, logout
│   ├── alumni-profile/           # Logged-in alumni's own profile (GET/PUT)
│   ├── alumni-count/             # Dashboard aggregation
│   ├── associations/ · awards/ · graduate-committee/ · model-representatives/ · potentials/  # CRUD + import/export/bulk-delete
│   ├── news/                     # CRUD + bulk-delete (delete → DISCONTINUED)
│   ├── auth/{login,cmu-login,logout,cleanup}/
│   ├── cmu-alumni/               # CMU Registrar list/search proxy (GET only; major-sync on import runs via lib/cmu-registrar + lib/ensure-alumni, not an HTTP route)
│   ├── users/[id]/               # User management
│   ├── trash/{restore,hard-delete}/   # Superadmin soft-delete recovery
│   ├── field-changes/ · filter-facets/ · dashboard/ · logs/   # Supporting read endpoints
│   └── upload/                   # Image upload (PNG/JPG, max 5 MB)
└── intern/api/auth/callback/     # CMU OAuth callback
```

### API Route Pattern

Each data entity follows a consistent route structure:
- `GET /api/{entity}` — list (paginated, searchable)
- `POST /api/{entity}` — create
- `GET/PUT/DELETE /api/{entity}/[id]` — read/update/delete
- `POST /api/{entity}/import` — Excel import
- `GET /api/{entity}/export` — Excel export
- `POST /api/{entity}/bulk-delete` — bulk delete by IDs
- `POST /api/alumni/create-with-related` + `PUT /api/alumni/update-with-related/[id]` — create/update an alumni together with related records (full-form; one save can affect other pages)
- DELETE is a **soft delete**; recovery is superadmin-only via `POST /api/trash/restore` and `POST /api/trash/hard-delete`
- Every mutating route must call `checkWritePermission` (`@/lib/permissions`) and `logActivity` (`@/lib/activity-log`)
- **Standard CRUD + import/export/bulk-delete entities:** alumni, alumni-agency, associations, awards, graduate-committee, model-representatives, potentials.
- **Deviations from the standard pattern:**
  - `news` — no `import`/`export`; DELETE → `status: DISCONTINUED` (NOT a soft delete, NOT trash-recoverable).
  - `users` — no `import`/`export`/`bulk-delete`; write ops are superadmin-only (`checkSuperAdminPermission`).
  - `alumni-accounts` — admin alumni-account mgmt; uses `/[id]/suspend` instead of bulk ops (no import/export).
  - `alumni-profile` — no `/[id]`; operates on the logged-in alumni (`getAlumniSession`). GET/PUT/DELETE.
  - `cmu-alumni` — read-only external Registrar proxy (GET list/search).

### Route Correlations, Redirects & Entry Points

When adding/changing a route, keep this map honest (see Working Protocol "On touching routes").

**Correlations — routes that pair or overlap (touching one affects the other):**
- **Soft-delete round-trip:** `DELETE /api/{entity}/[id]` + `/api/{entity}/bulk-delete` set `deletedAt`; recoverable only via `POST /api/trash/restore` (+ permanent `POST /api/trash/hard-delete`, superadmin). **Exception:** `news` DELETE → `DISCONTINUED`, never trash-recoverable.
- **Full-form vs single CRUD:** `POST /api/alumni/create-with-related` + `PUT /api/alumni/update-with-related/[id]` write Alumni AND its 6 related entities in one transaction — overlaps `/api/alumni` POST/PUT and the per-entity routes; one save can change several pages.
- **Account lifecycle:** `POST /api/alumni-accounts/[id]/suspend` toggles suspension AND kills active `Session`s; `PUT /api/users/[id]` does the same for admin users.
- **CMU lookup:** `/api/cmu-alumni` (list/search) + `lib/cmu-registrar.ts` (`fetchCmuGraduateById`) feed import major-sync (`lib/ensure-alumni.ts`) and signup verification (`/api/alumni-auth/signup`).
- **Twin auth:** `/api/auth/*` (ADMIN) vs `/api/alumni-auth/*` (ALUMNI) share the `Session` model, split by `sessionType`.

**Redirects:**
- `/` → `/management/dashboard`; `/management` → `/management/dashboard`.
- `app/(admin)/layout.tsx` → `/login` when no admin session. `app/graduates/(authed)/layout.tsx` → `/login` (no alumni session) or `/graduates/tos` (TOS not yet accepted). `settings/profile` & `graduates/tos` pages also redirect to `/login` when unauthenticated.
- Both logout routes (`/api/auth/logout`, `/api/alumni-auth/logout`) → `/login`.
- OAuth: `/intern/api/auth/callback/` → dashboard on success, `/login?error=…` on failure; flow starts at `/api/auth/cmu-login`.

**Entry points — legitimately have no in-app links (do NOT flag as unused):**
- Public/landing: `/`, `/login`, `/news/[id]`, `/graduates/{signup,forgot-password,reset-password,tos}`.
- OAuth/callback: `/intern/api/auth/callback/`, `/api/auth/cmu-login`.
- Cron: `/api/auth/cleanup` (secured by `CLEANUP_SECRET` env var).

### Key Libraries

| Library | Purpose |
|---|---|
| `@tanstack/react-query` | Server-state / data fetching for client pages (most pages migrated to it) |
| `zod` | Schema validation (`lib/validations/`), also `react-hook-form` resolvers |
| `react-hook-form` + `@hookform/resolvers` | Form state + validation |
| `radix-ui` + shadcn/ui (`components/ui/*`, `components.json`) | Headless UI primitives / component library |
| `sonner` | Toast notifications |
| `lucide-react` | Icons |
| `next-themes` | Light/dark theme handling |
| `chart.js` + `react-chartjs-2` | Chart rendering (doughnut, bar) |
| `recharts` | Data visualization (line graphs) |
| `exceljs` | Excel import/export parsing (note: `xlsx` is NOT a dependency) |
| `sanitize-html` | HTML sanitization for news body |
| `bcryptjs` | Password hashing |
| `nodemailer` | Email (password reset) |

### Deployment

- **Docker:** Multi-stage Dockerfile (node:20-alpine), `output: "standalone"` in next.config.ts.
- **docker-compose.yml:** PostgreSQL 17 + app service.
- **CSP headers** configured in `next.config.ts` (YouTube/Vimeo frame-src, strict defaults).
- **Security headers:** X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy.

### Shared Components & Utilities

| File | Purpose |
|---|---|
| `components/Header.tsx` · `Sidebar.tsx` · `Footer.tsx` | Admin chrome (header w/ mobile hamburger, collapsible sidebar, footer) |
| `components/AlumniHeader.tsx` · `AlumniSidebar.tsx` | Alumni-portal chrome |
| `components/data-table.tsx` | Reusable sortable/paginated table |
| `components/OrangeCell.tsx` · `FieldHistoryModal.tsx` | Orange update indicators + per-field change-history modal |
| `components/ui/*` | shadcn/ui primitives (button, dialog, table, select, pagination, …) |
| `components/providers/query-provider.tsx` | TanStack Query client provider |
| `lib/constants.ts` | Thai labels, nav items, page size |
| `lib/role-context.tsx` | `useRole()` / `useCanWrite()` / `useIsAdmin()` |
| `lib/permissions.ts` | `checkWritePermission()` (401/403 guard) |
| `lib/activity-log.ts` · `lib/field-changes.ts` | Audit logging + per-field change tracking |
| `lib/ensure-alumni.ts` | Auto-create Alumni on import if studentId not found |
| `lib/cmu-registrar.ts` | CMU Registrar API integration (syncs major on import) |
| `lib/trash.ts` | Soft-delete trash management (restore / hard-delete) |
| `lib/alumni-agency-parse.ts` · `lib/award-import-parse.ts` | Excel parsers (former renamed from `abroad-alumni-parse.ts`) |
| `lib/excel-export.ts` · `lib/excel-import.ts` | Shared ExcelJS import/export helpers |
| `lib/validations/*.ts` | Zod schemas per entity (alumni, award, news, user, auth, …) |
| `lib/query-keys.ts` | TanStack Query key definitions |
| `lib/useBulkSelection.ts` · `lib/use-entity-list.ts` · `lib/useAlumniSearch.ts` | Client hooks (bulk select, entity list, search) |

## Key Constraints

- **Thai language** primary — all UI labels, column headers, validation messages, and enum values use Thai.
- **Degree levels (5):** ปริญญาเอก, ปริญญาโท, ปริญญาตรี, อนุปริญญา (ASSOCIATE), หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล
- **Award types:** รางวัลระดับนานาชาติ, รางวัลระดับชาติ, รางวัลระดับท้องถิ่น
- **Years** use Buddhist calendar (e.g., 2569, not 2026).
- **Thai fonts:** Sarabun, Noto Sans Thai loaded in globals.css.
- **App is deployed under `basePath: "/alumni"`** (`next.config.ts`) — route files define paths relative to it; mind basePath in links/fetches (some helpers auto-prepend, some don't).
- **Monolithic page components** — pages in `app/(admin)/management/` are large client components (700–1100+ lines, now built on TanStack Query). When modifying, be aware of the full scope.

## Working Protocol

> Read at the start of every task. These are the rules for how I communicate results and keep this instruction file honest. Follow them unless the user says otherwise.

### On finishing any task — produce a completion report

Before claiming a task is done, give a short structured report (tight bullets — never a file dump). Cover all of:

- **Plan executed** — the goal and the approach (1–3 lines). If the approach changed mid-task, say why.
- **Files changed** — `created` / `updated` / `deleted`, each with its real path (e.g. `app/(admin)/management/awards/page.tsx`). Don't lump them; distinguish creates from edits from deletes.
- **Libraries / tech used** — anything used or newly introduced (e.g. `@tanstack/react-query`, `zod`, `exceljs`). If a new dependency was added, name it + version + why.
- **Branch** — the current git branch (e.g. `main`, `feature/x`). State whether changes are committed or still uncommitted, and the commit hash if committed. Per repo + harness rule: commit/push only when asked, and branch first if on `main`.
- **Verification** — what confirms it works: tests run (+ pass/fail), `npm run lint` / `npm run build` status, manual steps. If something was NOT verified, say so explicitly rather than implying it was.

### On fixing a bug or problem — produce a root-cause report

After a fix, report:

- **Symptom** — what was wrong and how it showed up.
- **Root cause** — the actual underlying cause, not the surface behavior. Dig past "X didn't work" to *why*.
- **Fix** — what changed and why that addresses the root cause (not just a patch over the symptom).
- **Prevention** — concrete suggestions to stop it recurring (guard, test, lint rule, convention).
- **Self-improvement** — run the loop below so the same trap gets written into this file.

Be honest about certainty: if the root cause isn't fully confirmed, say "likely cause" + what would prove it — never dress a guess up as fact.

### On touching routes — keep the route map current

Routes here interconnect — admin pages link to each other, client components `fetch()` APIs, soft-delete pairs with `/api/trash/restore`, `create-with-related` / `update-with-related` overlap the single-entity CRUD routes, and auth guards redirect between areas. Whenever you **create, change, rename, or delete any route** (page, API route, or callback), keep the route documentation honest in the same task — update the **Route Structure** and **API Route Pattern** sections above. For the route(s) you touched, record:

- **Identify each route** — its path, (for APIs) method(s), what it does, and who calls it.
- **Correlations** — other routes that link to / fetch / depend on it, and any it overlaps or shares data with. Flag one-way vs round-trip pairs (e.g. `DELETE /api/alumni/[id]` soft-deletes → recoverable via `POST /api/trash/restore`; `DELETE /api/news/[id]` → `DISCONTINUED`, unrecoverable).
- **Redirection** — any redirect it issues or is subject to (layout guards, `proxy.ts`, OAuth callback `/intern/api/auth/callback/`, role-based fallbacks). Mind `basePath: "/alumni"` on all paths.
- **Delete unused routes** — if a route has no link, fetch, redirect, or test referencing it, delete it instead of leaving dead code. First grep for the path in all its forms (literal, `/[id]` param form, and any `BASE_PATH`-prepended variant) to confirm nothing references it.

If a route's purpose can't be stated in one line, that's a signal it's doing too much or isn't needed — say so.

## Self-Improvement Loop — keep this file from repeating mistakes

When a bug fix reveals a *recurring trap or a project-specific gotcha* (not a one-off typo), update `CLAUDE.md` so future-me avoids it:

1. **Already covered?** If it's a general framework gotcha already in `AGENTS.md` (Prisma 7, Tailwind 4, Next.js 16, React 19), don't duplicate — at most tighten the existing line.
2. **Project-specific?** Append a concise entry to **Known Pitfalls & Lessons Learned** below using the template. If it fits, also add a one-line guard rule to the relevant section (Key Constraints, Auth & Roles, API Route Pattern, etc.).
3. **Keep it DRY and current.** Merge near-duplicates. If a later change makes a lesson obsolete (renamed route, dropped library, fixed root cause), update or delete the entry — stale instructions are worse than none.
4. **Don't bloat.** Prefer editing an existing rule over stacking a new one. Only lessons that would change how code is written belong here; ordinary non-recurring bugs don't.

Template for a ledger entry:

```
### <short, searchable title>
- **Symptom:** <what went wrong>
- **Root cause:** <why>
- **Prevention:** <the rule/guard to apply next time>
```

## Known Pitfalls & Lessons Learned

*(Append-only ledger of project-specific traps. See "Self-Improvement Loop" for when to add an entry.)*

### App is deployed under `basePath: "/alumni"`
- **Symptom:** Links, redirects, or fetches resolve to the wrong path in the deployed app.
- **Root cause:** `next.config.ts` sets `basePath: "/alumni"`. Route files define paths relative to it; some API helpers auto-prepend `BASE_PATH`, others need it manually.
- **Prevention:** Account for `basePath` in new links/calls. Don't hardcode absolute `/api/...` blindly — check whether the helper already prepends.

### Shared `lib/` files must stay client-safe (split Prisma into a `-server` module)
- **Symptom:** Build error `Can't resolve 'dns'` (or another Node-only module) traced to a client component.
- **Root cause:** A client component imported a `lib/` module that transitively pulls in Prisma / the `pg` driver.
- **Prevention:** Keep shared `lib/` modules client-safe. Put Prisma-backed logic in a dedicated `*-server.ts` file (pattern in use: `lib/filter-facets.ts` + `lib/filter-facets-server.ts`). Never import `@/lib/prisma` across a `"use client"` boundary.

### API routes swallow Prisma errors into generic 500s
- **Symptom:** A data API returns a blank 500 with no useful detail.
- **Root cause:** Route handlers catch Prisma errors and return a generic message, hiding the real cause.
- **Prevention:** When debugging an API failure, probe the Prisma layer directly (run a script with `node --env-file=.env --import tsx`) rather than trusting the API response. The runtime DB is remote Prisma Postgres.

### Schema edits require a created + applied migration on remote Prisma Postgres
- **Symptom:** A model/schema change doesn't take effect, or the generated client disagrees with the live DB.
- **Root cause:** `npx prisma generate` alone is not enough — the migration must be created AND applied to the remote DB, then the client regenerated.
- **Prevention:** After any `prisma/schema.prisma` change: create the migration, apply it to the remote DB, then `npx prisma generate`. Run DB scripts with `node --env-file=.env --import tsx`.

### model-representatives เครือข่าย comes from alumniNetwork.aspx, not CMU degree level
- **Symptom:** model-representatives `เครือข่าย` (stored in `ModelRepresentative.cohort`) showed fabricated values (all `ปริญญาโท`).
- **Root cause:** `imports/finalized/model-representatives.xlsx` held 15 fabricated test rows from `scripts/build-test-imports.ts` → `cohortLabel()`, which derives the network from CMU degree `level_id`. The real per-network reps live in `imports/scrapped/alumni-network.json` (scraped from `alumniNetwork.aspx`, section titles already stripped of `รายชื่อเครือข่ายศิษย์เก่า` + `(รุ่น …)`). `imports/` Excel files are test/fabricated artifacts — not the source of truth.
- **Prevention:** `เครือข่าย` is one of 5 networks only (ปริญญาพยาบาล / ผู้ช่วยพยาบาล / อนุปริญญาพยาบาล / ปริญญาโท / ปริญญาเอก) — never derived from degree level. Rebuild from the real source via `node --env-file=.env --import tsx scripts/rebuild-model-representatives.ts` (name-joins reps → studentId via `alumni-data.json`; reports unmatched to `alumni-network-unmatched.json`). `DRY_RUN=1` previews counts without touching the DB.

### model-representatives `cohort`=เครือข่าย, `generation`=รุ่นที่ (inverted vs. sibling entities)
- **Symptom:** FacetFilters showed wrong data — เครือข่าย filter listed names, รุ่นที่ filter listed เครือข่าย values.
- **Root cause:** PRD names the fields `network` (เครือข่าย) + `cohort` (รุ่นที่), but the `ModelRepresentative` schema stores เครือข่าย in **`cohort`** and รุ่นที่ in **`generation`** — the opposite of sibling entities (graduate-committee etc.), where `cohort` = รุ่นที่. Filters/columns copied from siblings land on the wrong field.
- **Prevention:** On model-representatives, map **เครือข่าย→`cohort`**, **รุ่นที่→`generation`**, **สาขาวิชา→`major`**. Don't assume `cohort` means รุ่นที่ here. Facet fields must also be in `FACET_FIELDS["model-representatives"]` (`lib/filter-facets.ts`); `generation` is numeric (already in `YEAR_FIELDS`).

### awards `awardType` is derived by granting body; `recipientName` was split into prefix/firstName/lastName
- **Symptom:** Award rows need a type (LOCAL/NATIONAL/INTERNATIONAL) but the scrape (`imports/scrapped/alumni-awards.json`) carries none; the model previously had one `recipientName` instead of the PRD's prefix/firstName/lastName.
- **Root cause:** The schema field was `recipientName`; PRD (`PRD.md` Award) wants `prefix`/`firstName`/`lastName` + `link`/`imageUrl` on the Award itself. The source has only รางวัล/รายชื่อ/รุ่น/ปี — no type, link, image, or description.
- **Prevention:** `recipientName` is gone — store `prefix` (nullable) + `firstName`/`lastName` (required) on the Award; the page form (`awardPageFormSchema`) enforces required names while the shared `awardFormSchema` (used by the alumni full-form) leaves them optional (routes auto-fill from the parent alumni). Classify type by granting body in `scripts/rebuild-awards.ts`: **single-institution** (มหาวิทยาลัย/คณะ/วิทยาลัย/สมาคมศิษย์เก่า) **or regional/provincial/school/Rotary → LOCAL**; **foreign/international body → INTERNATIONAL**; **Thai national body (กระทรวง, สมาคมพยาบาลแห่งประเทศไทย, สภาการพยาบาล, ปอมท./ทคพย./ปขมท., ศรีสังวาลย์, วันมหิดล, แห่งชาติ) → NATIONAL** (default). Do NOT reuse `seed.ts:classifyAwardTier` (it misclassifies EACC→INTL and defaults unmatched→LOCAL). Rebuild real data: `node --env-file=.env --import tsx scripts/rebuild-awards.ts` (`DRY_RUN=1` previews the type distribution + unmatched). `link`/`imageUrl`/`description` are null — the scrape has no source for them.

