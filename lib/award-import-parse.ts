import { AWARD_TYPE_LABELS } from "@/lib/constants";

export const AWARD_TYPE_THAI_TO_ENUM: Record<string, string> = Object.fromEntries(
  Object.entries(AWARD_TYPE_LABELS).map(([key, value]) => [value, key])
);

export interface ParsedAwardRow {
  studentId: string | null;
  prefix: string | null;
  firstName: string;
  lastName: string;
  major: string | null;
  awardName: string;
  awardType: string;
  year: number;
  link: string | null;
  imageUrl: string | null;
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
  const prefix = row["คำนำหน้า"]?.toString().trim() || null;
  const firstName = row["ชื่อ"]?.toString().trim();
  const lastName = row["นามสกุล"]?.toString().trim();
  const major = row["สาขาวิชา"]?.toString().trim() || null;
  const awardName = row["ชื่อรางวัล"]?.toString().trim();
  const awardTypeThai = row["ประเภทรางวัล"]?.toString().trim();
  const yearStr = row["ปี (พ.ศ.)"]?.toString().trim();
  const link = row["ลิงค์"]?.toString().trim() || null;
  const imageUrl = row["รูปภาพ"]?.toString().trim() || null;
  const description = row["รายละเอียด"]?.toString().trim() || null;

  if (!firstName || !lastName || !awardName || !awardTypeThai || !yearStr) {
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
    data: {
      studentId,
      prefix,
      firstName,
      lastName,
      major,
      awardName,
      awardType,
      year,
      link,
      imageUrl,
      description,
    },
    error: null,
  };
}
