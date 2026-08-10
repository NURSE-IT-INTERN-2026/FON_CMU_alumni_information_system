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
- **Tailwind CSS 4** with PostCSS plugin (`@tailwindcss/postcss`). CSS-first configuration in `app/globals.css` — no `tailwind.config.js`. Uses `@theme inline` block for custom theme colors (primary: `#5b21b6` purple, accent: `#e8a838` gold).
- **Vitest 4** for testing. Config at `vitest.config.ts`. Tests in `tests/`. Default env is `node` (no DOM); for a DOM-touching test, add `happy-dom` (devDep) and put `// @vitest-environment happy-dom` as the file's first line (see `tests/drag-scroll.test.tsx`).
- **Path alias:** `@/*` maps to project root.

### Prisma Client Import Pattern

```ts
import prisma from "@/lib/prisma";
```

The singleton pattern in `lib/prisma.ts` prevents multiple client instances during hot reload. The client is imported from `../app/generated/prisma/client`, **not** `@prisma/client`.

### Database Schema

24 models in `prisma/schema.prisma` (table names from `@@map`). Long descriptions live in the **Known Pitfalls** entries they point to — the cells here are terse pointers.

| Model | Table | Purpose |
|---|---|---|
| `Alumni` | `alumni` | Core alumni records (`studentId` unique, `prefix`/`firstName`/`lastName`, `degreeLevel`, `cohort`, `email` (auth/login, `@unique`)/`contactEmail` (contact, distinct from auth)/`phones` (`String[]`)/`homeAddress`). **Single `lastName`** (merged from old `maidenLastName`+`newLastName`). Carries a denormalized **primary** degree snapshot + `primaryEducationId` (see `Education`). `communityOptedInAt` gates the alumni community forum (see `ForumTopic`). `currentWorkplace`/`country`/`province` and the old `maidenLastName`/`newLastName` were REMOVED |
| `Education` | `education` | One row per degree an alumni earned (`studentId` unique, `degreeLevel`, `graduationYear`, `major`, `cohort`, `firstName`/`lastName` = ชื่อ/นามสกุล ขณะศึกษา); `@@unique([alumniId, degreeLevel])`. 1:N with `Alumni`; `Alumni.primaryEducationId` points at the primary row whose fields are mirrored onto the `Alumni` snapshot |
| `Award` | `awards` | Awards linked to alumni — split name (`prefix`/`firstName`/`lastName`), `awardType` enum, Buddhist `year`, `link`/`imageUrl` (no legacy `recipientName`) |
| `Association` | `associations` | Professional associations/positions |
| `GraduateCommittee` | `graduate_committees` | Committee memberships |
| `Potential` | `potentials` | Notable alumni potentials |
| `ModelRepresentative` | `model_representatives` | Model representative entries |
| `AlumniAgency` | `alumni_agency` | Alumni agency (ข้อมูลการทำงานศิษย์เก่า). Thailand + Abroad tabs are the **same model split by `country`** (NOT two models; in-country is NOT the `alumni` table). `studentId` is a nullable **FK to `Alumni.studentId`**; import links ONLY when a matching `Alumni` exists, else `pendingStudentId`. **`homeAddress` is unified with `Alumni.homeAddress`** (single source of truth). Renamed from `AbroadAlumni`. See the alumni-agency + homeAddress lessons |
| `News` | `news` | News articles (status, rich-text body, cover image). Body uses **Tiptap v3** (`components/news/RichTextEditor.tsx`; no inline image upload since 2026-07). Nullable `pinnedAt` ⇒ pinned into "ประชาสัมพันธ์สำคัญ"; discontinuing clears it. See the pinned-news + Tiptap lessons |
| `AdminUser` | `admin_users` | System users with roles |
| `ActivityLog` | `activity_logs` | Audit trail (JSON details) |
| `FieldChangeHistory` | `field_change_history` | Per-field old/new history — drives the orange update indicators (singular table) |
| `PasswordReset` | `password_resets` | Alumni password-reset tokens |
| `EmailVerification` | `email_verifications` | Email-ownership verification tokens (signup). Mirrors `PasswordReset` (`token @unique`, `used`, `expiresAt` 24h, `alumniId`) |
| `Session` | `sessions` | Browser sessions (token-based, `ADMIN` or `ALUMNI`) |
| `CmuGraduate` | `cmu_graduates` | **Materialized** CMU Registrar graduate list (one row per FON degree record, `studentId @unique`) — local cache of the registrar universe. Refreshed on demand by an admin from `/management/settings/cmu-sync`; the ONLY live-CMU call lives in that sync route. See the materialization lesson |
| `ForumTopic` | `forum_topics` | Alumni community forum topic (opening post + title). **Plain-text** body (escaped+linkified on render via `renderForumBody`, NOT Tiptap). FK to `Alumni.id`. `replyCount`/`lastReplyAt` denormalized + maintained in a `$transaction` on reply create/delete. Soft-delete (`deletedAt` = owner delete OR admin hide; trash-recoverable). Opt-in gate in `lib/forum-guard.ts`; the public-identity select in `lib/forum-identity.ts` is the single leak surface. See the forum lesson |
| `ForumReply` | `forum_replies` | A reply on a `ForumTopic`. Plain-text body, FK to `ForumTopic.id` (Cascade) + `Alumni.id`. Soft-delete recomputes the topic's denormalized counters |
| `ContentReport` | `content_reports` | User-generated content report (report+admin-review moderation). `@@unique([reporterId, resourceType, resourceId])` = one report per (reporter, target); re-report re-opens. Lifecycle is a status (`OPEN`/`RESOLVED`/`DISMISSED`) — NOT soft-delete/trash-recoverable. `resourceType` also covers events (`EVENT`) |
| `CommunityEvent` | `community_events` | Alumni community event/reunion. Organizer is an alum (opted-in) OR a staff member — exactly one of `organizerAlumniId`/`organizerUserId` set. **Broadcast visibility** (all ACTIVE alumni; NOT opt-in-gated like the forum — see `lib/event-guard.ts`). Plain-text description (`renderForumBody`). `capacity` = max total headcount (attendees+guests); enforced in the RSVP route (`lib/event-capacity.ts`). Soft-delete (RSVPs cascade) |
| `EventRsvp` | `event_rsvps` | An alum's RSVP on a `CommunityEvent` — `ATTENDING` (with `guestCount`, counts toward capacity) or `DECLINED`. `@@unique([eventId, alumniId])` |
| `FeedPost` | `feed_posts` | Alumni activity feed post (plain-text body + optional `imageUrl`, one photo). **Opt-in gated** (reuses `lib/forum-guard.ts`). Denormalized `likeCount`/`commentCount` maintained in `$transaction`s. Soft-delete (likes/comments cascade) |
| `FeedLike` | `feed_likes` | A like on a `FeedPost`. `@@unique([postId, alumniId])` (one per alum — the toggle deletes the row) |
| `FeedComment` | `feed_comments` | A comment on a `FeedPost` (≈ a forum reply). Plain-text body, soft-delete |

**Enums:**
- `DegreeLevel`: DOCTORAL, MASTER, BACHELOR, ASSOCIATE, NURSING_ASSISTANT
- `AwardType`: INTERNATIONAL, NATIONAL, LOCAL
- `NewsStatus`: DRAFT, PUBLISHED, DISCONTINUED
- `SessionType`: ADMIN, ALUMNI
- `ActorType`: ADMIN, ALUMNI, SYSTEM
- `AccountStatus`: UNVERIFIED, PENDING, ACTIVE, REJECTED (alumni signup lifecycle — new signups are UNVERIFIED until email-confirmed, then PENDING until admin-approved; only ACTIVE may log in)
- `ContentReportStatus`: OPEN, RESOLVED, DISMISSED · `ContentReportReason`: SPAM, HARASSMENT, INAPPROPRIATE, OTHER · `ForumReportResource`: FORUM_TOPIC, FORUM_REPLY, EVENT, FEED_POST, FEED_COMMENT (one report system across forum + events + feed) · `RsvpStatus`: ATTENDING, DECLINED (community events)

### Auth & Roles

- **Session-based auth** using `bcryptjs` + HTTP-only cookies (`fon-cmu-session`). Session tokens stored in `Session` model, 30-day expiry. **Tokens are hashed at rest** (`hashToken`, `lib/auth.ts`) — see the auth-tokens lesson.
- **CMU OAuth2** with PKCE via Microsoft Entra ID (`lib/oauth.ts`). Callback at `/api/auth/callback/` (the registered redirect URI is the `CALLBACK_URL` env var, read by both the authorize request and the token exchange).
- **3 Roles:** `superadmin` (full CRUD + user management), `admin` (CRUD + import/export), `executive` (ผู้บริหาร — **read-only everywhere**: views all main admin pages but cannot create/edit/delete/import/bulk-delete; excluded from logs, account management (`settings/users`), and CMU sync (`settings/cmu-sync`); sees news like alumni — PUBLISHED only). Read-only-ness is `useCanWrite()` returning `false` for `executive` (client gates) + `checkWritePermission()` 403-ing executive (server).
- **Alumni portal** (`/graduates/*`): separate self-service session flow — email/password login, **email-verification + admin-approval sign-up** (see the signup-lifecycle lesson), first-login TOS acceptance. Reuses the `Session` model with `sessionType: ALUMNI`; auth routes under `app/api/alumni-auth/`.
- **Role context:** `lib/role-context.tsx` provides `useRole()`, `useCanWrite()`, `useIsAdmin()` hooks.
- **Write permission check:** `lib/permissions.ts` — `checkWritePermission()` returns 401 (no session) / 403 (the read-only `executive` role — this single check makes executive read-only across ~30 mutating routes). `checkSuperAdminPermission()` 403s non-superadmin (user CRUD, trash, logs bulk-delete). `checkNonExecutivePermission()` 403s executive on the READ endpoints serving excluded pages (`GET /api/logs`, `/api/users`, `/api/users/[id]`).
- **Rate limiting:** `lib/rate-limit.ts` — in-memory sliding-window (5 attempts / 15 min). IP via `getClientIp` (`lib/get-client-ip.ts`).
- **Auth middleware via `proxy.ts`** (Next.js 16 renamed middleware to proxy) — enforces CSP headers and redirects unauthenticated users. Also enforced at the layout level: `app/(admin)/layout.tsx` guards the admin area; `app/graduates/(authed)/layout.tsx` guards the alumni portal.

### Route Structure

```
app/
├── layout.tsx                    # Root layout (fonts, <html lang="th">)
├── page.tsx                      # Root landing page
├── login/page.tsx                # Admin login (CMU OAuth / email–password testing)
├── news/[id]/page.tsx            # Staff news detail — session-gated (redirects to /login without a staff session)
├── (admin)/                      # Route group — admin area (auth-guarded)
│   ├── layout.tsx                # Admin auth guard + Header/Sidebar/Footer + RoleProvider
│   └── management/               # All admin data pages
│       ├── page.tsx
│       ├── dashboard/            # Dashboard (charts, count cards, latest news)
│       ├── alumni-activity/      # Alumni-portal engagement analytics (login activity + accounts) — read-only stats (no CRUD)
│       ├── all-alumni/           # All-alumni table
│       ├── new-alumni/           # Alumni creation (full-form with related records)
│       ├── alumni/[id]/          # Admin alumni profile VIEW — orange edit-history, edit mode, data-logs toggle (param = UUID or studentId)
│       ├── alumni-agency/        # Thailand/Abroad toggle — BOTH tabs are ONE single-table CRUD surface on `alumni-agency` split by `country`/`region`
│       ├── associations/
│       ├── graduate-committee/
│       ├── model-representatives/
│       ├── awards/
│       ├── potentials/
│       ├── news/                 # News management (cards, not a table)
│       ├── forum/                # Alumni community forum — moderation/reports queue (admin+superadmin; exec read-only)
│       ├── events/               # Alumni community events — staff create/edit/delete + attendee counts
│       └── settings/{profile,users,logs,cmu-sync,trash}/  # cmu-sync = "การดึงข้อมูล" (admin+superadmin)
├── admin/{alumni,news,users}/    # Admin-side views (verify purpose before editing)
├── graduates/                    # Alumni ("graduates") portal
│   ├── layout.tsx
│   ├── {signup,verify-email,forgot-password,reset-password,tos,reapply}/
│   └── (authed)/                 # Auth-guarded alumni pages
│       ├── layout.tsx            # Alumni auth guard
│       ├── profile/              # Alumni self-profile (view/edit)
│       ├── forum/ + forum/[id]/ + forum/new/   # Alumni community forum (opt-in gated)
│       ├── feed/ + feed/[id]/                  # Alumni activity feed (opt-in; posts + likes + comments + photo)
│       ├── events/ + events/[id]/ + events/new/   # Alumni community events (broadcast; RSVP w/ guests+capacity)
│       └── news/ + news/[id]/    # Alumni news (read-only)
├── api/                          # REST API routes
│   ├── alumni/                   # CRUD + import/export/bulk-delete + create-with-related + update-with-related/[id] + [id]/activity (merged change timeline; [id] GET resolves UUID or studentId)
│   ├── alumni-agency/            # CRUD + import/export/bulk-delete; GET + export accept `?region=thailand|abroad`; GET accepts `?unlinked=true`
│   ├── alumni-accounts/[id]/     # Admin alumni-account mgmt (+ /suspend, /approve, /reject, /reverify, /delete)
│   ├── alumni-auth/              # signup, login-email, forgot/reset-password, accept-tos, logout, verify-email (+ /resend), reapply (+ /prepare)
│   ├── alumni-profile/           # Logged-in alumni's own profile (GET/PUT/DELETE) + /educations (GET/POST) + /community-membership (forum opt-in/out)
│   ├── alumni-count/ · alumni-activity/ · dashboard/   # read-only, session-guarded, TTL-cached aggregations
│   ├── associations/ · awards/ · graduate-committee/ · model-representatives/ · potentials/  # CRUD + import/export/bulk-delete
│   ├── news/                     # CRUD + bulk-delete (→ DISCONTINUED) + bulk-publish + bulk-pin + [id]/pin
│   ├── forum/                    # Alumni community forum — topics + topics/[id] + topics/[id]/replies + replies/[id] + reports + reports/[id]. Opt-in gate (`lib/forum-guard.ts`); public-identity select (`lib/forum-identity.ts`)
│   ├── events/                   # Alumni community events — events/[id] + events/[id]/rsvp. Broadcast gate (`lib/event-guard.ts`); capacity-aware RSVP (`lib/event-capacity.ts`). Event reports go through /api/forum/reports (resourceType EVENT)
│   ├── feed/                     # Alumni activity feed — feed/[id] + feed/[id]/like + feed/[id]/comments + feed/comments/[id]. Reuses the forum opt-in gate (`lib/forum-guard.ts`). Feed reports → /api/forum/reports (resourceType FEED_POST/FEED_COMMENT)
│   ├── alumni-upload/            # Opt-in-alumni image upload (shares `saveImageUpload` with /api/upload) — feeds the activity-feed photo attach
│   ├── auth/{login,cmu-login,logout,callback,cleanup}/   # callback = CMU OAuth callback (Microsoft Entra ID PKCE)
│   ├── educations/[id]/          # Education record GET/PUT/DELETE (admin OR owning alumni; PUT of the primary re-syncs the Alumni snapshot)
│   ├── alumni/[id]/educations/   # Admin: list + add an alumni's education records
│   ├── cmu-alumni/               # CMU Registrar data — read from the LOCAL `cmu_graduates` table (materialized). See the materialization lesson
│   ├── users/[id]/               # User management
│   ├── trash/{restore,hard-delete}/   # Superadmin soft-delete recovery
│   ├── field-changes/ · filter-facets/ · logs/   # logs = read-only GET + superadmin-only bulk-delete
│   └── upload/                   # Image upload (PNG/JPG, max 5 MB)
```

