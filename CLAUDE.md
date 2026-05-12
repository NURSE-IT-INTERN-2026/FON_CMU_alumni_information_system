# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Alumni Information System for the Faculty of Nursing, Chiang Mai University (FON CMU). Full product requirements are in `PRD.md`. UI reference screenshots are in `reference/`.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npx prisma migrate dev    # Run migrations (requires DATABASE_URL in .env)
npx prisma generate       # Regenerate Prisma client after schema changes
npx prisma studio         # Database browser
npx tsx prisma/seed.ts    # Run database seed script
```

No test framework is configured yet.

## Architecture

- **Next.js 16** with App Router (`app/` directory). This version has breaking changes from earlier Next.js — read the relevant guide in `node_modules/next/dist/docs/` before writing code.
- **Prisma 7** ORM with PostgreSQL. Schema at `prisma/schema.prisma`. Client generates to `app/generated/prisma/` (import from there, not `@prisma/client`).
- **Prisma PostgreSQL adapter** (`@prisma/adapter-pg`) — the Prisma client is initialized with the `PrismaPg` adapter in `lib/prisma.ts`, using `DATABASE_URL` from `.env`.
- **Tailwind CSS 4** with PostCSS plugin (`@tailwindcss/postcss`).
- **Path alias:** `@/*` maps to project root.

### Prisma client import pattern

```ts
import prisma from "@/lib/prisma";
```

The singleton pattern in `lib/prisma.ts` prevents multiple client instances during hot reload.

## Key Constraints

- **Thai language** primary — all UI labels, column headers, validation messages, and enum values use Thai.
- **Degree levels:** ปริญญาเอก, ปริญญาโท, ปริิญญาตรี, หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล
- **Award types:** รางวัลระดับนานาชาติ, รางวัลระดับชาติ, รางวัลระดับท้องถิ่น
- **Years** use Buddhist calendar (e.g., 2568, not 2025).
