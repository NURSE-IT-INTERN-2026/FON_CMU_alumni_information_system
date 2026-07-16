import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkSuperAdminPermission } from "@/lib/permissions";

/**
 * Superadmin-only column-width preferences for management tables (drag-to-resize).
 *
 * Widths are stored per (userId, tableKey) as a JSON map of column index (string)
 * → px width. A column absent from the map renders auto-width. tableKey may carry
 * a view/mode suffix (e.g. "alumni-agency:thailand", "all-alumni:dedupe") so each
 * mode keeps independent widths.
 *
 * No activity logging — these are high-frequency UI prefs, not auditable data
 * mutations (logging every drag would spam activity_logs).
 */

const MIN_WIDTH = 60;
const MAX_WIDTH = 800;

// tableKey allowlist = the 7 tables × their modes.
const TABLE_KEYS = new Set([
  "awards",
  "associations",
  "graduate-committee",
  "potentials",
  "model-representatives",
  "all-alumni:dedupe",
  "all-alumni:all",
  "alumni-agency:thailand",
  "alumni-agency:abroad",
]);

const widthsSchema = z
  .record(z.string(), z.number().int().min(MIN_WIDTH).max(MAX_WIDTH))
  .refine(
    (rec) => Object.keys(rec).every((k) => /^\d+$/.test(k)),
    { message: "widths keys must be non-negative integer column indices" }
  );

const putSchema = z.object({
  table: z.string().refine((t) => TABLE_KEYS.has(t), {
    message: "Unknown table key",
  }),
  widths: widthsSchema,
});

export async function GET(request: NextRequest) {
  const permErr = await checkSuperAdminPermission();
  if (permErr) return permErr;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const table = request.nextUrl.searchParams.get("table") ?? "";
    if (!TABLE_KEYS.has(table)) {
      return NextResponse.json({ error: "Unknown table key" }, { status: 400 });
    }

    const row = await prisma.tableColumnWidths.findUnique({
      where: {
        userId_tableKey: { userId: session.user.id, tableKey: table },
      },
      select: { widths: true },
    });

    return NextResponse.json({ widths: row?.widths ?? {} });
  } catch (error) {
    console.error("GET /api/table-prefs error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลความกว้างคอลัมน์" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const permErr = await checkSuperAdminPermission();
  if (permErr) return permErr;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { table, widths } = parsed.data;
    const isEmpty = Object.keys(widths).length === 0;

    if (isEmpty) {
      // Empty ⇒ back to all-auto ⇒ delete the row (idempotent).
      await prisma.tableColumnWidths
        .delete({
          where: {
            userId_tableKey: { userId: session.user.id, tableKey: table },
          },
        })
        .catch(() => {
          /* row may not exist; that's the desired all-auto state */
        });
      return NextResponse.json({ widths: {} });
    }

    const row = await prisma.tableColumnWidths.upsert({
      where: {
        userId_tableKey: { userId: session.user.id, tableKey: table },
      },
      update: { widths },
      create: { userId: session.user.id, tableKey: table, widths },
      select: { widths: true },
    });

    return NextResponse.json({ widths: row.widths });
  } catch (error) {
    console.error("PUT /api/table-prefs error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการบันทึกความกว้างคอลัมน์" },
      { status: 500 }
    );
  }
}
