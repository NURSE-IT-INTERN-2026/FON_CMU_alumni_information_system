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
  { href: "/alumni-count", label: "จำนวนนักศึกษาเก่า" },
  { href: "/awards", label: "รางวัล" },
  { href: "/potentials", label: "ศักยภาพ" },
  { href: "/associations", label: "สมาคม/ชมรม" },
  { href: "/graduate-committee", label: "กรรมการบัณฑิต" },
  { href: "/model-representatives", label: "ผู้แทนรุ่น" },
  { href: "/abroad-alumni", label: "ข้อมูลการทำงานต่างประเทศ" },
];

export const ADMIN_NAV_ITEMS = [
  { href: "/admin/alumni", label: "จัดการข้อมูลศิษย์เก่า" },
  { href: "/admin/potentials", label: "จัดการข้อมูลศักยภาพ" },
  { href: "/admin/associations", label: "จัดการข้อมูลสมาคม/ชมรม" },
  { href: "/admin/news", label: "จัดการข่าวสาร" },
  { href: "/admin/users", label: "จัดการผู้ใช้งาน" },
];

export const PAGE_SIZE = 10;
