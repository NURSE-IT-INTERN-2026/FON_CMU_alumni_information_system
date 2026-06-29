import { describe, it, expect } from "vitest";
import {
  buildImportDetails,
  MAX_IMPORT_RECORDS_IN_LOG,
  MAX_IMPORT_ERRORS_IN_LOG,
  type ImportedRecord,
} from "@/lib/import-log";
import { extractImportDetails } from "@/lib/log-detail";

const rec = (id: string, op: ImportedRecord["op"] = "created"): ImportedRecord => ({
  id,
  name: `ชื่อ ${id}`,
  op,
});

describe("buildImportDetails", () => {
  it("passes counts through and stores records/errors verbatim under the cap", () => {
    const details = buildImportDetails({
      fileName: "awards.xlsx",
      attempted: 3,
      created: 2,
      updated: 1,
      failed: 0,
      records: [rec("1", "created"), rec("2", "created"), rec("3", "updated")],
      errors: [],
    });
    expect(details.fileName).toBe("awards.xlsx");
    expect(details.attempted).toBe(3);
    expect(details.created).toBe(2);
    expect(details.updated).toBe(1);
    expect(details.failed).toBe(0);
    expect(details.records).toHaveLength(3);
    expect(details.truncated).toBe(false);
    expect(details.totalRecords).toBe(3);
    expect(details.errors).toEqual([]);
    expect(details.errorsTruncated).toBe(false);
    expect(details.totalErrors).toBe(0);
  });

  it("caps records at MAX_IMPORT_RECORDS_IN_LOG and reports an honest total", () => {
    const overflow = MAX_IMPORT_RECORDS_IN_LOG + 250;
    const records = Array.from({ length: overflow }, (_, i) => rec(String(i)));
    const details = buildImportDetails({
      fileName: null,
      attempted: overflow,
      created: overflow,
      updated: 0,
      failed: 0,
      records,
      errors: [],
    });
    expect(details.records).toHaveLength(MAX_IMPORT_RECORDS_IN_LOG);
    expect(details.truncated).toBe(true);
    // totalRecords always reflects the REAL count, not the capped slice.
    expect(details.totalRecords).toBe(overflow);
    // The summary count stays exact regardless of the cap.
    expect(details.created).toBe(overflow);
  });

  it("caps errors at MAX_IMPORT_ERRORS_IN_LOG and reports an honest total", () => {
    const overflow = MAX_IMPORT_ERRORS_IN_LOG + 10;
    const errors = Array.from({ length: overflow }, (_, i) => ({ row: i + 2, message: `bad ${i}` }));
    const details = buildImportDetails({
      fileName: null,
      attempted: overflow,
      created: 0,
      updated: 0,
      failed: overflow,
      records: [],
      errors,
    });
    expect(details.errors).toHaveLength(MAX_IMPORT_ERRORS_IN_LOG);
    expect(details.errorsTruncated).toBe(true);
    expect(details.totalErrors).toBe(overflow);
    expect(details.failed).toBe(overflow);
  });

  it("handles empty records and errors", () => {
    const details = buildImportDetails({
      fileName: null,
      attempted: 0,
      created: 0,
      updated: 0,
      failed: 0,
      records: [],
      errors: [],
    });
    expect(details.records).toEqual([]);
    expect(details.errors).toEqual([]);
    expect(details.truncated).toBe(false);
    expect(details.errorsTruncated).toBe(false);
    expect(details.totalRecords).toBe(0);
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
      records: [rec("9", "created"), rec("8", "updated")],
      errors: [{ row: 4, message: "ข้อมูลไม่ครบ" }],
    });
    const view = extractImportDetails(built as unknown as Record<string, unknown>);
    expect(view).not.toBeNull();
    expect(view!.fileName).toBe("x.xlsx");
    expect(view!.created).toBe(1);
    expect(view!.updated).toBe(1);
    expect(view!.failed).toBe(1);
    expect(view!.records).toEqual([
      { id: "9", name: "ชื่อ 9", op: "created" },
      { id: "8", name: "ชื่อ 8", op: "updated" },
    ]);
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
    expect(view!.records).toEqual([]);
    expect(view!.errors).toEqual([]);
  });

  it("returns null for null / non-import details", () => {
    expect(extractImportDetails(null)).toBeNull();
    expect(extractImportDetails({ changes: [{ field: "x", from: "a", to: "b" }] })).toBeNull();
  });

  it("coerces malformed record/error entries defensively", () => {
    const view = extractImportDetails({
      created: 1,
      records: [{ id: "1", name: "ok", op: "created" }, null, { nope: true }, { id: 5, name: null }],
      errors: [{ row: "2", message: "bad" }, "oops"],
    });
    // `null` is dropped; both malformed objects pass the truthy-object filter
    // and coerce to an empty id/name with op defaulting to "created".
    expect(view!.records).toEqual([
      { id: "1", name: "ok", op: "created" },
      { id: null, name: "", op: "created" }, // { nope: true } → no id/name
      { id: null, name: "", op: "created" }, // { id: 5, name: null } → id not a string, name coerced
    ]);
    expect(view!.errors).toEqual([{ row: 2, message: "bad" }]);
  });
});
