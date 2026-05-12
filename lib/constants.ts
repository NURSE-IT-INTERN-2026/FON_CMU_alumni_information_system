export const DEGREE_LABELS: Record<string, string> = {
  DOCTORAL: "ปริญญาเอก",
  MASTER: "ปริญญาโท",
  BACHELOR: "ปริญญาตรี",
  NURSING_CERTIFICATE: "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล",
};

export const AWARD_TYPE_LABELS: Record<string, string> = {
  INTERNATIONAL: "รางวัลระดับนานาชาติ",
  NATIONAL: "รางวัลระดับชาติ",
  LOCAL: "รางวัลระดับท้องถิ่น",
};

export const DEGREE_OPTIONS = Object.entries(DEGREE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const AWARD_TYPE_OPTIONS = Object.entries(AWARD_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const NAV_ITEMS = [
  { href: "/", label: "หน้าหลัก" },
  { href: "/alumni-count", label: "จำนวนศิษย์เก่า" },
  { href: "/awards", label: "รางวัล" },
  { href: "/potentials", label: "ศักยภาพศิษย์เก่า" },
  { href: "/associations", label: "สมาคม/ชมรม" },
  { href: "/graduate-committee", label: "คณะกรรมการบัณฑิต" },
  { href: "/model-representatives", label: "ศิษย์เก่าแบบอย่าง" },
  { href: "/abroad-alumni", label: "ศิษย์เก่าต่างประเทศ" },
];

export const ADMIN_NAV_ITEMS = [
  { href: "/admin/alumni", label: "จัดการข้อมูลศิษย์เก่า" },
  { href: "/admin/news", label: "จัดการข่าวสาร" },
  { href: "/admin/users", label: "จัดการผู้ใช้งาน" },
];

export const PAGE_SIZE = 20;