### API Route Pattern

Each data entity follows a consistent route structure:
- `GET /api/{entity}` — list (paginated, searchable)
- `POST /api/{entity}` — create
- `GET/PUT/DELETE /api/{entity}/[id]` — read/update/delete
- `POST /api/{entity}/import` — Excel import
- `GET /api/{entity}/export` — Excel export. Accepts optional `?startRow=`/`?endRow=` (1-based, clamped server-side against total matching rows via `resolveRowRange` in `lib/excel-export.ts`). The "ส่งออก Excel" button is the shared `<ExportRangeButton>` (`components/ExportRangeButton.tsx`) popover. Applies only to GET filtered export — the POST bulk-export (`/export` with `{ ids }`) is id-scoped. Sheet names sanitized in `buildExcelResponse` (Excel forbids `* ? : \ / [ ]` and 31-char max — the Thai label "สมาคม/ชมรม" had a `/`). **Exception — the `alumni` export is the merged CMU+local set, not just local:** `GET`/`POST /api/alumni/export` build the SAME merged rows the on-screen all-alumni table shows (via the shared `mergeAlumniTableRows` in `lib/alumni-merge.ts`), so they include CMU-only persons (~20k rows, not ~11k local-only). `GET` accepts `?dedupe=true|false` (default `true` = highest-degree-per-person; `false` = "แสดงทุกวุฒิ"), `?sortField`/`?sortDir`, plus the same `search`/facet params as the list; `POST` takes `{ ids, dedupe }`.
- `POST /api/{entity}/bulk-delete` — bulk delete by IDs
- `POST /api/alumni/create-with-related` + `PUT /api/alumni/update-with-related/[id]` — create/update an alumni together with related records (full-form; one save can affect other pages)
- DELETE is a **soft delete**; recovery is superadmin-only via `POST /api/trash/restore` and `POST /api/trash/hard-delete`
- Every mutating route must call `checkWritePermission` (`@/lib/permissions`) and `logActivity` (`@/lib/activity-log`)
- **Alumni-creation routes also fire `autoLinkPendingForAlumni`** (`lib/alumni-link.ts`) — `POST /api/alumni`, `/create-with-related`, `/import`, and signup `/approve` link that alumni's pending rows; so do a **studentId-edit correction** (`PUT /api/alumni/[id]`, behind the same-person guard) and the **education add/edit/delete** routes (after `recomputePrimaryEducation`) — see the "Auto-link at canonicalization" correlation. **Alumni `homeAddress` write routes also fire `mirrorAlumniHomeAddressToAgencies`** (`lib/alumni-agency-home-sync.ts`) — `PUT /api/alumni/[id]`, `/update-with-related/[id]`, `/alumni-profile`, `/import`.
- **Standard CRUD + import/export/bulk-delete entities:** alumni, alumni-agency, associations, awards, graduate-committee, model-representatives, potentials.
- **Deviations from the standard pattern:**
  - `alumni-activity` — read-only engagement analytics; no `/[id]`/import/export/bulk-delete. Session-guarded + 60s-TTL-cached (`withTtlCache("alumni-activity")`). Login counts read `ActivityLog` where `action='LOGIN'` + `resource='alumni_auth'` + `actorType='ALUMNI'`.
  - `news` — no `import`/`export`; DELETE → `status: DISCONTINUED` (NOT a soft delete, NOT trash-recoverable). **Pinned news:** `GET /api/news` excludes pinned by default (`pinnedAt: null`); `?pinned=true` returns only pinned (`pinnedAt desc`); `POST /api/news/[id]/pin { pinned }` is the admin toggle (PUBLISHED-only — rejects pin-on-non-published with 400; unpin allowed on any status). Discontinuing (single/bulk/PUT→DISCONTINUED) clears `pinnedAt`. **Bulk actions** (per-status-gated on the page): `bulk-publish {ids}` (DRAFT/DISCONTINUED → PUBLISHED, stamps `publishedAt`) and `bulk-pin {ids}` (**toggles** each selected PUBLISHED item — partitions to-pin/to-unpin into disjoint id sets and runs two `updateMany` in a `$transaction`; returns `{pinned,unpinned}`). All three log one entry each (no `recordFieldChanges`); where-clauses are status-scoped for idempotency + defense.
  - `users` — no `import`/`export`/`bulk-delete`; write ops are superadmin-only (`checkSuperAdminPermission`).
  - `alumni-accounts` — admin alumni-account mgmt; no import/export/bulk-delete. The list filters `passwordHash != null` **and excludes `UNVERIFIED`** (`accountStatus: { not: "UNVERIFIED" }`); `?status=` accepts `pending|active|rejected` (NOT `unverified`). Sub-routes: `/[id]/suspend` (toggle `suspendedAt` + kill sessions), `/[id]/approve`|`/reject`|`/reverify` (write: `checkWritePermission`; `reject` **requires `{reason}`**), and `/[id]/delete` (the one **superadmin-only** sub-route — deletes the alumni *account* while **KEEPING the data record**: nulls `email`+`passwordHash`+`accountStatus`→`UNVERIFIED`+verification fields, does NOT set `deletedAt` and does NOT touch `studentId`/name/education; purpose: let the alumni re-sign-up to re-test the signup email, since signup dedups on `email` first).
  - `alumni-profile` — no `/[id]`; operates on the logged-in alumni (`getAlumniSession`). GET/PUT/DELETE. `alumni-profile/educations` adds alumni-self GET/POST of education records.
  - `cmu-alumni` — read-only (GET list/search) + `lookup?studentId=&alumniId=` (single-record preview; `samePersonWarning` + `alreadyClaimed`) + `/live` (session-gated LIVE CMU list, `withTtlCache("cmu-live-graduates", 120s)`-wrapped; each row carries `isNew` = its trimmed `student_id` is NOT in the local cache) + `/sync` (the ONLY write/live-CMU call: `GET` compares local vs remote, `POST` materializes the full remote set). The live table MUST go through this cached route (`fetchCmuGraduatesLive` has no cache of its own). The cmu-sync "ข้อมูลในระบบ" table hits local `GET /api/cmu-alumni?dedupe=false`.
  - `educations` — degree records (1:N per alumni). `GET/POST /api/alumni/[id]/educations` (admin) and `GET/POST /api/alumni-profile/educations` (alumni-self) for list/add; `GET/PUT/DELETE /api/educations/[id]` for one record (admin OR owning alumni via `resolveWriter`). Every add, and a PUT that changes `studentId`, must pass `assertEducationSamePerson`. No import/export/bulk-delete.
  - `logs` — read-only (GET list only) + a **superadmin-only** `POST /api/logs/bulk-delete` `{ ids }` that **hard-deletes** (and deliberately does NOT log the deletion). UI gate is `useRole() === "superadmin"` (NOT `useIsAdmin()`).
  - `forum` — alumni community forum (v1). **Opt-in gated** (`lib/forum-guard.ts`): reads = staff OR opted-in alumni (401 anon, 403 `{code:"NOT_OPTED_IN"}`); writes = opted-in alumni; admin moderation writes via `checkWritePermission` (exec read-only, opt-in-exempt). Routes: `GET/POST /api/forum/topics`, `GET/PUT/DELETE /api/forum/topics/[id]`, `GET/POST /api/forum/topics/[id]/replies`, `PUT/DELETE /api/forum/replies/[id]`, `POST /api/forum/reports` (alumni; no self-report; upsert re-opens) + `GET /api/forum/reports` (staff queue), `POST /api/forum/reports/[id] {action:"resolve"|"dismiss"}`. `POST /api/alumni-profile/community-membership {action:"opt-in"|"opt-out"}` flips `Alumni.communityOptedInAt`. **Bodies are plain text** (escape+linkify on render via `renderForumBody` — NO Tiptap/sanitize-html). DELETE is a soft-delete (owner OR admin); `forum_topic`/`forum_reply` are in `TRASH_ENTITIES`. Denormalized `replyCount`/`lastReplyAt` maintained in a `$transaction`. No import/export/bulk-delete. See the forum lesson.
  - `events` — alumni community events/reunions. **Broadcast gated** (`lib/event-guard.ts`, NOT opt-in): reads/RSVP = staff OR any ACTIVE alumni; creation = staff (`checkWritePermission`) OR opted-in alumni (sets `organizerUserId`/`organizerAlumniId`). Routes: `GET/POST /api/events`, `GET/PUT/DELETE /api/events/[id]` (PUT = organizer-or-staff; DELETE = organizer-or-staff soft-delete), `POST/DELETE /api/events/[id]/rsvp`. RSVP `{status:ATTENDING|DECLINED, guestCount}`; `guestCount ≤ event.guestLimit`; **capacity** (total headcount = attendees+guests) enforced via `lib/event-capacity.ts` → 400 `{code:"EVENT_FULL"}` when full (an update subtracts the alum's current seats to avoid double-counting). Datetimes: the route appends `+07:00` to the naive datetime-local input (`bangkokDatetimeLocalToIso`) and stores a UTC instant; `lib/event-format.ts` shifts +7h back for Bangkok display. Event reports reuse `POST /api/forum/reports {resourceType:"EVENT"}` and surface in the `/management/forum` queue. `community-event` is in `TRASH_ENTITIES` (RSVPs cascade). No import/export/bulk-delete. Alumni cover-image upload is intentionally omitted (the admin-gated `/api/upload` can't be reached by alumni; staff set covers via the admin page).
  - `feed` — alumni activity feed (flat posts + likes + comments + one photo). **Opt-in gated** (reuses `lib/forum-guard.ts` — NOT a new gate). Routes: `GET/POST /api/feed`, `GET/PUT/DELETE /api/feed/[id]` (PUT = author-only; DELETE = owner-or-staff soft-delete), `POST /api/feed/[id]/like` (toggle — deletes the `FeedLike` row + decrements `likeCount`, or creates + increments, in a `$transaction`), `GET/POST /api/feed/[id]/comments`, `PUT/DELETE /api/feed/comments/[id]`. Each list/detail post carries `likedByMe` (one batched `feed_likes` query for the requesting alum). Denormalized `likeCount`/`commentCount` maintained in `$transaction`s. Feed reports reuse `POST /api/forum/reports {resourceType:"FEED_POST"|"FEED_COMMENT"}` → `/management/forum` queue. `feed-post`/`feed-comment` in `TRASH_ENTITIES` (likes/comments cascade on post delete). No admin page (reports-driven; staff DELETE via the API/report queue). Bodies plain text (`renderForumBody`).
  - `alumni-upload` — opt-in-alumni image upload (`requireForumAlumni`). Shares `saveImageUpload` (`lib/upload.ts`) with the admin `/api/upload` so the 5 MB / PNG+JPG / magic-byte rules are identical; writes to the same `public/uploads`. Exists because `/api/upload` is admin-gated and alumni need to attach photos to feed posts.

### Route Correlations, Redirects & Entry Points

When adding/changing a route, keep this map honest (see Working Protocol "On touching routes").

