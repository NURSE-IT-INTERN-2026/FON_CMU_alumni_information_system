import { describe, it, expect } from "vitest";
import {
  buildImportDetails,
  MAX_IMPORT_ERRORS_IN_LOG,
  type ImportErrorRow,
} from "@/lib/import-log";
import { extractImportDetails } from "@/lib/log-detail";

describe("buildImportDetails", () => {
  it("passes counts through and stores errors verbatim under the cap", () => {
    const details = buildImportDetails({
      fileName: "awards.xlsx",
      attempted: 3,
      created: 2,
      updated: 1,
      failed: 0,
      errors: [],
    });
    expect(details.fileName).toBe("awards.xlsx");
    expect(details.attempted).toBe(3);
    expect(details.created).toBe(2);
    expect(details.updated).toBe(1);
    expect(details.failed).toBe(0);
    expect(details.errors).toEqual([]);
    expect(details.errorsTruncated).toBe(false);
    expect(details.totalErrors).toBe(0);
  });

  it("caps errors at MAX_IMPORT_ERRORS_IN_LOG and reports an honest total", () => {
    const overflow = MAX_IMPORT_ERRORS_IN_LOG + 10;
    const errors: ImportErrorRow[] = Array.from({ length: overflow }, (_, i) => ({ row: i + 2, message: `bad ${i}` }));
    const details = buildImportDetails({
      fileName: null,
      attempted: overflow,
      created: 0,
      updated: 0,
      failed: overflow,
      errors,
    });
    expect(details.errors).toHaveLength(MAX_IMPORT_ERRORS_IN_LOG);
    expect(details.errorsTruncated).toBe(true);
    expect(details.totalErrors).toBe(overflow);
    expect(details.failed).toBe(overflow);
  });

  it("handles empty errors", () => {
    const details = buildImportDetails({
      fileName: null,
      attempted: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    });
    expect(details.errors).toEqual([]);
    expect(details.errorsTruncated).toBe(false);
    expect(details.totalErrors).toBe(0);
  });
});

describe("extractImportDetails", () => {
  it("round-trips a built details object", () => {
    const built = buildImportDetails({
      fileName: "x.xlsx",
      attempted: 2,
      created: 1,
      updated: 1,
      failed: 1,
      errors: [{ row: 4, message: "ข้อมูลไม่ครบ" }],
    });
    const view = extractImportDetails(built as unknown as Record<string, unknown>);
    expect(view).not.toBeNull();
    expect(view!.fileName).toBe("x.xlsx");
    expect(view!.created).toBe(1);
    expect(view!.updated).toBe(1);
    expect(view!.failed).toBe(1);
    expect(view!.errors).toEqual([{ row: 4, message: "ข้อมูลไม่ครบ" }]);
  });

  it("tolerates the legacy number-only alumni shape { imported, attempted, errors: <number> }", () => {
    const view = extractImportDetails({ imported: 7, attempted: 8, errors: 1 });
    expect(view).not.toBeNull();
    expect(view!.imported).toBe(7);
    expect(view!.attempted).toBe(8);
    expect(view!.created).toBe(0);
    expect(view!.updated).toBe(0);
    expect(view!.failed).toBe(0); // legacy `errors` was a count, not an array
    expect(view!.errors).toEqual([]);
  });

  it("returns null for null / non-import details", () => {
    expect(extractImportDetails(null)).toBeNull();
    expect(extractImportDetails({ changes: [{ field: "x", from: "a", to: "b" }] })).toBeNull();
  });

  it("coerces malformed error entries defensively", () => {
    const view = extractImportDetails({
      created: 1,
      errors: [{ row: "2", message: "bad" }, "oops"],
    });
    expect(view!.errors).toEqual([{ row: 2, message: "bad" }]);
  });
});
