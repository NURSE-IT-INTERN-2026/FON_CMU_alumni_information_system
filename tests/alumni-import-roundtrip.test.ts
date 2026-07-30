// @vitest-environment node
/**
 * Regression guard for the alumni export→import birthDate round-trip (W4).
 *
 * The all-alumni export writes วันเกิด via formatBirthDateThai (Thai
 * DD-MM-YYYY Buddhist). The import parses it by stripping non-digits, which
 * must reproduce the stored DDMMYYYY-Buddhist form. This locks that invariant
 * so a future change to formatBirthDateThai can't silently break the round-trip.
 */
import { describe, expect, it } from "vitest";
import { formatBirthDateThai } from "@/lib/alumni-verify";

describe("alumni export→import birthDate round-trip (W4)", () => {
  it("a stored DDMMYYYY-Buddhist birthDate survives export + re-import parse", () => {
    const stored = "01122540"; // 1 Dec 2540 BE — the documented stored form
    const exported = formatBirthDateThai(stored); // → "01-12-2540"
    expect(exported).toBe("01-12-2540");
    // Import parse: strip non-digits → back to the stored DDMMYYYY-Buddhist form.
    expect(exported!.replace(/\D/g, "")).toBe(stored);
  });

  it("a Gregorian-stored birthDate still emits Buddhist and parses to 8 digits", () => {
    // Some script-created rows store Gregorian YYYY-MM-DD; the export emits
    // Buddhist either way, and the import parse yields a valid 8-digit form.
    const exported = formatBirthDateThai("1997-12-01");
    expect(exported).toBe("01-12-2540");
    expect(exported!.replace(/\D/g, "")).toHaveLength(8);
  });
});
