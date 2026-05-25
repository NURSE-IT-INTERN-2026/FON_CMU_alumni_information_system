import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";

function inferCountry(wp: string): string {
  const w = wp.toLowerCase();
  if (w.includes("australia") || w.includes("brisbane") || w.includes("perth")) return "ออสเตรเลีย";
  if (w.includes("canada")) return "แคนาดา";
  if (w.includes("denmark")) return "เดนมาร์ก";
  if (w.includes("new zealand")) return "นิวซีแลนด์";
  if (w.includes("france") || w.includes("paris")) return "ฝรั่งเศส";
  if (w.includes("japan")) return "ญี่ปุ่น";
  if (
    w.includes("usa") ||
    w.includes("u.s.a") ||
    w.includes("california") ||
    w.includes("chicago") ||
    w.includes("texas") ||
    w.includes("new york") ||
    w.includes("illinois") ||
    w.includes("florida") ||
    w.includes("pennsylvania") ||
    w.includes("georgia") ||
    w.includes("missouri") ||
    w.includes("connecticut") ||
    w.includes("maryland") ||
    w.includes("washington") ||
    w.includes("nevada") ||
    w.includes("indiana") ||
    w.includes("kansas")
  )
    return "สหรัฐอเมริกา";
  return "สหรัฐอเมริกา";
}

interface ParsedRow {
  cohort: string | null;
  prefix: string | null;
  thaiName: string | null;
  englishName: string | null;
  workplace: string | null;
  country: string;
  notes: string | null;
  order: number;
}

function parseOriginalFormat(rows: (string | number)[][]): { data: ParsedRow; rowNumber: number }[] {
  const result: { data: ParsedRow; rowNumber: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const cohort = String(r[0] || "").trim() || null;
    const prefix = String(r[1] || "").trim() || null;
    const thaiName = String(r[2] || "").trim() || null;
    const englishName = String(r[3] || "").trim() || null;
    const workplace = String(r[4] || "").trim() || null;
    const notes = String(r[5] || "").trim() || null;
    const country = inferCountry(workplace || "");
    result.push({ data: { cohort, prefix, thaiName, englishName, workplace, country, notes, order: i }, rowNumber: i + 1 });
  }
  return result;
}

function parseExportFormat(rows: Record<string, string>[]): { data: ParsedRow; rowNumber: number }[] {
  const result: { data: ParsedRow; rowNumber: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const country = row["ประเทศ"]?.toString().trim();
    const thaiName = row["ชื่อไทย"]?.toString().trim();
    const englishName = row["ชื่ออังกฤษ"]?.toString().trim();

    if (!country) continue;
    if (!thaiName && !englishName) continue;

    const orderStr = row["ลำดับ"]?.toString().trim();
    const order = orderStr ? parseInt(orderStr, 10) : 0;

    result.push({
      data: {
        cohort: row["รุ่น"]?.toString().trim() || null,
        prefix: row["คำนำหน้า"]?.toString().trim() || null,
        thaiName: thaiName || null,
        englishName: englishName || null,
        workplace: row["สถานที่ทำงาน"]?.toString().trim() || null,
        country,
        notes: row["หมายเหตุ"]?.toString().trim() || null,
        order: isNaN(order) ? 0 : order,
      },
      rowNumber: i + 2,
    });
  }
  return result;
}

function isOriginalFormat(rawRows: (string | number)[][]): boolean {
  const header = rawRows[0] || [];
  const h = header.map((v) => String(v || "").trim());
  // Original file: รุ่น, ชื่อไทย, (empty), ชื่ออังกฤษ, ที่ทำงาน, หมายเหตุ
  // No คำนำหน้า or ประเทศ columns
  return !h.includes("คำนำหน้า") && !h.includes("ประเทศ");
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "กรุณาเลือกไฟล์ Excel" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const errors: { row: number; message: string }[] = [];
    let imported = 0;

    // Read raw rows to detect format
    const rawRows = XLSX.utils.sheet_to_json<(string | number)[]>(worksheet, { header: 1, defval: "" });

    let parsed: { data: ParsedRow; rowNumber: number }[];

    if (isOriginalFormat(rawRows)) {
      parsed = parseOriginalFormat(rawRows);
    } else {
      const objectRows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet);
      parsed = parseExportFormat(objectRows);
    }

    for (const { data, rowNumber } of parsed) {
      if (!data.thaiName && !data.englishName) {
        errors.push({ row: rowNumber, message: "กรุณากรอกชื่อไทยหรือชื่ออังกฤษ" });
        continue;
      }

      try {
        await prisma.abroadAlumni.create({ data });
        imported++;
      } catch (err) {
        console.error("Import row error:", err);
        errors.push({
          row: rowNumber,
          message: `ไม่สามารถนำเข้าข้อมูล: ${err instanceof Error ? err.message : "ข้อผิดพลาด"}`,
        });
      }
    }

    return NextResponse.json({ imported, skipped: 0, errors });
  } catch (error) {
    console.error("POST /api/abroad-alumni/import error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" },
      { status: 500 }
    );
  }
}
