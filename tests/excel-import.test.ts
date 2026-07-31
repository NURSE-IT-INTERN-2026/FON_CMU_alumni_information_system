import { describe, it, expect } from "vitest";
import { isXlsxFile } from "@/lib/excel-import";

// Regression test for security #8: import uploads are gated on the .xlsx ZIP
// magic bytes before being handed to exceljs.
describe("isXlsxFile (security #8 — magic-byte gate)", () => {
  it("accepts a buffer starting with the ZIP/OOXML magic (PK\\x03\\x04)", () => {
    expect(isXlsxFile(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]))).toBe(true);
  });

  it("rejects a CSV", () => {
    expect(isXlsxFile(Buffer.from("col1,col2\nrow1\n"))).toBe(false);
  });

  it("rejects a PNG (image magic bytes)", () => {
    expect(
      isXlsxFile(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe(false);
  });

  it("rejects an empty / too-short buffer", () => {
    expect(isXlsxFile(Buffer.from([]))).toBe(false);
    expect(isXlsxFile(Buffer.from([0x50, 0x4b]))).toBe(false);
  });

  it("rejects a buffer that matches the first bytes but not the full magic", () => {
    expect(isXlsxFile(Buffer.from([0x50, 0x4b, 0x03, 0x05]))).toBe(false);
  });
});
