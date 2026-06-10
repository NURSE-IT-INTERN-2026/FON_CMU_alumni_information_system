import ExcelJS from "exceljs";

/**
 * Read an Excel buffer and return rows as an array of objects keyed by header names.
 * First row is treated as headers. Empty cells default to "".
 */
export async function readExcelRows(
  buffer: ArrayBuffer | Buffer | Uint8Array
): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as ArrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, string>[] = [];
  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    // Skip completely empty rows
    let hasValues = false;
    const obj: Record<string, string> = {};
    headers.forEach((header, colNumber) => {
      if (!header) return;
      const cell = row.getCell(colNumber);
      const value = cell.value ?? "";
      obj[header] = String(
        typeof value === "object" && value !== null && "richText" in value
          ? (value as { richText: { text: string }[] }).richText
              .map((r) => r.text)
              .join("")
          : value
      ).trim();
      if (obj[header]) hasValues = true;
    });
    if (hasValues) rows.push(obj);
  }
  return rows;
}

/**
 * Read an Excel buffer and return rows as arrays (no header mapping).
 * Each row is an array of cell values (string | number).
 * Includes all rows starting from row 1 (headers included).
 */
export async function readExcelRawRows(
  buffer: ArrayBuffer | Buffer | Uint8Array
): Promise<(string | number)[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as ArrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: (string | number)[][] = [];
  for (let i = 1; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    const arr: (string | number)[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const value = cell.value ?? "";
      if (typeof value === "object" && value !== null && "richText" in value) {
        arr[colNumber - 1] = (value as { richText: { text: string }[] })
          .richText.map((r) => r.text)
          .join("");
      } else {
        arr[colNumber - 1] = value as string | number;
      }
    });
    // Only include rows that have at least one non-empty cell
    if (arr.some((v) => v !== "" && v != null)) {
      rows.push(arr);
    }
  }
  return rows;
}

/**
 * Read a specific named sheet from an Excel file on disk as raw rows.
 */
export async function readExcelFileRawRows(
  filePath: string,
  sheetName?: string
): Promise<(string | number)[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = sheetName
    ? workbook.getWorksheet(sheetName)
    : workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: (string | number)[][] = [];
  for (let i = 1; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    const arr: (string | number)[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const value = cell.value ?? "";
      if (typeof value === "object" && value !== null && "richText" in value) {
        arr[colNumber - 1] = (value as { richText: { text: string }[] })
          .richText.map((r) => r.text)
          .join("");
      } else {
        arr[colNumber - 1] = value as string | number;
      }
    });
    if (arr.some((v) => v !== "" && v != null)) {
      rows.push(arr);
    }
  }
  return rows;
}
