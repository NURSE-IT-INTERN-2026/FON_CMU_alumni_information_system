<!-- BEGIN:nextjs-agent-rules -->
# AGENTS.md — Critical Warnings for AI Agents

## Next.js 16 Breaking Changes

This is NOT the Next.js you know. Version 16 has breaking changes — APIs, conventions, and file structure may all differ from your training data.

**Before writing ANY Next.js code**, read the relevant guide in `node_modules/next/dist/docs/`:
- App Router fundamentals: `node_modules/next/dist/docs/01-app/01-getting-started/`
- API reference: `node_modules/next/dist/docs/01-app/03-api-reference/`
- Migration guides: `node_modules/next/dist/docs/01-app/02-guides/migrating/`

Heed all deprecation notices.

## Prisma 7 — Not Your Training Data Prisma

- **Import from generated path only:** `import prisma from "@/lib/prisma"` (NOT `@prisma/client`)
- The generated client is at `app/generated/prisma/` — the singleton is in `lib/prisma.ts`
- Uses `PrismaPg` adapter (`@prisma/adapter-pg`), not the default Prisma connection pool
- Schema uses `prisma.config.ts` + dotenv, NOT a `datasource url` in schema.prisma
- After schema changes: run `npx prisma generate` (client regenerates to `app/generated/prisma/`)

## Tailwind CSS 4 — CSS-First Config

- **No `tailwind.config.js`** — configuration is in `app/globals.css` using `@theme inline`
- Uses `@import "tailwindcss"` syntax, not `@tailwind base/components/utilities`
- Plugins loaded via `@plugin` directive in CSS, not JS config
- PostCSS config uses `@tailwindcss/postcss`, not `tailwindcss` directly

## React 19

- Server Components are the default in App Router
- `"use client"` directive required for interactive components
- Pages in this project are large client components (700–1100+ lines)

## Project-Specific Patterns

- **Auth is layout-level, not middleware:** `app/(public)/layout.tsx` checks session server-side. There is NO `middleware.ts`.
- **API routes follow a strict pattern:** Each entity has `/`, `/[id]`, `/import`, `/export`, `/bulk-delete` sub-routes.
- **Write permission guard:** Import `checkWritePermission` from `@/lib/permissions` for any mutating API route.
- **Activity logging:** Import `logActivity` from `@/lib/activity-log` for create/update/delete/import/export actions.
- **Role-aware UI:** Use `useRole()`, `useCanWrite()`, `useIsAdmin()` from `@/lib/role-context`.
- **Thai everywhere:** All user-facing strings are in Thai. Buddhist calendar years (e.g., 2569).
- **Rate limiting:** `lib/rate-limit.ts` provides `rateLimit()` for sensitive endpoints.

## Testing

- **Vitest 4** is configured (`vitest.config.ts`). Tests in `tests/` directory.
- Run: `npm run test` (single run) or `npm run test:watch` (watch mode).
- Path alias `@/` is configured in vitest config.
- Coverage via `@vitest/coverage-v8`.

## Environment

- `.env` contains DATABASE_URL, OAuth credentials (CMU/Microsoft Entra ID), and API URLs.
- Do NOT commit changes to `.env` without explicit instruction.
<!-- END:nextjs-agent-rules -->