**Correlations — routes that pair or overlap (touching one affects the other):**
- **Soft-delete round-trip:** `DELETE /api/{entity}/[id]` + `/api/{entity}/bulk-delete` set `deletedAt`; recoverable only via `POST /api/trash/restore` (+ permanent `POST /api/trash/hard-delete`, superadmin). **Exception:** `news` DELETE → `DISCONTINUED`, never trash-recoverable.
- **Full-form vs single CRUD:** `POST /api/alumni/create-with-related` + `PUT /api/alumni/update-with-related/[id]` write Alumni AND its 6 related entities in one transaction — overlaps `/api/alumni` POST/PUT and the per-entity routes.
- **homeAddress unification (bidirectional; `Alumni.homeAddress` = single source of truth):** agency → alumni via `syncAgencyHomeAddressToAlumni` (agency `POST`/`PUT`/`import`); alumni → agency via `mirrorAlumniHomeAddressToAgencies` (alumni PUT/import/profile). See the homeAddress lesson for the full policy.
- **Auto-link at canonicalization:** when an alumni becomes canonical, `autoLinkPendingForAlumni` (`lib/alumni-link.ts`) links every matching pending row across the 6 related entities in one shot. Fires at admin create / create-with-related / import / signup-approve, and when the alumni's `studentId` *changes* to a value pending rows match (admin studentId-edit correction, or education add/edit/delete after `recomputePrimaryEducation`). See the full lesson for the FK-is-to-primary limitation.
- **Admin alumni profile view:** `/management/alumni/[id]` (param = alumni UUID **or** `studentId`) is reached by clicking any row on the all-alumni + alumni-related tables; its data-logs tab reads `GET /api/alumni/[id]/activity`. Editing saves via `PUT /api/alumni/update-with-related/[id]`. Orange indicators query BOTH `resourceType: alumni` and `alumni_profile` (comma-joined `resourceType` accepted).
- **Alumni import columns:** `POST /api/alumni/import` reads `รหัสนักศึกษา/คำนำหน้า/ชื่อ/นามสกุล/รุ่น สาขา/ระดับการศึกษา/อีเมล/เบอร์โทร/ที่อยู่ปัจจุบัน`, losslessly with the all-alumni export (also accepts `รุ่น`/`อีเมลติดต่อ` + `สาขาวิชา`/`ปีสำเร็จการศึกษา`/`วันเกิด`/`หมายเหตุ`; those four are write-on-UPDATE-only so legacy imports never blank them). `อีเมล` → `contactEmail` (NOT auth `email`). `เบอร์โทร` → `parsePhones` (`lib/parse-phone.ts`, keeps mobile after `มือถือ`, splits commas). `ที่อยู่ปัจจุบัน` → `homeAddress`. `scripts/build-alumni-excel.ts` emits these from the legacy dump (gitignored; the script is the source of truth).
- **Account lifecycle:** see the signup-lifecycle lesson for the full two-gate flow (UNVERIFIED → PENDING → ACTIVE) + password reset.
- **CMU lookup:** `/api/cmu-alumni` (list/search) + `lib/cmu-registrar.ts` feed import major-sync, signup verification, and the add-education auto-fill preview.
- **Education / primary snapshot:** see the Education lesson.
- **Twin auth:** `/api/auth/*` (ADMIN) vs `/api/alumni-auth/*` (ALUMNI) share the `Session` model, split by `sessionType`.

**Redirects:**
- `/` → `/management/dashboard`; `/management` → `/management/dashboard`.
- `app/(admin)/layout.tsx` → `/login` when no admin session. `app/graduates/(authed)/layout.tsx` → `/login` (no alumni session) or `/graduates/tos` (TOS not yet accepted). `settings/profile` & `graduates/tos` pages also redirect to `/login` when unauthenticated.
- Both logout routes (`/api/auth/logout`, `/api/alumni-auth/logout`) → `/login`.
- OAuth: `/api/auth/callback/` → dashboard on success, `/login?error=…` on failure; flow starts at `/api/auth/cmu-login`.

**Entry points — legitimately have no in-app links (do NOT flag as unused):**
- Public/auth-only (no in-app links, and the **only** routes reachable without a session per the no-public-browsing policy): `/login`, `/graduates/{signup,verify-email,forgot-password,reset-password,tos,reapply}`. (`/` redirects to `/management/dashboard` → `/login` when unauthenticated; `/news/[id]` is staff-session-gated.)
- OAuth/callback: `/api/auth/callback/`, `/api/auth/cmu-login`.
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

### Deployment

- **Docker:** Multi-stage Dockerfile (node:20-alpine), `output: "standalone"` in next.config.ts.
- **docker-compose.yml:** PostgreSQL 17 + app service.
- **CSP headers** configured in `next.config.ts` (YouTube/Vimeo frame-src, strict defaults).
- **Security headers:** X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy.
- **External URLs (email links, OAuth callback, logouts) resolve a runtime `PUBLIC_BASE_URL`** (not the build-time-inlined `NEXT_PUBLIC_BASE_URL`) — see the base-URL lesson.

### Shared Components & Utilities

| File | Purpose |
|---|---|
| `components/Header.tsx` · `Sidebar.tsx` · `Footer.tsx` | Admin chrome (header w/ mobile hamburger, collapsible sidebar, footer) |
| `components/AlumniHeader.tsx` · `AlumniSidebar.tsx` | Alumni-portal chrome |
| `components/data-table.tsx` | Reusable sortable/paginated table |
| `components/table-pan/DragScrollController.tsx` | Drag-to-pan horizontal scroll for wide tables (see the drag-to-pan lesson) |
| `components/OrangeCell.tsx` · `FieldHistoryModal.tsx` | Orange update indicators + per-field change-history modal |
| `components/ui/*` | shadcn/ui primitives (button, dialog, table, select, pagination, …) |
| `components/news/RichTextEditor.tsx` · `RichTextToolbar.tsx` | Tiptap v3 editor + toolbar (see the Tiptap lesson) |
| `components/EducationSection.tsx` | Shared education add/edit UI (admin + alumni-self, badges the primary) |
| `components/ExportRangeButton.tsx` | Shared export-range popover |
| `components/form/RepeatableFieldArray.tsx` | Generic repeatable-row form helper (generic over field values) |
| `components/providers/query-provider.tsx` | TanStack Query client provider |
| `lib/constants.ts` | Thai labels, nav items, page size, `DEGREE_COLORS` |
| `lib/role-context.tsx` | `useRole()` / `useCanWrite()` / `useIsAdmin()` |
| `lib/permissions.ts` | `checkWritePermission()` (401/403 guard) |
| `lib/activity-log.ts` · `lib/field-changes.ts` | Audit logging + per-field change tracking |
| `lib/log-payload.ts` · `lib/log-detail.ts` | Activity-log payload builders (server) + client-safe reader |
| `lib/import-log.ts` | IMPORT log builder — counts + failed-rows list per import |
| `lib/cache.ts` | Process-level TTL cache (`withTtlCache`/`bustCache`) |
| `lib/ensure-alumni.ts` | Auto-create Alumni on import if studentId not found (the 6 related-entity imports use `lib/alumni-link.ts` instead — no stub) |
| `lib/alumni-link.ts` | **SERVER-ONLY** link-or-flag logic for the 6 related-entity imports (`resolveAlumniLink` + `buildAlumniEntityMatchWhere` + `autoLinkPendingForAlumni`) — see the studentId-FK lesson |
| `lib/cmu-registrar.ts` | CMU Registrar data — **materialized locally** (`cmu_graduates`). `getCmuGraduatesLocal`/`getCmuGraduateLocalById`/`fetchCmuGraduatesOrEmpty`/`fetchCmuGraduateById` read the local table; `fetchCmuGraduatesLive` is the ONE live fetch (sync route only) |
| `lib/cmu-sync-job.ts` · `lib/cmu-scheduler.ts` | SERVER-ONLY `materializeCmuGraduates(ctx)` (shared by the sync route + monthly scheduler) + the in-process monthly scheduler (see the scheduler lesson) |
| `lib/trash.ts` | Soft-delete trash management (restore / hard-delete) |
| `lib/excel-export.ts` · `lib/excel-import.ts` · `lib/import-batch.ts` | Shared ExcelJS import/export helpers + batched-import helpers (see the batched-imports lesson) |
| `lib/alumni-merge.ts` · `lib/alumni-sort.ts` · `lib/alumni-verify.ts` · `lib/person-degree-count.ts` | CMU+local merge/sort/dedup + person-degree breakdown (see the CMU+local merge + dashboard-counts lessons) |
| `lib/alumni-agency-region.ts` · `lib/alumni-agency-home-sync.ts` · `lib/alumni-agency-parse.ts` | alumni-agency region split + homeAddress sync + Excel parser |
| `lib/validations/*.ts` | Zod schemas per entity |
| `lib/query-keys.ts` | TanStack Query key definitions |
| `lib/useBulkSelection.ts` · `lib/use-entity-list.ts` · `lib/useAlumniSearch.ts` | Client hooks (bulk select, entity list, search) |

## Key Constraints

