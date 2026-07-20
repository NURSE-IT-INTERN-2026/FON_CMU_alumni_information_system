import ExcelJS from "exceljs";

/**
 * Resolve a user-supplied 1-based row range against the total matching-row count `total`,
 * applying the export-range clamp rules:
 *   - start missing / < 1 / > N  → 1   (start past the end ⇒ start from the top)
 *   - end   missing / > N / < 1  → N   (end past the end or before the start ⇒ go to the end)
 *
 * Returns 1-based inclusive bounds. Empty/missing on both sides → {1, N} (export everything).
 * An inverted range after clamping (start > end) is left as-is, so `items.slice(start - 1, end)`
 * yields an empty export — a documented edge of user error.
 *
 * Pure + server-safe (no Prisma). `N` is the post-where/orderBy row count the user already sees
 * in a full export, so "row 50" is the same row whether exported alone or as part of the full set.
 */
export function resolveRowRange(
  startParam: string | null,
  endParam: string | null,
  total: number
): { start: number; end: number } {
  const n = Math.max(0, Math.floor(total));
  const parse = (v: string | null): number | null => {
    if (v == null) return null;
    const num = Number(v);
    return Number.isFinite(num) ? Math.floor(num) : null;
  };
  let start = parse(startParam);
  let end = parse(endParam);
  if (start == null || start < 1 || start > n) start = 1;
  if (end == null || end > n || end < 1) end = n;
  return { start, end };
}

/**
 * Build an Excel (.xlsx) response from an array of row objects.
 * Columns are derived from the keys of the first row.
 */
export async function buildExcelResponse(
  rows: Record<string, unknown>[],
  sheetName: string,
  filename: string
): Promise<Response> {
  const workbook = new ExcelJS.Workbook();
  // Excel forbids * ? : \ / [ ] (and a 31-char limit) in sheet/tab names. The Thai
  // labels passed in (e.g. "สมาคม/ชมรม") can contain "/", which ExcelJS rejects with a
  // throw — sanitize before adding the worksheet.
  const safeSheetName =
    (sheetName || "").replace(/[*?:\\/[\]]/g, "-").slice(0, 31) || "Sheet";
  const worksheet = workbook.addWorksheet(safeSheetName);

  if (rows.length > 0) {
    worksheet.columns = Object.keys(rows[0]).map((key) => ({
      header: key,
      key,
    }));
    worksheet.addRows(rows);
  }

  const buffer = await workbook.xlsx.writeBuffer();

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}_${dateStr}.xlsx"`,
    },
  });
}
