/**
 * Alumni-agency region split (PRD §3.9).
 *
 * The alumni-agency page has two tabs — ข้อมูลในประเทศ (in-country / Thailand)
 * and ข้อมูลต่างประเทศ (abroad) — that share the SAME `AlumniAgency` model and
 * column set. The `country` field is the discriminator: a record whose country
 * is Thailand shows in the in-country tab, every other country shows abroad.
 *
 * This module is CLIENT-SAFE (no Prisma) so both the API route (builds the
 * Prisma `where`) and the page (partitions / derives country lists) agree on
 * exactly which country values count as "Thailand".
 */

/** Lowercase + trimmed country values treated as Thailand. */
export const THAILAND_COUNTRY_VALUES = [
  "ไทย",
  "ประเทศไทย",
  "thailand",
  "thai",
] as const;

/** True when a country value (any case, any surrounding whitespace) is Thailand. */
export function isThailandCountry(
  country: string | null | undefined
): boolean {
  if (!country) return false;
  return (THAILAND_COUNTRY_VALUES as readonly string[]).includes(
    country.trim().toLowerCase()
  );
}