- **No package/dependency upgrades (project policy, 2026-07).** Do not bump dependencies unless the user explicitly asks — no `npm install <pkg>@<ver>`, no `npm audit fix`, no manual `package.json`/`package-lock.json` version edits. `npm audit` findings are accepted as documented risk; mitigate with code-level controls only, never an upgrade. Applies across `dependencies` and `devDependencies`.
- **No public/anonymous browsing.** The system serves only two audiences — **staff** (admin/superadmin/executive) and **graduates** (alumni). Every content page and data API requires an authenticated session. Only login, sign-up, password-reset, and the auth API endpoints (`/api/auth/*`, `/api/alumni-auth/{signup,login,forgot/reset-password}`) are reachable without a session; an anonymous visitor sees only `/login`. **Every entity `GET`/`export` is session-gated** (returns 401 to anonymous) — `tests/no-public-browsing.test.ts` asserts this so it can't backslide. The only intentionally-public `GET`s are the OAuth flow (`auth/cmu-login`, `auth/callback`) and `alumni-auth/logout`; `cmu-alumni/sync` gates via its local `authorize()` (admin session **or** `CMU_SYNC_SECRET`). `proxy.ts` only checks cookie *presence*, so the app-layer `getSession()` re-validation is the real enforcement. News is session-gated: staff see all statuses, alumni see PUBLISHED only. Do **not** depict a public/visitor path in diagrams, docs, or onboarding.
- **Thai language** primary — all UI labels, column headers, validation messages, and enum values use Thai.
- **Degree levels (5):** ปริญญาเอก, ปริญญาโท, ปริญญาตรี, อนุปริญญา (ASSOCIATE), หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล
- **Award types:** รางวัลระดับนานาชาติ, รางวัลระดับชาติ, รางวัลระดับท้องถิ่น
- **Years** use Buddhist calendar (e.g., 2569, not 2026).
- **Thai fonts:** Sarabun, Noto Sans Thai loaded in globals.css.
- **App is deployed under `basePath: "/alumni"`** (`next.config.ts`) — route files define paths relative to it; mind basePath in links/fetches (some helpers auto-prepend, some don't).
- **Monolithic page components** — pages in `app/(admin)/management/` are large client components (700–1100+ lines, built on TanStack Query). When modifying, be aware of the full scope.

## Working Protocol

> Read at the start of every task. These are the rules for how I communicate results and keep this instruction file honest. Follow them unless the user says otherwise.

### Git workflow — branch off, do the work, commit, then merge to `main`

Default flow for **every** task that changes code (the user wants it; it supersedes the generic "commit only when asked" rule):

1. **Branch off `main` first** — before writing any code, create a descriptively-named branch from `main` and switch to it. Never work or commit directly on `main`.
2. **Do the task** on that branch.
3. **Commit when finished** — once the work is done and verification (build/lint/tests) is green, commit it.
4. **Confirm in case of errors** — if anything fails (build, lint, tests, a merge conflict, or any unexpected problem), STOP and ask the user before committing/merging instead of forcing it through. Proceed only once it's green, or the user OKs it.
5. **Merge to `main`** — after committing, check out `main` and merge the branch back with `--no-ff` (keeps the feature unit visible in history). Leave the working tree clean and end on `main`.

Don't `git push` unless explicitly asked. If a request only needs exploration/answers (no code change), skip the flow.

### On finishing any task — produce a completion report

Before claiming a task is done, give a short structured report (tight bullets — never a file dump). Cover all of:

- **Plan executed** — the goal and the approach (1–3 lines). If the approach changed mid-task, say why.
- **Files changed** — `created` / `updated` / `deleted`, each with its real path. Don't lump them; distinguish creates from edits from deletes.
- **Libraries / tech used** — anything used or newly introduced. If a new dependency was added, name it + version + why.
- **Branch** — the current git branch. State whether changes are committed or still uncommitted, and the commit hash if committed. Follow the **Git workflow** above — branch off `main` first, commit when done, merge back to `main`; pause for the user's confirmation if anything fails. Don't push unless asked.
- **Verification** — what confirms it works: tests run (+ pass/fail), `npm run lint` / `npm run build` status, manual steps. If something was NOT verified, say so explicitly rather than implying it was. To verify **live behavior**, hit the dev server on `:3000` with `curl` (this project uses `basePath: "/alumni"`, so routes are `/alumni/...` and APIs `/alumni/api/...`). You **may** spawn or restart the dev server whenever necessary for verification (see Known Pitfalls: *Dev server for verification*).

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
- **Redirection** — any redirect it issues or is subject to (layout guards, `proxy.ts`, OAuth callback, role-based fallbacks). Mind `basePath: "/alumni"` on all paths.
- **Delete unused routes** — if a route has no link, fetch, redirect, or test referencing it, delete it instead of leaving dead code. First grep for the path in all its forms (literal, `/[id]` param form, and any `BASE_PATH`-prepended variant) to confirm nothing references it.

If a route's purpose can't be stated in one line, that's a signal it's doing too much or isn't needed — say so.

## Self-Improvement Loop — keep this file from repeating mistakes

When a bug fix reveals a *recurring trap or a project-specific gotcha* (not a one-off typo), update `CLAUDE.md` so future-me avoids it:

1. **Already covered?** If it's a general framework gotcha already in `AGENTS.md` (Prisma 7, Tailwind 4, Next.js 16, React 19), don't duplicate — at most tighten the existing line.
2. **Project-specific?** Append a concise entry to **Known Pitfalls & Lessons Learned** below using the template. If it fits, also add a one-line guard rule to the relevant section (Key Constraints, Auth & Roles, API Route Pattern, etc.).
3. **Keep it DRY and current.** Merge near-duplicates. If a later change makes a lesson obsolete (renamed route, dropped library, fixed root cause), update or delete the entry — stale instructions are worse than none.
4. **Don't bloat.** Prefer editing an existing rule over stacking a new one. State the **rule** + the one-line **prevention**; cut the narrative. Only lessons that would change how code is written belong here; ordinary non-recurring bugs don't.

Template for a ledger entry:

```
### <short, searchable title>
- **Rule:** <the forward rule>
- **Prevention:** <the guard/convention to apply next time>
```

## Known Pitfalls & Lessons Learned

*(Concise ledger of project-specific traps. Each entry is the rule + prevention — state the trap, not the story. See "Self-Improvement Loop" for when to add one.)*

### `docker compose up` reuses a stale cached app image — rebuild with `--build`
- **Rule:** `basePath` is a **build-time** constant baked into the standalone image; `docker compose up -d` reuses an existing image and does NOT rebuild. After source changes the app serves old code (at `/` not `/alumni` → every internal link/fetch 404s).
- **Prevention:** Run `docker compose up -d --build app` after any source change you want live. Verify with curl: `/` → 308 `/alumni`, `/alumni/login` → 200, bare `/login` → 404. `basePath` is NOT runtime-overridable, so a wrong basePath always means a stale build.

### Dev container hot-reloads via `docker-compose.override.yml` (HMR) — but only after a `--build`
- **Rule:** `docker compose up` auto-merges the override → builds the Dockerfile **`deps`** stage + bind-mounts the source (`.:/app`) for HMR; anonymous volumes protect `node_modules`/`.next`/`app/generated`. The `app` `command` is `node scripts/dev-watch.mjs`, which generates the Prisma client on boot AND **regenerates + reloads `next dev` whenever `prisma/schema.prisma` changes** (mtime-polled at 1.5s — Docker/WSL2 bind-mounts don't reliably deliver inotify). So after a host-side `npx prisma migrate dev` the container picks up the new client automatically — no manual `exec prisma generate` / restart.
- **Prevention:** On the first switch to dev (or after any `package.json` change) you MUST `docker compose up -d --build app` once. New host-side npm deps update host `node_modules` but NOT the container's (anonymous volume) → dev server 500s `Module not found` while host `npm run build`/`lint` still pass. Fix: `docker compose exec app npm install`. (A `command`/volume change needs container **recreation** — `docker compose up -d app` — not a plain `restart`.)

### Dev container `public/uploads/` is a named volume — host files there are NOT served
- **Rule:** `docker-compose.yml` mounts a named `uploads` volume at `/app/public/uploads`; the dev override bind-mounts `.:/app` but compose MERGES volumes, so the named volume **shadows** the host's `public/uploads/` inside the container.
- **Prevention:** Don't drop a host file into `public/uploads/` and expect the container to serve it. Upload through the app (`POST /api/upload`) or `docker cp` into the container. Inspect via `docker exec <app> ls /app/public/uploads/`.

### Shared `lib/` files must stay client-safe (split Prisma into a `-server` module)
- **Rule:** A client component importing a `lib/` module that transitively pulls Prisma/`pg` → build error `Can't resolve 'dns'`.
- **Prevention:** Keep shared `lib/` client-safe; put Prisma-backed logic in a `*-server.ts` file (pattern: `lib/filter-facets.ts` + `lib/filter-facets-server.ts`). Never import `@/lib/prisma` across a `"use client"` boundary.

### API routes swallow Prisma errors into generic 500s
- **Rule:** Route handlers catch Prisma errors and return a generic message, hiding the real cause.
- **Prevention:** When debugging an API failure, probe the Prisma layer directly (`node --env-file=.env --import tsx …`) rather than trusting the API response. The runtime DB is remote Prisma Postgres.

### Schema edits require a created + applied migration on remote Prisma Postgres
- **Rule:** `npx prisma generate` alone is not enough — the migration must be created AND applied to the remote DB, then the client regenerated.
- **Prevention:** After any `prisma/schema.prisma` change: `migrate status` (drift check) → create → apply → `generate`. **Always run `migrate status` before migrating** — an abandoned worktree may have applied a migration missing from your local folder → Prisma offers `migrate reset` (DATA LOSS); copy the missing file in instead. **Never accept a reset** on the shared remote DB. Run DB scripts with `node --env-file=.env --import tsx`.

### model-representatives เครือข่าย comes from alumniNetwork.aspx, not CMU degree level
- **Rule:** `เครือข่าย` (stored in `ModelRepresentative.cohort`) is one of 5 fixed networks (ปริญญาพยาบาล / ผู้ช่วยพยาบาล / อนุปริญญาพยาบาล / ปริญญาโท / ปริญญาเอก) — never derived from CMU degree `level_id`. Real data lives in `imports/scrapped/alumni-network.json`.
- **Prevention:** `imports/` Excel files are test/fabricated artifacts, NOT the source of truth. Don't derive the network from degree level.

### model-representatives `cohort`=เครือข่าย, `generation`=รุ่นที่ (inverted vs. sibling entities)
- **Rule:** On model-representatives, **เครือข่าย→`cohort`**, **รุ่นที่→`generation`**, **สาขาวิชา→`major`** — the opposite of siblings (graduate-committee etc.) where `cohort` = รุ่นที่.
- **Prevention:** Don't assume `cohort` means รุ่นที่ here. `generation` is numeric (in `YEAR_FIELDS`); facets must list `generation` in `FACET_FIELDS["model-representatives"]`.

### awards `awardType` is derived by granting body; name is split into prefix/firstName/lastName
- **Rule:** `Award` stores `prefix` (nullable) + `firstName`/`lastName` (required) — `recipientName` is gone. The scrape (`imports/scrapped/alumni-awards.json`) has no type/link/image; classify `awardType` by granting body in `scripts/rebuild-awards.ts`.
- **Prevention:** Classify: **single-institution** (มหาวิทยาลัย/คณะ/วิทยาลัย/สมาคมศิษย์เก่า) **or regional/provincial/school/Rotary → LOCAL**; **foreign/international body → INTERNATIONAL**; **Thai national body (กระทรวง, สมาคมพยาบาลแห่งประเทศไทย, สภาการพยาบาล, ปอมท./ทคพย./ปขมท., ศรีสังวาลย์, วันมหิดล, แห่งชาติ) → NATIONAL** (default). A regional **chapter** of a national body (`…แห่งประเทศไทย ภาคเหนือ`) is LOCAL — check directional regional keywords (`ภาคเหนือ/ใต้/กลาง/อีสาน`) *before* national; but a national award won in a regional **category** (`ส่วนภูมิภาค`/`ภาครัฐ`) stays NATIONAL. Do NOT reuse `seed.ts:classifyAwardTier` (misclassifies). The page form enforces required names; the shared `awardFormSchema` (full-form) leaves them optional (routes auto-fill from parent alumni).

### All person-name entities use `prefix` + `firstName` + `lastName` (combined-name split)
- **Rule:** `Award` (was `recipientName`), `Potential`/`Association`/`GraduateCommittee` (were `fullName`), `ModelRepresentative` (was `name`), `AlumniAgency` (was `thaiName`) are all split into `prefix String?` + `firstName String` + `lastName String` (required-name entities; AlumniAgency's are nullable). Reuse `splitFullName()` (`lib/parse-name.ts`).
- **Prevention:** The shared `{entity}FormSchema` carries optional names (full-form auto-fills from parent); `{entity}PageFormSchema` extends to required; `create-with-related`/`update-with-related`/`alumni-profile` all auto-fill names from the parent alumni.

### Dev server for verification — reuse :3000 when you can, but spawning / restarting is allowed
- **Rule:** The dev server is not untouchable — you may spawn one, or stop and restart the running one, whenever necessary (fresh process, stale HMR cache, Prisma client reload, nothing listening). Reusing the running server on `:3000` is the low-friction default — probe first: `curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/alumni/login`.
- **Prevention:** Next 16 **refuses to bind** port 3000 while another `next dev` holds it (tries 3001, then prints `Run kill <pid>`, and may stall on its spinner). Don't spawn a second `next dev` alongside a running one — stop the old one first (`lsof -ti:3000 | xargs -r kill`). Always use `run_in_background: true` and poll the log for `Ready`; never run a dev server in the foreground.

### Management table pages are single-table CRUD — no manage/view toggle
- **Rule:** One CRUD-always-on table per page (all-alumni, awards, associations, graduate-committee, potentials, news, alumni-agency, model-representatives): แก้ไข/ลบ, เพิ่มข้อมูล, import/export, OrangeCell indicators. CRUD is gated on `useCanWrite()` (`true` admin/superadmin, `false` executive); read-only affordances (search, facets, sort, body, pagination, row-click nav, **ส่งออก Excel**, the รอเชื่อมโยง toggle) stay ungated. Server-side `checkWritePermission` is the real boundary. Guard an always-render block without re-indenting: `{canWrite && (<JSX/>)}`. Don't re-introduce the `manageMode`/toggle.
- **Selection is opt-in AND checkbox-free:** a header "เลือก" button enters select mode (no checkbox column); clicking a row/card toggles selection (orange highlight, navigation paused). **Selection is GLOBAL across pages** (`useBulkSelection`; only exit/post-bulk calls `deselectAll`). News selection is **status-locked** and pin/unpin **keeps** the selection (`lib/news-selection.ts`); alumni-agency's both tabs share one selection surface. In-row edit/delete still work (`onClick` guards `closest("button, input, a")`).
- **All-alumni page specifics:** inline edit + row-click → `/management/alumni/[id]`. Rows are a CLIENT-SIDE CMU+local merge (see below). Fetch the **full** set once with `pageSize=50000` (the old `9999` silently truncated ~1,600 records), then slice/sort client-side (`sortAlumni`, `lib/alumni-sort.ts`) since the CMU proxy can't place local-only rows. Adding a sortable column must keep it reachable by `sortAlumni`; never page+merge per-page. **`Alumni.birthDate` is stored Buddhist-era DDMMYYYY (8 digits)** — normalize before sorting/date-math; `formatBirthDateThai`/`formatBirthDateThaiSlash` display it (Thai DD-MM-YYYY Buddhist, year +543). CMU `birthday` is raw DD-MM-YYYY → normalize via `normalizeCmuBirthday` (`lib/alumni-verify.ts`).

### CMU+local person merge — the all-alumni table counts each person once
- **Rule:** CMU returns one record per degree (distinct `student_id` + `level_id`); CMU and local `education` overlap. The all-alumni table keeps each PERSON to one row via a CLIENT-SIDE merge.
- **Display dedup is DISPLAY/COUNT-LAYER ONLY:** `dedupeCmuGraduatesByPerson(graduates)` (`lib/alumni-verify.ts` — matches `name_th`+`surname_th`+canonical birthday, keeps the **highest** degree, attaches ALL the person's `student_id`s as `student_ids`). Apply ONLY in `/api/cmu-alumni` (full list, *before* search/facets/sort/pagination) + `lib/filter-facets-server.ts`. **NEVER** in studentId-keyed consumers (`lib/ensure-alumni.ts`, `app/api/alumni/[id]/route.ts`) — dedup drops lower-degree ids and breaks enrichment.
- **Trim `student_id`** (CMU returns trailing spaces) before comparing/keying if consuming `fetchCmuGraduates()` directly.
- **The merge:** `manageQuery` fetches full CMU list + full local list once, overlays local identity/contact, appends local-only alumni, collapses multi-degree persons via the `student_ids` bridge. **Keep `search`/facet params symmetric across BOTH fetches** (a real bug passed them to CMU but not `/api/alumni`). Any new server-side "all alumni" consumer must call `mergeAlumniTableRows` (`lib/alumni-merge.ts`; `tests/alumni-merge.test.ts`), never `prisma.alumni.findMany` alone (misses ~9.5k CMU-only persons). Export threads the caller's `dedupe` mode.

### Table search boxes submit on Enter / ค้นหา — never per keystroke
- **Rule:** Every management table search box uses `components/ui/search-input.tsx` (`SearchInput`): typing updates the box only; the query runs on **Enter** or the **ค้นหา** button. The box mirrors `value` back via the "adjust state when a prop changes" pattern (`useState(value)` + render-time diff), NOT an effect or ref (React Compiler lint rejects both).
- **Prevention:** The old per-keystroke box re-ran the full CMU+local merge each character. Scope: table/list search boxes only. The alumni-picker dropdown (`useAlumniSearch`) is intentionally still a live typeahead — don't "fix" it to Enter-only. **No search-field `<select>` anymore** — every entity searches ALL fields; the API falls back to its multi-field `OR` when `searchField` is omitted.

### Dashboard "alumni by degree" counts merge CMU + local (a person never counts twice)
- **Rule:** The dashboard counts each PERSON once under their highest degree, across CMU AND local `education` (a locally-added higher degree upgrades the person; nobody is double-counted). Use `getPersonDegreeBreakdown()` (`lib/person-degree-count.ts`) in `/api/alumni-count` and `/api/dashboard`.
- **Prevention:** Its pure core `groupPersonsByDegree(cmu, local)` unions entities via three signals — CMU records sharing normalized name+birthday, a local alumni's `education` rows, and a cross-source **studentId bridge**. Each group → one person, highest degree (`DEGREE_RANK`), representative year. The count includes EVERY person (CMU + local-only, e.g. a legacy/admin-created `studentId=66123456`); `hasCmu` is informational only. The CMU read is **fail-safe** — `fetchCmuGraduatesOrEmpty` reads the local `cmu_graduates` table; empty → local-only counts + an amber "ยังไม่ได้ดึงข้อมูล CMU" banner, never a 500.

### CMU Registrar data is MATERIALIZED locally (`cmu_graduates`) — not fetched live on load
- **Rule:** CMU graduates are persisted in `cmu_graduates` (one row per FON degree record) and refreshed **on demand** by an admin from **การดึงข้อมูล** (`/management/settings/cmu-sync`). The ONLY remaining live-CMU call is `fetchCmuGraduatesLive()` inside `POST/GET /api/cmu-alumni/sync`.
- **`cmuAvailable`** = "the `cmu_graduates` table is non-empty" (was "Registrar reachable"). Pre-first-sync → `false` → dashboard amber banner, counts local alumni only.
- **Identity checks read local now:** signup/approve/reverify/education same-person + alumni `[id]` PUT studentId check all read the local table (they fail open and are admin-gated; a brand-new remote-not-yet-synced graduate won't be found).
- **Sync mechanics:** `GET /api/cmu-alumni/sync` = compare (`{remoteCount,localCount,newCount,removedCount,inSync,lastSyncedAt,sample}`); `POST` = chunked 500-row `$transaction` upserts (refresh stale fields, not `createMany`), `logImport(cmu_alumni/IMPORT)`, `bustCache("dashboard")`+`bustCachePrefix("alumni")`. Auth: admin session (`checkWritePermission`) OR `CMU_SYNC_SECRET` bearer (cron). Both POST and the scheduler call the shared `materializeCmuGraduates(ctx)` (`lib/cmu-sync-job.ts`) — one code path. Removed registrar rows are reported but NOT auto-soft-deleted. Dev seed: `node --env-file=.env --import tsx scripts/seed-cmu-graduates.ts` (`DRY_RUN=1` preview).

### In-process monthly scheduler — never one month-long `setTimeout`; idempotency via the activity log
- **Rule:** `lib/cmu-scheduler.ts` fires `materializeCmuGraduates` on the 1st of each month (Asia/Bangkok), armed once at boot from `instrumentation.ts` (production + nodejs runtime only). Manual, bearer, and scheduled sync share one code path (`lib/cmu-sync-job.ts`).
- **`setTimeout` ceiling (~24.8 days) — never arm a month at once:** a delay > ~2^31 ms is treated as `1` (fires immediately). `armDelayMs(now)` caps the wait at `CAP_MS = 24h`; the chain converges to fire EXACTLY at 00:00 on the 1st Bangkok. The handle is `unref()`'d.
- **Idempotency is the guarantee:** every tick (and boot) skips when `alreadyRanThisMonth` is true — the most recent `IMPORT`/`cmu_alumni` `ActivityLog` is at/after this Bangkok month's 1st 00:00 (`monthStartInstantBangkok` = `Date.UTC(y, m0, 1) - 7h`; Bangkok is fixed UTC+7, NO DST). So it runs EXACTLY once/month regardless of double-fire, restart-re-arm, or an admin having already synced.
- **Boot catch-up:** `startCmuScheduler()` runs one `runTick("boot")` — if the server was down on the 1st and boots mid-month without having synced, the missed sync runs once. Opt out: `CMU_SYNC_CRON_DISABLED=1`.
- **Prevention:** pure time math takes an injectable `now`, pinned by `tests/cmu-scheduler-time.test.ts`. New scheduler-like jobs must (1) cap `setTimeout` under ~24.8 days, (2) be idempotent via an existing durable record, (3) arm production-only from `instrumentation.ts`, (4) `unref`, (5) never throw to the caller. Single-process assumption — if the app scales to replicas, add a DB-backed lock.

### Auth tokens are hashed at rest — every token flow must hash too
- **Rule:** `Session.token` / `PasswordReset.token` / `EmailVerification.token` store `hashToken(raw)` (`lib/auth.ts`, SHA-256 hex); the raw token lives only in the cookie / email link. Every token CREATE stores `hashToken(raw)`; every LOOKUP does `where: { token: hashToken(raw) }`; logout `deleteMany` hashes too. No salt/stretching needed (high-entropy input); no schema change. Pinned by `tests/token-hash.test.ts`.
- **Prevention:** When adding ANY new token flow, route both sides through `hashToken` — never persist or look up a raw token. **Comparisons too:** any secret/token equality check (bearer secrets like `Bearer ${CLEANUP_SECRET}`/`${CMU_SYNC_SECRET}`, the OAuth `state` nonce, webhook signatures) must use `constantTimeEqual(a, b)` (`lib/auth.ts`), never `===`/`!==`. Pinned by `tests/constant-time-equal.test.ts`.

### CSP covers every page route via proxy.ts — public routes need a redirect guard + force-dynamic
- **Rule:** `proxy.ts` is the only CSP source. Keep ALL HTML page routes in its matcher (exclude only JSON API prefixes + static assets). For PUBLIC routes (reachable without a session): (1) the proxy must SKIP its no-cookie redirect for them (`isPublicRoute = path === "/login" || path.startsWith("/graduates")`), else it loops; authed pages under the same prefix also skip and rely on their layout guard; (2) the page must be DYNAMICALLY rendered — nonce auto-injection only happens on `ƒ (Dynamic)` pages.
- **Prevention:** `app/login/layout.tsx` and `app/graduates/layout.tsx` set `export const dynamic = "force-dynamic"` — give any new public page under the nonce CSP the same. No layout reads `x-nonce`; Next auto-injects from the forwarded CSP request header.

### News-body sanitization is centralized in `lib/news-sanitize.ts` — keep `style` in `allowedAttributes` when using `allowedStyles`
- **Rule:** Both news detail pages call the shared `sanitizeNewsBody(body)` (`lib/news-sanitize.ts`) — the SINGLE source for the tag/attribute/iframe-host + inline-style policy. It uses `allowedStyles` keyed by `"*"` to allow only `color`/`background-color`/`text-align` (the Tiptap set; `font-size` is schema-disabled). Since 2026-07 (security #7) bodies are also sanitized on WRITE (`sanitizeNewsBodyForStorage` in POST/PUT `/api/news`); render is the idempotent second layer. `prefixUploadsInHtml` (basePath) is baked in.
- **Prevention (GOTCHA):** sanitize-html runs `allowedStyles` ONLY on tags whose `style` attribute is allowed — to tighten styles you ADD `allowedStyles`; you do NOT remove `style` from `allowedAttributes` (removing it silently strips the editor's own color/align). Don't re-add an inline sanitize config in a new render site. Locked by `tests/news-sanitize.test.ts`.

### Signup → UNVERIFIED → PENDING → ACTIVE (two gates: email verification THEN admin approval)
- **Rule:** Signup has two sequential gates. `/api/alumni-auth/signup` requires a `degreeLevel` select; it best-effort fetches CMU, stores a per-field `signupVerification` snapshot (`lib/signup-verification.ts`), creates an `UNVERIFIED` account + an `EmailVerification` token (24h), and emails a verification link (best-effort; send failure logged, not thrown). No session, no Education row (deferred to approve). Clicking the link → `verify-email` flips to `PENDING`. `verify-email/resend` re-issues (enumeration-safe, UNVERIFIED only, voids prior tokens). Admins `approve` (ACTIVE) or `reject` (REJECTED, **requires a reason**, re-approvable) — `approve` may also override straight from UNVERIFIED. `reapply` (REJECTED→PENDING, email+password identity, no re-verify) re-enters the queue. Only ACTIVE may log in — `login-email` returns 403 with `code:"UNVERIFIED"`/`"REJECTED"` (offering resend / re-apply) or bare 403 for PENDING. Pre-feature PENDING accounts are grandfathered.
- **`signupVerification` is the CMU-vs-submitted snapshot for the admin modal — NOT email ownership.** Two authoritative sources, priority order in `buildSignupVerification(submitted, cmuGrad, cmuConsulted, local?)`: (1) CMU record → `source:"cmu"`; (2) **local `alumni` record** fallback when CMU has no record but the studentId exists locally → `source:"local"` (`localAuthoritativeFromAlumni`). The local branch compares submitted year against `Alumni.graduationYear` (numeric), NOT `Alumni.cohort` (the "รุ่นที่" label) — the applicant's `submitted.cohort` field holds a graduation *year* despite its name. Reverify re-reads the alumni as `local` ONLY when stored `source === "local"`. **All 3 `buildSignupVerification` call-sites** (`signup/route.ts`, `alumni-accounts/[id]/reverify/route.ts`, `reapply/route.ts`) **must pass the local fallback** — never hardcode `null`, or local-only studentIds render "ไม่พบรหัสนักศึกษา".
- **Education/snapshot/grad-log creation stays at approve** (not signup), so a rejected signup never pollutes degree data.
- **Email provider = CMU Email API** (`lib/email.ts`): alumni mail goes through CMU's SMTP relay via a two-step OAuth flow — `POST {CMU_EMAIL_API_BASE_URL}/EmailApi/GetToken` (client credentials → 24h Bearer, cached module-scope, refreshed 1h before expiry) then `POST /EmailApi/SendEmail` with `{subject, sent_to, message, system_name}` + `Authorization: Bearer`. `sendEmail({to,subject,message})` is the shared primitive (throws on failure; the 5 call sites are best-effort `try/catch`). Bodies are **plain text** — the relay's `message` field is text, NOT HTML; even `<a>`/`<table>` render as literal tags in Gmail (only `<br/>`→newline). **A clickable/styled button is impossible** through this transport; raw URLs are the only option. Env: `CMU_EMAIL_API_BASE_URL`/`CMU_EMAIL_CLIENT_ID`/`CMU_EMAIL_CLIENT_SECRET`/`CMU_EMAIL_SYSTEM_NAME`. nodemailer/SMTP/Resend are gone. New actions `EMAIL_VERIFY`/`EMAIL_VERIFY_REQUEST` in `LogAction`.
- **Password reset:** `forgot-password` issues a 1-hour token to ACTIVE **or REJECTED**, non-suspended alumni with a `passwordHash` (enumeration-safe; REJECTED admitted so a rejected user can reset + reapply — resetting does NOT change accountStatus), invalidates prior unused tokens, best-effort send. `reset-password` re-checks ACTIVE-or-REJECTED/non-suspended, requires `password === confirmPassword` server-side, hashes, marks token `used`, deletes all the alumni's `Session`s. Both rate-limited per IP + logged. Email links use `${PUBLIC_BASE_URL}/alumni/graduates/<page>` (basePath baked into the literal — copy the pattern; the old reset link 404'd by pointing at `/alumni/reset-password`).

### CMU GET requests can't carry a body — read from the local table / pass auth as query string
- **Rule:** Node's `fetch` (undici) throws `TypeError: Request with GET/HEAD method cannot have body` if auth is attached as a body to a GET.
- **Prevention:** `fetchCmuGraduateById` (`lib/cmu-registrar.ts`) reads the local `cmu_graduates` table (NOT a per-id GET). `fetchFromCmuApi` passes auth as a query string for GET. **If you add another CMU endpoint, never send a body with GET/HEAD.**

### `Education` models multiple degrees; `Alumni` carries a denormalized primary snapshot
- **Model:** `Education` (`@@unique([alumniId, degreeLevel])`, `studentId @unique`) holds every degree; `Alumni.studentId` stays unique+populated (FK target for the 6 related tables + signup/import identity). `Alumni` KEEPS a denormalized **primary** snapshot (`studentId`/`degreeLevel`/`graduationYear`/`major`/`cohort`) + `primaryEducationId`.
- **Primary = highest degree (auto-derived, never manual):** `recomputePrimaryEducation(alumniId, tx?, excludeId?)` (`lib/education-sync.ts`; ranks by `DEGREE_RANK` then most-recent year) sets `primaryEducationId` then `syncPrimarySnapshot` mirrors the 5 degree fields (NOT names). Runs after every add/edit/delete (PUT/DELETE `/api/educations/[id]` in the `$transaction`; the add routes + signup `approve` after the create). **Never edit the snapshot directly.** No field/endpoint exposes `primaryEducationId`, so it can't be pointed at a lower degree by hand. Re-pointing the snapshot `studentId` cascades to the 6 related tables via `ON UPDATE CASCADE`; deleting the primary reassigns to next-highest. `Education.firstName`/`lastName` = name at study time (from CMU). UI: `components/EducationSection.tsx`.
- **Every alumni-creation path must also create the primary `Education` row:** the view table reads degree info from the CMU merge, but `EducationSection` reads **local** rows — so a record with only the snapshot shows "ยังไม่มีข้อมูลการศึกษา". Every creation path (`ensureAlumni`, `POST /api/alumni` + `/import`, `create-with-related`; the 6 related imports use `lib/alumni-link.ts`) must call `ensurePrimaryEducationFromSnapshot(alumniId, tx?)` right after `alumni.create`.

### Profile view = 3 ordered sections (ข้อมูลส่วนตัว / ประวัติการศึกษา / ข้อมูลติดต่อ) + 6 related
- **Rule:** Both `/management/alumni/[id]` (admin) and `/graduates/(authed)/profile` (alumni-self) render: **ข้อมูลส่วนตัว** (คำนำหน้า/ชื่อ/นามสกุล/วันเกิด via `formatBirthDateThaiSlash`) → **ประวัติการศึกษา** (`EducationSection` cards) → **ข้อมูลติดต่อ** (อีเมล/เบอร์โทรศัพท์/ที่อยู่ปัจจุบัน = `homeAddress`) → the 6 related sections. The old 8-field "ข้อมูลพื้นฐาน" grid and "ข้อมูลการทำงาน" section are gone (`currentWorkplace`/`country`/`province` dropped from `Alumni`; `maidenLastName`+`newLastName` merged into `lastName`).
- **Prevention:** Admin uses `HotInfoField`/`OrangeCell` on personal + contact fields; alumni-self uses plain `InfoField`. `homeAddress` is wired into `profileFormSchema`/create-update-with-related/`alumni-profile`/forms.

### Running dev server caches the OLD Prisma client after a migration (restart; if that fails, clear `.next`)
- **Rule:** After `prisma migrate`/`generate` against a schema change, the running dev server holds the PRE-change client in `globalThis.__prisma` and/or Turbopack's persistent cache — symptoms: HTTP 500 (`The column … does not exist`) OR selective dev-only 404s for routes whose module graph imports the client (routes that redirect earlier — layout/proxy guards → 307 — never reach the broken graph).
- **Prevention:** (1) restart the dev server; (2) if 500s or selective 404s persist, **`rm -rf .next` then restart** (a plain restart does NOT clear Turbopack's persistent cache). Verify the data layer independently with a `node --env-file=.env --import tsx` script and confirm `npm run build` + `npm run test` pass before blaming the code. **Docker dev container is now self-healing:** `scripts/dev-watch.mjs` (the `app` command) regenerates the client + respawns `next dev` on any `schema.prisma` change, so a host-side `migrate dev` is picked up automatically — no `docker compose exec app npx prisma generate` / `restart` needed. If the watcher is ever bypassed, the fallback is `docker compose restart app` (the boot-time generate alone self-heals). For an additive nullable column: `migrate status` → `migrate dev --create-only` → `migrate deploy` → `generate`; never `migrate reset`.

### Alumni identity resolution, override flag & activity-log changes
- **Name resolution:** the personal-info name defaults to the **highest** degree's study-time name, re-synced by `syncNameFromHighestDegree(alumniId, tx?)` (`lib/name-sync.ts`) whenever the degree set changes, UNLESS `Alumni.nameManuallyUpdated` is true (only `firstName`/`lastName` sync; `prefix` has no per-degree source). Every edit sets `nameManuallyUpdated=true` (alumni PUT routes). There is **no edit-reason selector anymore** (`editReasonField` returns an optional string only so update schemas can pass `reason` to the log).
- **Auto graduation logging is gone:** adding an education logs a single real `CREATE`/`education`; `education` is NOT in `TRACKED_FIELDS`.
- **Activity-log payload & surface:** `logActivity` runs FIRST (capture its id), then `recordFieldChanges({ ..., activityLogId })` LINKS field changes to it — one edit = one timeline entry. CREATE routes build `details` carrying the full record (`alumniRecordDetails`/`educationRecordDetails`/`recordDetailsFromFields` in `lib/log-payload.ts`). The surface (`lib/log-detail.ts`) stays terse ("แก้ไขนามสกุล"); values live in the modal. Alumni self-edit additionally captures per-section adds/removes (`details.sectionChanges`). `logActivity` accepts a `tx`.

### Adding an education must pass the same-person (birthday) identity guard
- **Rule:** `assertEducationSamePerson` (`lib/education-identity.ts`, server-only) is called by the education add/edit routes (only when `studentId` changes) + the lookup preview. It compares the new studentId's CMU birthday to the alumni's birthday (names change between degrees, so name is NOT decisive) and returns a 400 Thai error on mismatch. It **fails OPEN** (allows) when CMU is unreachable or either side lacks a birthday, so an outage / sparse record doesn't block all edits. `GET /api/cmu-alumni/lookup?studentId=…&alumniId=…` returns `samePersonWarning`.
- **Claim guard (deterministic, no fail-open):** `findStudentIdClaimOwner(studentId, excludeEducationId?)` + `claimedByOtherMessage` runs BEFORE the birthday check — it is DB-only (`Education.studentId` globally `@unique`), so it blocks a studentId already owned by another alumni even when the birthday guard can't verify (surfaces a 'contact admin' message; admin variant names the owner). The DB unique constraint + the routes' P2002 catch are the race/edge safety net.
- **Prevention:** Per PRD §3.1.2 an alumni's educations are their OWN FON degrees. Audit/cleanup of pre-existing strays: `node --env-file=.env --import tsx scripts/remove-stray-education.ts` (`DRY_RUN=1`).

### Rate-limit IP extraction is centralized in `getClientIp` — trusts the reverse proxy
- **Rule:** All rate-limit sites use `getClientIp(headers)` (`lib/get-client-ip.ts`), which prefers `X-Real-IP` then the RIGHTMOST `X-Forwarded-For` (a single reverse proxy appends the real client IP last) — NOT the spoofable leftmost XFF. `lib/rate-limit.ts` `prune`s expired entries + enforces `MAX_STORE_SIZE`.
- **Prevention:** **Requires the nginx proxy to set `X-Real-IP $remote_addr`** (it overwrites client spoofing) — without it, headers are client-controlled and the rate limit is bypassable. (The old "`getIp` MUST stay" lesson is obsolete — `getClientIp` is the single helper.)

### Alumni login events live in `ActivityLog` as `action='LOGIN'` (use ActivityLog, NOT Session)
- **Rule:** `Alumni.lastLoginAt` is overwritten each login (recent-only) and `hasLoggedIn` is one boolean; `Session` rows are pruned on expiry — neither reconstructs history. The durable record is `ActivityLog`: `POST /api/alumni-auth/login-email` writes `logActivity(ctx, "LOGIN", "alumni_auth", alumni.id, { method: "email" })` on every success.
- **Prevention:** Count logins from `ActivityLog` (append-only, indexed on `createdAt` + `alumniId`): filter `actorType='ALUMNI'` AND `action='LOGIN'` AND `resource='alumni_auth'`. Per-month: `COUNT(*)` = logins, `COUNT(DISTINCT "alumniId")` = active alumni, bucketed by Thai month (`date_trunc('month', "createdAt" AT TIME ZONE 'Asia/Bangkok')`). Implemented by `GET /api/alumni-activity` + `/management/alumni-activity`.

### Uploaded/public images must be basePath-prefixed at render (`assetUrl`)
- **Rule:** `basePath: "/alumni"` means `public/uploads/x.png` is served at `/alumni/uploads/x.png`, but the upload route + DB store the path basePath-**relative** (`/uploads/x.png`) on purpose. Render sites that use raw `<img src={storedPath}>` → browser requests `/uploads/x.png` → 404.
- **Prevention:** Never render a stored/uploaded asset path directly. Wrap with `assetUrl(path)` (`lib/asset-url.ts`, client-safe — prepends `BASE_PATH` for relative paths; leaves `http(s)://`, `//`, `data:`, already-prefixed untouched). For rich-text HTML blobs use `prefixUploadsInHtml(html)` at render (and loading into Tiptap) and `stripUploadsInHtml(html)` before persist. Do NOT bake `/alumni` into stored URLs.

### News body editor is Tiptap v3 (replaced the bespoke execCommand editor)
- **What:** `components/news/RichTextEditor.tsx` (`useEditor` + `<EditorContent>`) + `RichTextToolbar.tsx`. The OLD `contentEditable` + `document.execCommand` editor is GONE — do not reintroduce execCommand. Packages: `@tiptap/react` + `@tiptap/pm` (peer) + `@tiptap/starter-kit` (+ `extension-text-style`/`-highlight`/`-text-align`/`-character-count`/`-image`).
- **Feature set = "clean modern set":** bold/italic/underline/strike, H1–H3, bullet/numbered list, 4-way align, link, text color, highlight, undo/redo, clear-formatting. **px font-size and tables are dropped by decision.** StarterKit v3 already bundles Bold/Italic/Strike/Underline/Link/Heading/Lists/History — do NOT add `@tiptap/extension-link`/`-underline`/`-strike` (double-register throw). Color from `TextStyleKit`; configure `{ fontSize:false, fontFamily:false, lineHeight:false, backgroundColor:false }`. `Image` is registered **read-only** (no insert button) so legacy inline `<img>` survive re-editing.
- **basePath round-trip:** load `prefixUploadsInHtml(body)` into the editor; `onUpdate` emits `stripUploadsInHtml(editor.getHTML())`. The render path (sanitize-html) is permissive — only **re-editing** a body that used font-size/tables loses those (text survives).
- **react-hook-form wiring (uncontrolled):** `<RichTextEditor key={editingId ?? "new"} value={prefixUploadsInHtml(getValues("body")||"")} onChange={html=>setFormValue("body",html)} />`. `key`-remount loads a fresh doc per item. `handleSave` trusts `data.body` (Tiptap fires `onUpdate` reliably). Char/word count from the `CharacterCount` extension. Do NOT introduce RHF `Controller`.
- **`immediatelyRender: false`** is required (SSR/App-Router).
- **Tiptap toolbar buttons need NO `onMouseDown preventDefault`** — every command chains `.focus()`. Link editor uses a shadcn `Popover` + `Input` (NOT `window.prompt`).
- **React-Compiler lint traps (authoritative — fail `npm run lint`):** (1) never write a ref during render (`react-hooks/refs`) — update it in a `useEffect([onChange])`, seed via `useRef(onChange)`; (2) never `setState` synchronously in an effect (`react-hooks/set-state-in-effect`) — use the repo's "adjust state when a prop changes" pattern (a `wasOpen`/`setWasOpen` guard run during render, same shape as `SearchInput`).
- **News status default & create options:** `News.status` defaults to `DRAFT`. The form `<select>` offers `DRAFT`/`PUBLISHED` on **create**, and `DRAFT`/`PUBLISHED`/`DISCONTINUED` when **editing** (`editingId` gates the DISCONTINUED `<option>`). PUT clears `pinnedAt` on the DISCONTINUED transition and stamps `publishedAt` on (re)PUBLISHED. The list filter keeps all three statuses.

### Pinned news "ประชาสัมพันธ์สำคัญ" — `pinnedAt` is the flag; the default list excludes pinned; discontinuing clears the pin
- **Rule:** News has a nullable `pinnedAt` (non-null ⇒ pinned). Admins pin/unpin via `POST /api/news/[id]/pin { pinned }` (idempotent). Both admin + alumni news pages render a "ประชาสัมพันธ์สำคัญ" section at the top; alumni see it read-only.
- **Rules:** (1) `GET /api/news` excludes pinned by default; `?pinned=true` returns only pinned (`pinnedAt desc`). (2) The pinned-section query is intentionally **NOT** `enabled`-gated — a standby observer does not reflect force-refetched data (see that pitfall); the section is render-gated on `pinnedItems.length > 0`. (3) Discontinuing clears the pin (single/bulk/PUT→DISCONTINUED); restoring is NOT auto-repinned. (4) Only PUBLISHED can be pinned — the pin button AND unpublish button render only when `status === "PUBLISHED"`; a non-published card shows a green เผยแพร่ quick-action (`PUT { status: "PUBLISHED" }`). `POST /api/news/[id]/pin` rejects pin-on-non-published with 400; unpin allowed on any status. (5) Pin activity logs as `UPDATE`; `pinnedAt`/`status`/`title` tracked via `TRACKED_FIELDS.news`. Both pages use a shared `renderNewsCard(item)` for the pinned section AND the grid.

### Never `git checkout <tree> -- <path>` (or `git restore --source`/`reset --hard`) with uncommitted work
- **Rule:** A working-tree-overwriting git command (`git checkout main -- .`, `git restore --source`, `reset --hard`) with uncommitted changes wipes them — the feature branch had no commits, so the "restore" pulls the same overwritten content; `git reflog` only tracks HEAD moves, not working-tree blobs.
- **Prevention:** **Commit or `git stash` FIRST.** To compare against `main`, diff (`git diff main`) or use a separate worktree — never overwrite the live tree. The Working Protocol's "branch + commit before verifying" order exists so a botched verify can't lose the work.

### react-hook-form + React Compiler lint gotchas (`watch`, `Control` invariance, `zodResolver`)
- **Resolver:** `zodResolver`'s inferred type doesn't match `useForm<T>`'s `Resolver<T>` — use `resolver: zodResolver(schema) as unknown as Resolver<T>` (import `type Resolver` from `react-hook-form`).
- **`watch()`:** react-hook-form's `watch()` returns a value the React Compiler can't track → `react-hooks/incompatible-library` (benign — works, just not optimized). Prefer `getValues("field")` for a one-time read; for reactive `watch`, keep it + a documented `// eslint-disable-next-line react-hooks/incompatible-library`.
- **Shared form helpers** that take `control`/`register`/`errors` must be **generic** over field values — `<TFieldValues extends FieldValues>(...)` with `Control<TFieldValues>` etc. (RHF's `Control<T>` is invariant) — NOT a fixed `Control<FieldValues>`. `name` is `FieldArrayPath<TFieldValues>`; dynamic per-row register paths cast `as FieldPath<TFieldValues>`.

### Side effects inside a `setState` updater double-fire under React StrictMode (dev) — duplicated form rows
- **Rule:** React StrictMode (on by default in `next dev`) double-invokes state-updater functions to surface impurities. A `setSections((prev) => { … append(...); return … })` that calls `useFieldArray().append(...)` inside the updater fires `append` twice → two rows. (Production runs once.) Event handlers and effects are NOT double-invoked this way.
- **Prevention:** Keep `setState((prev) => …)` updaters **pure** (compute + return only). Run side effects in the event-handler body: read the current value from the render closure (`const willOpen = !sections[key]`), act on it, then a pure `setSections((prev) => ({ ...prev, [key]: !prev[key] }))`.

### Every import writes an IMPORT log (`logImport`) — counts + failed rows, never silent
- **Rule:** Every `POST /api/{entity}/import` (and `POST /api/cmu-alumni/sync`) calls `logImport({ ctx, resource, fileName, attempted, created, updated, failed, errors })` (`lib/import-log.ts`, server-only). It stores summary counts + the failed-rows list (`errors: [{ row, message }]`, capped at `MAX_IMPORT_ERRORS_IN_LOG = 50`, with `errorsTruncated`/`totalErrors`). The logs surface the kind + inline สร้าง/อัปเดต/ผิดพลาด counts (`extractImportDetails` in `lib/log-detail.ts`); the detail modal shows summary + failed rows. HTTP response shape is unchanged.
- **Prevention:** When adding a NEW import route, call `logImport` — don't regress to a silent import.

### Read-heavy endpoints are TTL-cached (`lib/cache.ts`) to stay under the Prisma "operations" quota
- **Rule:** The Prisma Postgres "Total Operations" quota is a **query-COUNT** limit (the DB hit `planLimitReached` once and locked). Operations = a query-count quota, so the lever is *fewer Prisma calls*, not less data. `$transaction` does NOT cut it (each query inside still counts).
- **Prevention:** Wrap read-heavy, rarely-changing payloads in `withTtlCache(key, ttlMs, fn)` (`lib/cache.ts`, server-only — module-level `Map`, persists per Node process; the app is `output: "standalone"` Docker, NOT serverless). Dashboard + alumni-count are cached 60s (TTL-only — no write-route busting; errors aren't cached). Force freshness via `bustCache("dashboard")` / `bustCachePrefix("alumni")`.

### alumni-agency in-country (Thailand) tab is the SAME model split by `country` — NOT the `alumni` table
- **Rule:** Both tabs read the **same** `/api/alumni-agency` model; `country` is the discriminator. `?region=thailand` keeps Thailand-valued countries, `?region=abroad` the rest (`NOT`), via `isThailandCountry` / `THAILAND_COUNTRY_VALUES` (`lib/alumni-agency-region.ts`, client-safe — ไทย/ประเทศไทย/Thailand/Thai). Filter applies in `GET` + `export` (POST bulk-export is id-based). **Both tabs are ONE single-table CRUD surface** — the CRUD button row, per-row จัดการ, bulk selection, and create/edit form render for BOTH modes (don't gate CRUD on `mode` — that was the original bug).
- **Columns:** built from a shared 7-column prefix; abroad puts **ประเทศ** in the location slot, in-country puts **จังหวัด** there; both add **ตำแหน่ง** after workplace. Don't derive one tab's columns from the other's once they differ by more than one column.
- **In-country create** defaults `country` to `THAILAND_DEFAULT_COUNTRY` (`"ประเทศไทย"`) and hides it (`<input type="hidden">` — schema still requires it). **จังหวัด** is shown+required (a `<datalist>` of 77 provinces, `lib/thai-provinces.ts`) in thailand mode, hidden in abroad. `province`/`position` are nullable at the DB layer; required-ness (Thailand ⇒ province non-empty) is enforced by a zod refine in both the page form + API schemas. `switchMode` resets page/search/sort (disjoint datasets). `studentId` is a nullable FK; `?unlinked=true` filters rows flagged รอเชื่อมโยง (`pendingStudentId != null`).

### `studentId` is a FK on all 6 related entities — an unknown id goes in `pendingStudentId`, never the FK column
- **Rule:** `studentId String?` is a FK to `Alumni.studentId` (`onDelete: Cascade`) on Award/Association/GraduateCommittee/Potential/ModelRepresentative/AlumniAgency; each also has `pendingStudentId String?`. A non-null `studentId` REQUIRES a matching `Alumni`, so an unknown id can't live there. Imports do NOT create a stub — they use `resolveAlumniLink`/`buildAlumniEntityMatchWhere` (`lib/alumni-link.ts`): hit → link (`studentId` set, `pendingStudentId` null, back-fill `major`); miss → store the id in `pendingStudentId`, null `studentId`. The "unlinked" predicate is `pendingStudentId != null`; export round-trips `studentId || pendingStudentId`.
- **Dedup:** nullable `studentId` breaks the composite `@@unique` (Postgres nulls are distinct), so imports dedup via `findFirst({ AND: [ buildAlumniEntityMatchWhere(…), { <natural-key cols> } ] })` — the name clause is restricted to `studentId:null, pendingStudentId:null`.
- **Auto-link at canonicalization:** when an alumni becomes canonical, `autoLinkPendingForAlumni(studentId, …)` flips every matching pending row into a real FK link (set `studentId`, clear `pendingStudentId`), overwrites the row's `prefix`/`firstName`/`lastName` with the alumni's (alumni wins, on diff), and (agency only) migrates the row's `homeAddress` onto the alumni when the alumni has none. Fires at admin create / create-with-related / import / signup-approve (uniform rule: "link when the alumni becomes canonical/ACTIVE"). Signups do NOT link at signup/verify-email/reject. The manual typeahead link (`alumni-agency/[id]` PUT) applies the same alumni-wins rename. One `LINK` log per event; idempotent. Pre-existing pending rows backfilled by `scripts/link-pending-records.ts` (ACTIVE-only, `DRY_RUN=1`).
- **FK is to the PRIMARY `studentId`:** the 6 entities FK to `Alumni.studentId` (the denormalized primary snapshot), so a pending row links only when its `pendingStudentId` IS (or becomes) the primary. A non-primary education's `studentId` can't link pending rows — they stay flagged until that degree is promoted.
- **Direct studentId edits must re-point the primary Education (snapshot coupling):** `Alumni.studentId` is a snapshot that `recomputePrimaryEducation` → `syncPrimarySnapshot` overwrites from the primary Education row. A snapshot-only edit via `PUT /api/alumni/[id]` would silently REVERT on the next education touch — so the studentId-correction path also updates the primary Education's `studentId`. Prefer correcting via the Education record.
- **Direct-seed gotcha:** a `create`/`createMany` whose `data` omits `studentId` inserts NULL (an invisible orphan). Always spread `base = { studentId, … }`; `deleteMany` must clean both linked rows AND same-name NULL-`studentId` orphans.

### Drag-to-pan table scroll — one controller in the admin layout; the move threshold must gate BOTH the pan and the click
- **Rule:** `components/table-pan/DragScrollController.tsx` (mounted once in `app/(admin)/layout.tsx`) lets admins click-and-drag wide tables horizontally. Delegated `document` listeners auto-cover every scrollable `.overflow-x-auto` containing a `<table>` — zero per-page edits.
- **Rules:** mouse/trackpad only (touch scrolls natively); skip `button/a/input/select/textarea/[contenteditable]`; pan is horizontal only (`scrollLeft`); a genuine drag suppresses the trailing `click` (capture-phase) so row `onClick` navigation doesn't fire after a pan, but a plain click still navigates. CSS `cursor: grab` on `.overflow-x-auto:has(table)`, forced `grabbing` via a `drag-panning` class.
- **Trap — the threshold must gate the PAN, not just the click:** `onPointerMove` must `return` (no `scrollLeft` write) until `|dx| > threshold` (5px); only then set `moved=true` and pan. Gating only the click-suppression flag left a click-with-jitter panning slightly AND navigating. `tests/drag-scroll.test.tsx` "under-threshold" case locks this. Test setup: DOM tests need `happy-dom` + `// @vitest-environment happy-dom`; extract side effects into `attachDragScroll(doc)` to test without React (`Object.defineProperty(el, "scrollWidth"/"clientWidth", …)` to fake scrollability; dispatch `PointerEvent`s with `pointerType: "mouse"`).

### Expired session surfaces as a per-query "load failed" — `apiFetch` redirects 401 → `/login`
- **Rule:** `proxy.ts` only checks that the `fon-cmu-session` cookie EXISTS, not that it's valid; layout guards re-run `getSession()` only on server navigation, so a client-side refetch of an expired session hits a route returning **401**, and that query's `isError` branch shows "load failed" while cached queries still render. **This is correct server behavior** — confirm by replaying the token → `HTTP 401`.
- **Prevention / fix:** `apiFetch` (`lib/api-client.ts`) redirects to `${BASE_PATH}/login?expired=1` on any **401** (browser-only, with a loop guard — skip if already under `/login` — and a module-level `redirectingToLogin` flag so concurrent failing queries redirect once), then still throws `ApiError(401)`. It does NOT redirect on **403** (logged-in-but-forbidden — that user is still authed). The `/login` page reads `?expired=1` (amber banner) and defaults to the **alumni** tab when `?audience=alumni` is set — `apiFetch` appends that when the expired request came from `/graduates`. No exclusion list needed: the login page submits via raw `fetch` (never `apiFetch`), so auth-endpoint 401s never reach this path. **`getSession()`/`getAlumniSession()` are admin/alumni-split** — a 401 from a `(admin)` route to an alumni session (or vice-versa) is also "wrong session type". Locked by `tests/api-client.test.ts`.
- **Diagnostic when one feature "fails to load" but the page renders:** check the `sessions` table for a valid (`expiresAt > NOW()`) row FIRST.

### `NEXT_PUBLIC_BASE_URL` is build-time-inlined → use runtime `PUBLIC_BASE_URL` + a fail-safe
- **Rule:** Next.js statically inlines every `process.env.NEXT_PUBLIC_*` at `next build` time. The Dockerfile builds WITHOUT it and `.dockerignore` excludes `.env`, so absolute external URLs (email links + OAuth callback + both logouts) baked `http://localhost:3000` into the compiled server chunk; setting it via `docker run -e`/compose had no effect. Non-`NEXT_PUBLIC_` vars survive as runtime lookups.
- **Prevention:** Absolute external URLs resolve a **server-only, non-`NEXT_PUBLIC_` `PUBLIC_BASE_URL`** at runtime via `getBaseUrl()` (`lib/base-url.ts`, falls back to `NEXT_PUBLIC_BASE_URL` → localhost). Non-public ⇒ NOT inlined ⇒ a deploy targets a new domain WITHOUT rebuilding. Production **fail-safe** (`validateBaseUrl()`): `ok:false` when missing or a loopback host (`localhost`/`127.0.0.1`/`::1`) under `NODE_ENV="production"`; `sendEmail()` throws on `!ok` (best-effort callers log + suppress); the 3 auth redirect routes call `getBaseUrl()` WITHOUT throwing; `instrumentation.ts` logs a loud boot warning. **OAuth `CALLBACK_URL` is separate** (a plain server var AND an independently-registered Entra ID URI — does NOT derive from `PUBLIC_BASE_URL`). `proxy.ts:32` uses `request.url` (runtime-correct).

### Conditionally-`enabled` `useQuery` doesn't reflect force-refetched data
- **Rule:** A standby (`enabled:false`) observer does NOT reflect force-refetched data — `invalidateQueries({refetchType:"all"})` marks the query stale and even runs `query.fetch()`, but the observer's rendered `data` stays at its last value until the query re-enables. (Neither `refetchType:"all"` nor `refetchQueries` rescues it.)
- **Prevention:** Don't `enabled`-gate a query whose data must stay live across mutations. Keep it always-active and gate the SECTION render instead. If you truly must gate the query, refresh its data via `qc.setQueryData()` from the mutation response — NOT via invalidate/refetch. Locked by `tests/news-pin-refetch.test.tsx`.

### `homeAddress` is unified — `Alumni.homeAddress` is the single source of truth; agency rows reflect it (bidirectional)
- **What:** `homeAddress` lives on two tables — `Alumni` (ที่อยู่ปัจจุบัน, what the all-alumni table/profile/export read) and `AlumniAgency` (ที่อยู่บ้าน, the agency form field). `Alumni.homeAddress` is the **single source of truth**; linked agency rows reflect it. Editing either side shows on all three surfaces (all-alumni table, alumni-agency table, alumni profile). Both functions in `lib/alumni-agency-home-sync.ts`; locked by `tests/alumni-agency-home-sync.test.ts`.
- **Agency → alumni** (`syncAgencyHomeAddressToAlumni`, from agency `POST`/`PUT`/`import`): on a linked row whose non-empty address **differs**, update `Alumni.homeAddress` + an `alumni`-scoped `FieldChangeHistory` row + an alumni `UPDATE` log. Policy: skip when unlinked, skip when empty (never clears — an alumni can have several agency rows), skip when unchanged.
- **Alumni → agency** (`mirrorAlumniHomeAddressToAgencies`, from `PUT /api/alumni/[id]`, `update-with-related/[id]`, `alumni-profile`, `/import`): `updateMany` linked non-deleted agency rows' `homeAddress` to the alumni's. **This mirror DOES propagate clears** ("one home address per person") — the opposite of agency→alumni. No log/field-change here: the alumni write route already logged it; this only keeps the agency COLUMN current for the form input.
- **Display:** alumni-agency GET includes `alumni.homeAddress`; `getFieldValue("homeAddress")` returns `alumni?.homeAddress ?? homeAddress`; the cell's `OrangeCell` uses `resourceType:"alumni"` + `recordId:alumni.id` for linked rows. `AlumniAgency.homeAddress` is NOT dropped — it's the form input + the value for unlinked rows + what `create-with-related`/`alumni-profile` agency sub-sections write.
- **At auto-link time:** if a just-linked agency row has a `homeAddress` and the alumni doesn't, it's migrated onto the alumni once (most-recently-updated non-empty row wins).

### Batched Excel imports — bulk reads + `createMany` cut the Prisma op count (quota is query-COUNT, not data size)
- **What:** All 7 `/api/{entity}/import` routes process the whole file in a few batched Prisma calls instead of ~3–16 queries PER ROW. Helpers in `lib/import-batch.ts` (server-only): `fetchAlumniByStudentIds`, `fetchExistingEntityRows`, `linkResultFromMap`, `partitionImport` (create vs update + within-file dedup), `chunkedCreateMany`. The alumni route also uses `ensurePrimaryEducationBulk` + `autoLinkPendingForAlumniBatch` + `mirrorAlumniHomeAddressToAgenciesBulk`. (Measured on a 200-alumni create import: 16.5 ops/alumni → 2.6 ops/alumni (−84.5%).)
- **Prevention / rules when touching an import route:**
  - **Chunk `createMany` at `IMPORT_CHUNK_SIZE = 500`** — Postgres caps ~65535 bind params/statement, so an unchunked multi-thousand-row insert fails. `chunkedCreateMany` handles this + a per-row fallback (one bad row → isolated error, matching the old per-row error contract).
  - **Within-file dedup is load-bearing.** `createMany` does NOT dedup (the old per-row `findFirst`+`create` did, last-wins), so `partitionImport` dedups by composite key before any write.
  - **`createMany` returns no IDs** — only matters for alumni (needs the uuid for the Education FK + autoLink); solved by one re-fetch `findMany` by `studentId`. The person-entities + alumni-agency need no created-row ids.
  - **create vs update is derived from the partition**, not the old `createdAt===updatedAt` timestamp trick.
  - **alumni `ensurePrimaryEducationBulk` sets `primaryEducationId` per-row (1 op/alumni)** — irreducible without raw SQL (each alumni gets a distinct FK value).
  - **The composite match key** is `existingIdentityKey`/`incomingIdentityKeys` (`id:<sid>` → `pid:<pendingId>` → `name:<first>|<last>`, name always included so id-less + nameless rows still match). The 5 person-entities append their natural key (award: `awardName|year`; association: `associationName|position|recordedYear`; committee: `termYear|position`; model-rep: `cohort|generation`; potential: `recordedYear`); alumni-agency has NO natural key; alumni's key is bare `studentId`.

### Excel export columns mirror the page table + round-trip the import (`lib/<entity>-excel.ts`)
- **What:** Every entity with a management table + Excel import/export has a client-safe `lib/<entity>-excel.ts`: an ordered `*_EXPORT_COLUMNS` list, a `<entity>ToExportRow` mapper, and a pure `parse<Entity>Row`. A `tests/<entity>-excel.test.ts` pins (a) column layout = page table and (b) export→import round-trip. Present for `award-excel`, `alumni-excel`, `potential-excel`, `association-excel`, `graduate-committee-excel`, `model-representative-excel`, and `alumni-agency` (whose contract lives in `lib/alumni-agency-parse.ts`, region-aware). alumni's export also drives the merged CMU+local set.
- **Prevention / rules:**
  - **Export columns = the page table's DATA columns in display order** (labels match `<th>`); exclude `ลำดับ` and `จัดการ`. `buildExcelResponse` derives column order from `Object.keys(rows[0])`, so the mapper's key order IS the export order.
  - **The import parser reads by header name (order-independent).** On a label fork (page vs legacy export header), match the table label in the export AND have the parser accept both.
  - **`สาขาวิชา` (major) is alumni-derived, NOT column-sourced** for the 6 person-entities — the export emits it for readability, but the parser deliberately does NOT read it (major comes from `linkResultFromMap`). Don't "fix" the parser to read it.
  - **Preserve the model-representatives inversion** (`เครือข่าย`→`cohort`, `รุ่นที่`→`generation`); the round-trip test pins it.
  - **alumni-agency is region-aware:** `GET ?region=thailand`/`?region=abroad` export that tab's 12 columns (ONE location column, no `ลำดับ`); POST + region-less GET emit the 14-column superset (both location columns + `ลำดับ` = `order`). Two import relaxations: `parseExportFormat` infers `ประเทศไทย` (`THAILAND_DEFAULT_COUNTRY`) when a row has `จังหวัด` but no `ประเทศ`; `order` is nullable (`agencyUpdatePayload` omits it when null, `agencyCreatePayload` defaults 0).
  - **Don't-blank-on-update is entity-specific**, in the route's update builder: awards omits a blank `imageUrl`; alumni omits the 4 export-only fields when blank; alumni-agency omits a null `order`.

### Root-level pages (no layout) shrink-to-fit inside `<body class="flex flex-col">`
- **Rule:** `app/news/[id]` has **no layout of its own**, so its top-level `<div className="mx-auto max-w-4xl …">` is a **direct flex item** of the root `<body className="min-h-full flex flex-col">`. In a column flexbox, auto cross-axis margins (`mx-auto`) **defeat `align-items: stretch`**; with stretch off, the wrapper shrink-to-fits to content width. (Pages under `(admin)`/`(authed)` are shielded — their `mx-auto` wrappers sit inside `<main className="min-w-0 flex-1">`, block flow.)
- **Prevention:** Any page rendered as a direct child of the root flex-col `<body>` (a route with NO matching layout — currently `app/news/[id]`) must add **`w-full`** to its outermost `mx-auto max-w-*` wrapper, or be nested in a layout. Don't rely on `mx-auto` alone to center+fill a root-level page.

### Alumni community forum — opt-in gate + the public-identity select is the single leak surface
- **Rule:** The forum breaks the PRD's "alumni can't see other alumni's data" rule, so it's **opt-in**: `Alumni.communityOptedInAt` must be set. The gate lives in `lib/forum-guard.ts` (`resolveForumReader` = staff OR opted-in alumni; `requireForumAlumni` = opted-in alumni only) and is THE architectural crux — every forum read/write route funnels through it (401 anon, 403 `{code:"NOT_OPTED_IN"}` for a logged-in-but-not-opted-in alum). Staff are opt-in-exempt (they moderate).
- **The public-identity select is the single leak surface:** `SELECT_ALUMNI_PUBLIC_IDENTITY` (`lib/forum-identity.ts`, client-safe — type-only `Prisma.AlumniSelect`) selects ONLY `{id, prefix, firstName, lastName, cohort, degreeLevel, photoUrl}`. EVERY forum query uses `include: { author: { select: SELECT_ALUMNI_PUBLIC_IDENTITY } }` (the same fragment for staff AND alumni — one code path, one leak surface). Contact fields (email/contactEmail/phones/homeAddress/citizenId/birthDate) are never selected, so they can never leak. Staff who need the full record follow a link to `/management/alumni/[authorId]`, NOT via the forum API. Locked by `tests/forum-identity.test.ts`.
- **New FKs use `Alumni.id` (uuid),** NOT the legacy `studentId` (that pattern exists only for the 6 import entities). `ForumTopic`/`ForumReply`/`ContentReport` FK to `Alumni.id`.
- **Plain-text bodies, NOT Tiptap:** `ForumTopic.body`/`ForumReply.body` store raw text; render via `renderForumBody` (`lib/forum-render.ts`) which **escapes FIRST**, then linkifies `http(s)` only, then `\n`→`<br>` — so user text can't inject markup (`<ForumBody>` uses `dangerouslySetInnerHTML` but the helper pre-escapes). A bare `javascript:` URL is never matched. No `sanitize-html`, no rich-text editor for the forum. Locked by `tests/forum-render.test.ts`.
- **Opt-out semantics:** clearing `communityOptedInAt` loses read/post access, but existing posts STAY attributed (standard forum behavior; anonymizing-on-opt-out is a deferred option). Self-edit/delete of own past content stays allowed after opt-out (the PUT/DELETE owner paths check `getAlumniSession` directly, NOT `requireForumAlumni`).
- **Denormalized topic counters:** `ForumTopic.replyCount`/`lastReplyAt` are maintained on reply create/delete inside a `$transaction` (delete recomputes `lastReplyAt` = max remaining reply createdAt, null if none) so the list view stays cheap.
- **Prevention:** New peer-to-peer alumni features MUST (1) go through the opt-in gate, (2) select author identity ONLY via `SELECT_ALUMNI_PUBLIC_IDENTITY`, (3) store plain text (or, if rich text ever needed, reuse the news sanitize pipeline). Add the `proxy.ts` matcher caveat: forum API GETs are NOT in the exclusion list, so a cookieless anonymous request 307→/login (like `news`); the route-handler 401/403 is the real enforcement for in-app calls (cookie present). The `no-public-browsing` test's `GATE_RE` recognizes `resolveForumReader`/`requireForumAlumni`/`resolveForumStaffOrOwner` as gates.

### Alumni community events — BROADCAST visibility (not opt-in) + Bangkok datetime + capacity
- **Rule:** Events use a DIFFERENT visibility model from the forum. The forum is opt-in (`Alumni.communityOptedInAt` required to read/post); **events are a broadcast** — `resolveEventReader` (`lib/event-guard.ts`) = staff OR any ACTIVE alumni, NO opt-in gate (a non-opted-in alum still sees events + can RSVP, because a reunion is for your whole class). Only CREATION is consent-gated: `resolveEventCreator` = staff (`checkWritePermission`) OR opted-in alumni. Two visibility models coexist on purpose — don't collapse them.
- **Datetimes are Bangkok wall-clock:** `startAt`/`endAt` are stored as UTC instants, but the datetime-local picker is naive. The route appends `+07:00` via `bangkokDatetimeLocalToIso` (`lib/event-format.ts`) so the stored instant IS that Bangkok wall-clock; `formatEventDateTimeThai`/`isoToDatetimeLocal` shift +7h back for display/edit-prefill. **Do NOT** interpret datetime-local as UTC or server-local TZ — always pin ±07:00 explicitly (deterministic regardless of the container's TZ env).
- **Capacity = total headcount (attendees + guests),** pure math in `lib/event-capacity.ts` (`rsvpSeats` = 1+guests, `fitsCapacity`). The RSVP route subtracts the alum's CURRENT attending seats before checking (`otherHeadcount = total − currentSeats`) so an update isn't double-counted; `ATTENDING` over capacity → 400 `{code:"EVENT_FULL"}`; `DECLINED` always fits. `guestCount ≤ event.guestLimit`.
- **Organizer is dual:** `organizerAlumniId` (alum, opted-in creator) XOR `organizerUserId` (staff) — exactly one set (app-enforced), both `onDelete:SetNull` so the event survives the organizer's removal. Display: alumni→PhotoAvatar; staff→badge (`EventOrganizerView`).
- **Reports are shared:** events reuse `ContentReport` via `resourceType:"EVENT"` (added to `ForumReportResource`); `POST /api/forum/reports` + the `/management/forum` queue handle event targets. An alum cannot report their OWN event (the self-report guard compares `organizerAlumniId`).
- **Prevention:** New broadcast alumni features use `resolveEventReader` (not the opt-in gate); reuse `SELECT_ALUMNI_PUBLIC_IDENTITY` for organizers/attendees; keep capacity math pure + tested. Alumni can't reach the admin-gated `/api/upload`, so alumni-created events have no cover (staff set covers via the admin page).

### Alumni activity feed — reuses the forum gate; alumni upload via a shared helper
- **Rule:** The feed reuses the forum's opt-in gate (`lib/forum-guard.ts`) verbatim — `resolveForumReader` (reads), `requireForumAlumni` (writes), `resolveForumStaffOrOwner` (delete). Do NOT add a feed-specific guard. The forum + feed are both opt-in alumni text content; the forum is threaded, the feed is flat-with-likes — same gate, different shape.
- **Likes are a toggle on a `@@unique` row:** `FeedLike(postId, alumniId)` is unique, so "unlike" = DELETE the row (+ `likeCount--`), "like" = CREATE (+ `likeCount++`), both in one `$transaction`. The list/detail endpoints add `likedByMe` via ONE batched `feed_likes` query (`postId IN [...] AND alumniId = me`) — not N queries. `commentCount` is maintained the same way on comment create/delete (mirror the forum's `replyCount`).
- **Alumni photos need their own upload route:** `/api/upload` is admin-gated, so alumni attach feed photos via `/api/alumni-upload` (gated on `requireForumAlumni`). Both routes call the shared `saveImageUpload` (`lib/upload.ts`) — identical 5 MB / PNG+JPG / magic-byte validation + same `public/uploads` write + basePath-relative return (render via `assetUrl`). When adding any future alumni-image feature, reuse `saveImageUpload` + an opt-in-gated route — don't duplicate the validation or widen `/api/upload`.
- **Prevention:** New opt-in alumni content features reuse `lib/forum-guard.ts` (no new guard); denormalized counts (likes/comments) maintained in `$transaction`s with the row create/delete; alumni uploads go through a gated route sharing `saveImageUpload`.
