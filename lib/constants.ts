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
  { href: "/management/dashboard", label: "แผงควบคุม" },
  { href: "/management/all-alumni", label: "ข้อมูลนักศึกษาเก่า" },
  { href: "/management/awards", label: "รางวัล" },
  { href: "/management/potentials", label: "ศักยภาพ" },
  { href: "/management/associations", label: "สมาคม/ชมรม" },
  { href: "/management/graduate-committee", label: "กรรมการบัณฑิต" },
  { href: "/management/model-representatives", label: "ผู้แทนรุ่น" },
  { href: "/management/abroad-alumni", label: "ข้อมูลการทำงานต่างประเทศ" },
  { href: "/management/news", label: "ข่าวสาร" },
];

export const SETTINGS_NAV_ITEMS = [
  { href: "/management/settings/profile", label: "ข้อมูลส่วนตัว" },
  { href: "/management/settings/pending-alumni", label: "รอการอนุมัติ", adminOnly: true },
  { href: "/management/settings/users", label: "จัดการผู้ใช้งาน" },
  { href: "/management/settings/logs", label: "บันทึกกิจกรรม", adminOnly: true },
];

export const PAGE_SIZE = 10;

export const DEGREE_LEVEL_OPTIONS = [
  { value: "NURSING_ASSISTANT", label: "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล" },
  { value: "ASSOCIATE", label: "อนุปริญญา" },
  { value: "BACHELOR", label: "ปริญญาตรี" },
  { value: "MASTER", label: "ปริญญาโท" },
  { value: "DOCTORAL", label: "ปริญญาเอก" },
];
