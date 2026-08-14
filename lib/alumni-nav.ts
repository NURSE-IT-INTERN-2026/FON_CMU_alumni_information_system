/**
 * Alumni-portal navigation items — the ONE source of truth shared by
 * `components/AlumniSidebar.tsx` (desktop) and `components/AlumniHeader.tsx`
 * (mobile drawer). Previously duplicated in both components; edit here only.
 *
 * Client-safe (pure data). Profile uses exact-path active matching (see the
 * components' `isItemActive`); everything else matches by prefix.
 */
export const ALUMNI_NAV_ITEMS = [
  { href: "/graduates/news", label: "ข่าวสาร" },
  { href: "/graduates/feed", label: "ฟีด" },
  { href: "/graduates/forum", label: "กระดานสนทนา" },
  { href: "/graduates/directory", label: "ไดเรกทอรีศิษย์เก่า" },
  { href: "/graduates/events", label: "กิจกรรม" },
  { href: "/graduates/profile", label: "ข้อมูลส่วนตัว" },
] as const;
