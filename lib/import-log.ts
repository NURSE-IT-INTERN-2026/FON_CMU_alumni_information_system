/**
 * Import activity-logging helper (SERVER-ONLY — imports `logActivity`/Prisma).
 *
 * Every Excel import writes ONE `IMPORT` activity log whose `details` carries
 * not just counts but the actual list of records that were created/updated —
 * so admins can see *which* records were imported, by whom, when. See the
 * System Logs page (`app/(admin)/management/settings/logs/page.tsx`) + the
 * client-side reader `extractImportDetails` (`lib/log-detail.ts`).
 *
 * `details` shape:
 *   {
 *     fileName, attempted, created, updated, failed,
 *     records: [{ id, name, op }],          // capped at MAX_IMPORT_RECORDS_IN_LOG
 *     truncated, totalRecords,               // honest about any record cap
 *     errors: [{ row, message }],            // capped at MAX_IMPORT_ERRORS_IN_LOG
 *     errorsTruncated, totalErrors           // honest about any error cap
 *   }
 *
 * Large alumni imports can be 11k+ rows; an unbounded JSON cell would bloat the
 * column and lag the modal, so the lists are capped. The cap is NEVER silent:
 * `totalRecords`/`totalErrors` + `truncated`/`errorsTruncated` keep the real
 * totals visible. The summary counts (created/updated/failed/attempted) are
 * always exact regardless of the cap.
 */
import { logActivity, type LogContext, type LogResource } from "@/lib/activity-log";

export interface ImportedRecord {
  /** studentId when the row carries one (null for unlinked rows, e.g. some alumni-agency). */
  id: string | null;
  /** Display name of the person/record. */
  name: string;
  op: "created" | "updated";
}

export interface ImportErrorRow {
  row: number;
  message: string;
}

/** Max records (created+updated) stored verbatim in one IMPORT log. */
export const MAX_IMPORT_RECORDS_IN_LOG = 500;
/** Max per-row errors stored verbatim in one IMPORT log. */
export const MAX_IMPORT_ERRORS_IN_LOG = 50;

export interface ImportDetails {
  fileName: string | null;
  attempted: number;
  created: number;
  updated: number;
  failed: number;
  records: ImportedRecord[];
  truncated: boolean;
  totalRecords: number;
  errors: ImportErrorRow[];
  errorsTruncated: boolean;
  totalErrors: number;
}

export interface BuildImportDetailsInput {
  fileName: string | null;
  attempted: number;
  created: number;
  updated: number;
  failed: number;
  records: ImportedRecord[];
  errors: ImportErrorRow[];
}

/**
 * Pure builder for the IMPORT log `details` object. Applies the record/error
 * caps and stamps the honest totals. Pure (no Prisma) so it's unit-testable.
 */
export function buildImportDetails(input: BuildImportDetailsInput): ImportDetails {
  const totalRecords = input.records.length;
  const totalErrors = input.errors.length;
  return {
    fileName: input.fileName,
    attempted: input.attempted,
    created: input.created,
    updated: input.updated,
    failed: input.failed,
    records: input.records.slice(0, MAX_IMPORT_RECORDS_IN_LOG),
    truncated: totalRecords > MAX_IMPORT_RECORDS_IN_LOG,
    totalRecords,
    errors: input.errors.slice(0, MAX_IMPORT_ERRORS_IN_LOG),
    errorsTruncated: totalErrors > MAX_IMPORT_ERRORS_IN_LOG,
    totalErrors,
  };
}

/** Null-safe file-name capture so routes don't repeat the guard. */
export function captureFileName(file: { name?: string } | null | undefined): string | null {
  return file?.name ?? null;
}

export interface LogImportInput extends BuildImportDetailsInput {
  ctx: LogContext;
  resource: LogResource;
}

/**
 * Build the details (capped) and write the IMPORT activity log. Returns the log
 * id (or null on failure — `logActivity` never throws to the caller).
 */
export async function logImport(input: LogImportInput): Promise<string | null> {
  const { ctx, resource, ...rest } = input;
  const details = buildImportDetails(rest);
  // `logActivity` treats `details` as free-form JSON; the typed ImportDetails
  // shape has no index signature, so cast through `unknown`.
  return logActivity(ctx, "IMPORT", resource, null, details as unknown as Record<string, unknown>);
}
