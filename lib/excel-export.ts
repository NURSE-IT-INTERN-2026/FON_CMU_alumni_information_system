import ExcelJS from "exceljs";

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
  const worksheet = workbook.addWorksheet(sheetName);

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
