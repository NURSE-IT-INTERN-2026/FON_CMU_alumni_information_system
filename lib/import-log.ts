/**
 * Import activity-logging helper (SERVER-ONLY — imports `logActivity`/Prisma).
 *
 * Every Excel import (and the CMU sync) writes ONE `IMPORT` activity log whose
 * `details` carries the summary counts + the list of rows that FAILED (so admins
 * can see who imported what, and diagnose a bad file). It does NOT store the
 * per-record list of created/updated rows — only counts. See the System Logs
 * page (`app/(admin)/management/settings/logs/page.tsx`) + the client-side reader
 * `extractImportDetails` (`lib/log-detail.ts`).
 *
 * `details` shape:
 *   {
 *     fileName, attempted, created, updated, failed,
 *     errors: [{ row, message }],            // capped at MAX_IMPORT_ERRORS_IN_LOG
 *     errorsTruncated, totalErrors           // honest about any error cap
 *   }
 *
 * The summary counts (created/updated/failed/attempted) are always exact
 * regardless of the error cap.
 */
import { logActivity, type LogContext, type LogResource } from "@/lib/activity-log";

export interface ImportErrorRow {
  row: number;
  message: string;
}

/** Max per-row errors stored verbatim in one IMPORT log. */
export const MAX_IMPORT_ERRORS_IN_LOG = 50;

export interface ImportDetails {
  fileName: string | null;
  attempted: number;
  created: number;
  updated: number;
  failed: number;
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
  errors: ImportErrorRow[];
}

/**
 * Pure builder for the IMPORT log `details` object. Applies the error cap and
 * stamps the honest total. Pure (no Prisma) so it's unit-testable.
 */
export function buildImportDetails(input: BuildImportDetailsInput): ImportDetails {
  const totalErrors = input.errors.length;
  return {
    fileName: input.fileName,
    attempted: input.attempted,
    created: input.created,
    updated: input.updated,
    failed: input.failed,
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
