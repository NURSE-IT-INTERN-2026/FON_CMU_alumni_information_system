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

10 models in `prisma/schema.prisma`:

| Model | Table | Purpose |
|---|---|---|
| `Alumni` | `alumni` | Core alumni records (studentId unique, degreeLevel, cohort) |
| `Award` | `awards` | Awards linked to alumni (awardType enum, Buddhist year) |
| `Association` | `associations` | Professional associations/positions |
| `GraduateCommittee` | `graduate_committees` | Committee memberships |
| `Potential` | `potentials` | Notable alumni potentials |
| `ModelRepresentative` | `model_representatives` | Model representative entries |
| `AbroadAlumni` | `abroad_alumni` | Alumni working abroad |
| `AdminUser` | `admin_users` | System users with roles |
| `ActivityLog` | `activity_logs` | Audit trail (JSON details) |
| `Session` | `sessions` | Browser sessions (token-based) |

**Enums:** `DegreeLevel` (DOCTORAL, MASTER, BACHELOR, NURSING_ASSISTANT), `AwardType` (INTERNATIONAL, NATIONAL, LOCAL), `NewsStatus` (DRAFT, PUBLISHED)

### Auth & Roles

- **Session-based auth** using `bcryptjs` + HTTP-only cookies (`fon-cmu-session`). Session tokens stored in `Session` model, 7-day expiry.
- **CMU OAuth2** with PKCE via Microsoft Entra ID (`lib/oauth.ts`). Callback at `/intern/api/auth/callback/`.
- **3 Roles:** `superadmin` (full CRUD + user management), `admin` (CRUD + import/export), `executive` (read-only).
- **Role context:** `lib/role-context.tsx` provides `useRole()`, `useCanWrite()`, `useIsAdmin()` hooks.
- **Write permission check:** `lib/permissions.ts` — `checkWritePermission()` returns 401/403 for unauthorized requests.
- **Rate limiting:** `lib/rate-limit.ts` — in-memory sliding-window (5 attempts / 15 min).
- **No middleware.ts** — auth is enforced at the layout level (`app/(public)/layout.tsx` checks session server-side).

### Route Structure

```
app/
├── layout.tsx                    # Root layout (Geist fonts, <html lang="th">)
├── login/page.tsx                # Login page (outside route group)
├── news/[id]/page.tsx            # News detail (public)
├── (public)/                     # Route group — all authenticated pages
│   ├── layout.tsx                # Auth guard + Header/Sidebar/Footer + RoleProvider
│   ├── page.tsx                  # Home (news cards)
│   ├── alumni-count/             # Dashboard with charts
│   ├── awards/                   # Awards table + doughnut chart
│   ├── new-alumni/               # Alumni creation form
│   ├── abroad-alumni/
│   ├── associations/
│   ├── graduate-committee/
│   ├── model-representatives/
│   ├── news/
│   ├── potentials/
│   └── settings/{profile,members,logs}/
├── api/                          # REST API routes
│   ├── abroad-alumni/            # CRUD + import/export/bulk-delete
│   ├── alumni/                   # CRUD + import/export/bulk-delete + create-with-related
│   ├── alumni-count/             # Aggregation endpoint
│   ├── associations/             # CRUD + import/export/bulk-delete
│   ├── auth/{login,cmu-login,logout,cleanup}/
│   ├── awards/                   # CRUD + import/export/bulk-delete
│   ├── graduate-committee/       # CRUD + import/export/bulk-delete
│   ├── logs/                     # Activity logs
│   ├── model-representatives/    # CRUD + import/export/bulk-delete
│   ├── news/                     # CRUD + bulk-delete
│   ├── potentials/               # CRUD + import/export/bulk-delete
│   ├── upload/                   # File upload
│   └── users/                    # User management
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

### Key Libraries

| Library | Purpose |
|---|---|
| `chart.js` + `react-chartjs-2` | Chart rendering (doughnut, bar) |
| `recharts` | Data visualization (line graphs) |
| `xlsx` | Excel import/export parsing |
| `sanitize-html` | HTML sanitization for news body |
| `bcryptjs` | Password hashing |

### Deployment

- **Docker:** Multi-stage Dockerfile (node:20-alpine), `output: "standalone"` in next.config.ts.
- **docker-compose.yml:** PostgreSQL 17 + app service.
- **CSP headers** configured in `next.config.ts` (YouTube/Vimeo frame-src, strict defaults).
- **Security headers:** X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy.

### Shared Components & Utilities

| File | Purpose |
|---|---|
| `components/Header.tsx` | Sticky header with mobile hamburger |
| `components/Sidebar.tsx` | Collapsible sidebar navigation |
| `components/Footer.tsx` | Simple footer |
| `lib/constants.ts` | Thai labels, nav items, page size |
| `lib/activity-log.ts` | Audit logging utility |
| `lib/ensure-alumni.ts` | Auto-create Alumni on import if studentId not found |
| `lib/useBulkSelection.ts` | React hook for bulk table row selection |
| `lib/abroad-alumni-parse.ts` | Excel parser for abroad alumni |
| `lib/award-import-parse.ts` | Excel parser for awards |

## Key Constraints

- **Thai language** primary — all UI labels, column headers, validation messages, and enum values use Thai.
- **Degree levels:** ปริญญาเอก, ปริญญาโท, ปริญญาตรี, หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล
- **Award types:** รางวัลระดับนานาชาติ, รางวัลระดับชาติ, รางวัลระดับท้องถิ่น
- **Years** use Buddhist calendar (e.g., 2569, not 2026).
- **Thai fonts:** Sarabun, Noto Sans Thai loaded in globals.css.
- **Monolithic page components** — pages in `(public)/` are large client components (700–1100+ lines). When modifying, be aware of the full scope.
