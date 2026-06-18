export interface ParsedAlumniAgencyRow {
  cohort: string | null;
  prefix: string | null;
  thaiName: string | null;
  englishName: string | null;
  workplace: string | null;
  homeAddress: string | null;
  country: string;
  notes: string | null;
  order: number;
  /** Optional studentId — when present, the import links the row to an alumni
   *  record and auto-fills `major` from the CMU Registrar API. */
  studentId: string | null;
  major: string | null;
}

export function inferCountry(wp: string): string {
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

export function isOriginalFormat(rawRows: (string | number)[][]): boolean {
  const header = rawRows[0] || [];
  const h = header.map((v) => String(v || "").trim());
  return !h.includes("คำนำหน้า") && !h.includes("ประเทศ");
}

export function parseOriginalFormat(
  rows: (string | number)[][]
): { data: ParsedAlumniAgencyRow; rowNumber: number }[] {
  const result: { data: ParsedAlumniAgencyRow; rowNumber: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const cohort = String(r[0] || "").trim() || null;
    const prefix = String(r[1] || "").trim() || null;
    const thaiName = String(r[2] || "").trim() || null;
    const englishName = String(r[3] || "").trim() || null;
    const workplace = String(r[4] || "").trim() || null;
    const homeAddress = String(r[5] || "").trim() || null;
    const notes = String(r[6] || "").trim() || null;
    const country = inferCountry(workplace || "");
    result.push({
      data: { cohort, prefix, thaiName, englishName, workplace, homeAddress, country, notes, order: i, studentId: null, major: null },
      rowNumber: i + 1,
    });
  }
  return result;
}

export function parseExportFormat(
  rows: Record<string, string>[]
): { data: ParsedAlumniAgencyRow; rowNumber: number }[] {
  const result: { data: ParsedAlumniAgencyRow; rowNumber: number }[] = [];
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
        homeAddress: row["ที่อยู่บ้าน"]?.toString().trim() || null,
        country,
        notes: row["หมายเหตุ"]?.toString().trim() || null,
        order: isNaN(order) ? 0 : order,
        studentId: row["รหัสนักศึกษา"]?.toString().trim() || null,
        major: row["สาขาวิชา"]?.toString().trim() || null,
      },
      rowNumber: i + 2,
    });
  }
  return result;
}
