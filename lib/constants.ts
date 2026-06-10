export const BASE_PATH = "/alumni";

export const AWARD_TYPE_LABELS: Record<string, string> = {
  INTERNATIONAL: "รางวัลระดับนานาชาติ",
  NATIONAL: "รางวัลระดับชาติ",
  LOCAL: "รางวัลระดับท้องถิ่น",
};

export const AWARD_TYPE_OPTIONS = Object.entries(AWARD_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const PREFIX_OPTIONS = [
  { value: "นางสาว", label: "นางสาว" },
  { value: "นาง", label: "นาง" },
  { value: "นาย", label: "นาย" },
  { value: "ดร.", label: "ดร." },
  { value: "อื่นๆ", label: "อื่นๆ" },
];

export const NAV_ITEMS = [
  { href: "/", label: "แผงควบคุม" },
  { href: "/all-alumni", label: "ข้อมูลนักศึกษาเก่า" },
  { href: "/awards", label: "รางวัล" },
  { href: "/potentials", label: "ศักยภาพ" },
  { href: "/associations", label: "สมาคม/ชมรม" },
  { href: "/graduate-committee", label: "กรรมการบัณฑิต" },
  { href: "/model-representatives", label: "ผู้แทนรุ่น" },
  { href: "/abroad-alumni", label: "ข้อมูลการทำงานต่างประเทศ" },
  { href: "/news", label: "ข่าวสาร" },
];

export const SETTINGS_NAV_ITEMS = [
  { href: "/settings/profile", label: "ข้อมูลส่วนตัว" },
  { href: "/settings/pending-alumni", label: "รอการอนุมัติ", adminOnly: true },
  { href: "/settings/users", label: "จัดการผู้ใช้งาน" },
  { href: "/settings/logs", label: "บันทึกกิจกรรม", adminOnly: true },
];

export const PAGE_SIZE = 10;

export const DEGREE_LEVEL_OPTIONS = [
  { value: "NURSING_ASSISTANT", label: "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล" },
  { value: "ASSOCIATE", label: "อนุปริญญา" },
  { value: "BACHELOR", label: "ปริญญาตรี" },
  { value: "MASTER", label: "ปริญญาโท" },
  { value: "DOCTORAL", label: "ปริญญาเอก" },
];
