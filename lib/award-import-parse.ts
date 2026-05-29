import { AWARD_TYPE_LABELS } from "@/lib/constants";

export const AWARD_TYPE_THAI_TO_ENUM: Record<string, string> = Object.fromEntries(
  Object.entries(AWARD_TYPE_LABELS).map(([key, value]) => [value, key])
);

export interface ParsedAwardRow {
  studentId: string | null;
  recipientName: string | null;
  awardName: string;
  awardType: string;
  year: number;
  description: string | null;
}

export type AwardRowError = { row: number; message: string };

export interface AwardRowResult {
  data: ParsedAwardRow | null;
  error: AwardRowError | null;
}

export function parseAwardRow(
  row: Record<string, string>,
  rowNumber: number
): AwardRowResult {
  const studentId = row["รหัสนักศึกษา"]?.toString().trim() || null;
  const recipientName = row["ชื่อ-นามสกุล"]?.toString().trim() || null;
  const awardName = row["ชื่อรางวัล"]?.toString().trim();
  const awardTypeThai = row["ประเภทรางวัล"]?.toString().trim();
  const yearStr = row["ปี (พ.ศ.)"]?.toString().trim();
  const description = row["รายละเอียด"]?.toString().trim() || null;

  if (!awardName || !awardTypeThai || !yearStr) {
    return { data: null, error: { row: rowNumber, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน" } };
  }

  const awardType = AWARD_TYPE_THAI_TO_ENUM[awardTypeThai];
  if (!awardType) {
    return {
      data: null,
      error: { row: rowNumber, message: `ประเภทรางวัล "${awardTypeThai}" ไม่ถูกต้อง` },
    };
  }

  const year = parseInt(yearStr, 10);
  if (isNaN(year)) {
    return { data: null, error: { row: rowNumber, message: "ปี (พ.ศ.) ไม่ถูกต้อง" } };
  }

  return {
    data: { studentId: studentId || null, recipientName, awardName, awardType, year, description },
    error: null,
  };
}
