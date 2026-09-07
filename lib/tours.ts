/**
 * Product-tour registry (client-safe data — no JSX, no Prisma).
 *
 * A tour is a list of steps; each step targets an element by its
 * `data-tour="<id>"` attribute (added on the page) or `target: null` for a
 * centered card (intro/closing). Adding a tour to a new page is a pure data
 * change here + `data-tour` attributes on the page — no engine edits.
 *
 * Paths are basePath-stripped (usePathname() returns paths without the
 * "/alumni" prefix), so pathPatterns are written plain.
 */

import type { StepPlacement } from "@/lib/tour-geometry";

export type { StepPlacement } from "@/lib/tour-geometry";

export type TourArea = "admin" | "alumni";

export interface TourStep {
  /** `data-tour` value of the target element; null = centered card. */
  target: string | null;
  title: string;
  body: string;
  /** Preferred side of the target for the tooltip card (default "below"). */
  placement?: StepPlacement;
  /** ms to wait for the target to appear before skipping (default 3000). */
  waitFor?: number;
}

export interface TourDefinition {
  id: string;
  area: TourArea;
  /**
   * Matches the exact path or any child ("/graduates/forum" also matches
   * "/graduates/forum/123"). RegExp allowed for future grouping.
   */
  pathPattern: string | RegExp;
  steps: TourStep[];
  /** Tours are desktop-only in v1; reserved for a future mobile rollout. */
  mobile?: boolean;
}

export const TOURS: readonly TourDefinition[] = [
  {
    id: "alumni-profile",
    area: "alumni",
    pathPattern: "/graduates/profile",
    steps: [
      {
        target: "alumni-profile-heading",
        title: "ข้อมูลส่วนตัวของท่าน",
        body: "หน้านี้คือข้อมูลส่วนตัวของศิษย์เก่า ท่านสามารถตรวจสอบความถูกต้องและแก้ไขข้อมูลของท่านเองได้ตลอดเวลา",
      },
      {
        target: "alumni-profile-edit",
        title: "ปุ่มแก้ไข",
        body: "กดปุ่ม “แก้ไข” เพื่อเข้าสู่โหมดแก้ไขข้อมูล เช่น ที่อยู่ปัจจุบัน อีเมลติดต่อ หรือเบอร์โทรศัพท์ แล้วกด “บันทึก” เมื่อเสร็จสิ้น",
      },
      {
        target: "alumni-profile-personal",
        title: "ข้อมูลส่วนตัว",
        body: "แสดงคำนำหน้า ชื่อ นามสกุล และวันเกิดของท่าน หากข้อมูลไม่ถูกต้องโปรดแจ้งผู้ดูแลระบบ",
      },
      {
        target: "alumni-profile-education",
        title: "ประวัติการศึกษา",
        body: "รายการวุฒิการศึกษาของท่านกับคณะพยาบาลศาสตร์ มช. ท่านสามารถเพิ่มวุฒิการศึกษาที่สำเร็จภายหลังได้ในส่วนนี้",
      },
      {
        target: "alumni-profile-contact",
        title: "ข้อมูลติดต่อ",
        body: "อีเมลสำหรับเข้าสู่ระบบ อีเมลติดต่อ เบอร์โทรศัพท์ และที่อยู่ปัจจุบัน — ข้อมูลติดต่อที่ถูกต้องช่วยให้คณะส่งข่าวสารถึงท่านได้",
      },
      {
        target: "alumni-profile-community",
        title: "โปรไฟล์ชุมชนศิษย์เก่า",
        body: "ท่านสามารถเข้าร่วมชุมชนศิษย์เก่า และสร้างโปรไฟล์สาธารณะเพื่อให้เพื่อนร่วมรุ่นค้นหาพบท่านในไดเรกทอรีศิษย์เก่า",
      },
      {
        target: null,
        title: "พร้อมใช้งานแล้ว",
        body: "หากต้องการดูคำแนะนำอีกครั้ง กดปุ่ม “i” ที่แถบด้านบนของหน้าได้ทุกเมื่อ",
      },
    ],
  },
  {
    id: "alumni-forum",
    area: "alumni",
    pathPattern: "/graduates/forum",
    steps: [
      {
        target: "forum-heading",
        title: "กระดานสนทนาศิษย์เก่า",
        body: "พื้นที่พบปะแลกเปลี่ยนความรู้ ประสบการณ์ และข่าวสารระหว่างศิษย์เก่า — เป็นฟีเจอร์แบบสมัครใจเข้าร่วม (Opt-in) เพื่อความเป็นส่วนตัวของศิษย์เก่าแต่ละท่าน",
      },
      {
        target: "forum-join-card",
        title: "เข้าร่วมชุมชน",
        body: "กด “เข้าร่วมชุมชน” เพื่อเริ่มใช้งานกระดานสนทนา การเข้าร่วมคือการยินยอมให้ศิษย์เก่าท่านอื่นที่เข้าร่วมเห็นชื่อ รุ่น และระดับปริญญาของท่านบนเนื้อหาที่โพสต์ และท่านสามารถยกเลิกการเข้าร่วมได้ทุกเมื่อ",
      },
      {
        target: "forum-new-topic",
        title: "ตั้งกระทู้ใหม่",
        body: "กดปุ่ม “ตั้งกระทู้ใหม่” เพื่อเปิดหัวข้อสนทนาใหม่ ตั้งชื่อหัวข้อให้ชัดเจน แล้วเขียนเนื้อหาเป็นข้อความธรรมดา สมาชิกท่านอื่นสามารถเข้ามาตอบกลับได้",
      },
      {
        target: "forum-search",
        title: "ค้นหาและเรียงกระทู้",
        body: "ใช้ช่องค้นหาเพื่อหากระทู้ที่สนใจ (กด Enter หรือปุ่มค้นหา) และเลือกวิธีเรียงลำดับ เช่น ล่าสุด หรือ ยอดนิยม ได้จากรายการด้านขวา",
      },
      {
        target: "forum-list",
        title: "รายการกระทู้",
        body: "แต่ละการ์ดคือหนึ่งกระทู้ แสดงผู้ตั้งกระทู้ จำนวนตอบกลับ และเวลาล่าสุด — กดที่การ์ดเพื่อเข้าไปอ่านและร่วมสนทนา หากพบเนื้อหาไม่เหมาะสมสามารถแจ้งให้ผู้ดูแลระบบตรวจสอบได้",
      },
      {
        target: null,
        title: "พร้อมใช้งานแล้ว",
        body: "หากต้องการดูคำแนะนำอีกครั้ง กดปุ่ม “i” ที่แถบด้านบนของหน้าได้ทุกเมื่อ",
      },
    ],
  },
  {
    id: "alumni-events",
    area: "alumni",
    pathPattern: "/graduates/events",
    steps: [
      {
        target: "events-heading",
        title: "กิจกรรมและการพบปะ",
        body: "ปฏิทินกิจกรรมพบปะและรียูเนียนของศิษย์เก่า ทุกท่านที่เป็นสมาชิกสามารถดูกิจกรรมและลงทะเบียนร่วมงานได้ แม้ยังไม่ได้เข้าร่วมชุมชนศิษย์เก่า",
      },
      {
        target: "events-create",
        title: "จัดกิจกรรม",
        body: "สมาชิกที่เข้าร่วมชุมชนแล้วสามารถกด “จัดกิจกรรม” เพื่อเปิดรับสมัครการพบปะของรุ่นหรือกลุ่มของท่านเองได้ พร้อมระบุสถานที่ วันเวลา และจำนวนผู้เข้าร่วมสูงสุด",
      },
      {
        target: "events-scope-tabs",
        title: "กิจกรรมที่กำลังจะมาถึง / ที่ผ่านมา",
        body: "สลับดูระหว่างกิจกรรมที่กำลังจะมาถึง ซึ่งยังเปิดให้ลงทะเบียนได้ กับกิจกรรมที่ผ่านไปแล้ว พร้อมรูปถ่ายจากงาน",
      },
      {
        target: "events-view-toggle",
        title: "มุมมองรายการ / ปฏิทิน",
        body: "เลือกดูกิจกรรมเป็นรายการ หรือสลับเป็นปฏิทินรายเดือนเพื่อเห็นภาพรวมว่ามีงานเมื่อไร แล้วเลื่อนดูเดือนก่อนหน้า/ถัดไปได้",
      },
      {
        target: "events-search",
        title: "ค้นหากิจกรรม",
        body: "พิมพ์ชื่อกิจกรรมที่ต้องการหา แล้วกด Enter หรือปุ่มค้นหา",
      },
      {
        target: "events-grid",
        title: "รายการกิจกรรม",
        body: "แต่ละการ์ดแสดงรายละเอียดงาน วันเวลา สถานที่ และจำนวนผู้ลงทะเบียน — กดเข้าไปเพื่อดูรายละเอียดเต็ม ลงทะเบียน (ระบุจำนวนผู้มาด้วยกันได้) หรือยกเลิกการลงทะเบียน",
      },
      {
        target: null,
        title: "พร้อมใช้งานแล้ว",
        body: "หากต้องการดูคำแนะนำอีกครั้ง กดปุ่ม “i” ที่แถบด้านบนของหน้าได้ทุกเมื่อ",
      },
    ],
  },
  {
    id: "admin-dashboard",
    area: "admin",
    pathPattern: "/management/dashboard",
    steps: [
      {
        target: "dashboard-heading",
        title: "แผงควบคุม",
        body: "ภาพรวมของระบบสารสนเทศศิษย์เก่าในหน้าเดียว สรุปจำนวนศิษย์เก่า บัญชีรออนุมัติ รางวัล และข่าวสารล่าสุด",
      },
      {
        target: "dashboard-accounts",
        title: "บัญชีศิษย์เก่า",
        body: "สรุปบัญชีผู้ใช้ศิษย์เก่าแยกตามสถานะ รออนุมัติ (สีเหลือง) ใช้งาน (สีเขียว) และปฏิเสธ (สีแดง) — กดที่การ์ดเพื่อไปยังคิวอนุมัติได้ทันที",
      },
      {
        target: "dashboard-total",
        title: "จำนวนศิษย์เก่าทั้งหมด",
        body: "นับศิษย์เก่าแบบรวมข้อมูลจากทะเบียน CMU และที่บันทึกในระบบ โดยแต่ละคนนับหนึ่งครั้งที่วุฒิสูงสุด พร้อมกราฟแสดงจำนวนศิษย์เก่าตามปีที่จบ — กดเพื่อไปหน้าข้อมูลนักศึกษาเก่า",
      },
      {
        target: "dashboard-awards",
        title: "รางวัลทั้งหมด",
        body: "สรุปรางวัลของศิษย์เก่าจำแนกตามระดับ นานาชาติ ชาติ และท้องถิ่น — กดเพื่อไปหน้าจัดการข้อมูลรางวัล",
      },
      {
        target: "dashboard-recent-news",
        title: "ข่าวสารล่าสุด",
        body: "ข่าวประชาสัมพันธ์ล่าสุดของคณะที่เผยแพร่แล้ว สำหรับผู้บริหารจะมองเห็นเฉพาะข่าวที่เผยแพร่เท่านั้น",
      },
      {
        target: null,
        title: "พร้อมใช้งานแล้ว",
        body: "หากต้องการดูคำแนะนำอีกครั้ง กดปุ่ม “i” ที่แถบด้านบนของหน้าได้ทุกเมื่อ",
      },
    ],
  },
  {
    id: "admin-all-alumni",
    area: "admin",
    pathPattern: "/management/all-alumni",
    steps: [
      {
        target: "all-alumni-heading",
        title: "ข้อมูลนักศึกษาเก่า",
        body: "ตารางศิษย์เก่าหลักของระบบ ผสานข้อมูลจากทะเบียน CMU และที่บันทึกในระบบเข้าด้วยกัน กดที่แถวเพื่อเปิดหน้าโปรไฟล์ของศิษย์เก่าแต่ละท่าน",
      },
      {
        target: "all-alumni-toolbar",
        title: "ปุ่มจัดการข้อมูล",
        body: "เพิ่มข้อมูลใหม่ นำเข้าจากไฟล์ Excel และส่งออกข้อมูลเป็น Excel (เลือกช่วงแถวได้) — ผู้บริหารจะมองเห็นเฉพาะปุ่มส่งออก",
      },
      {
        target: "all-alumni-search",
        title: "ค้นหาและมุมมองแสดงผล",
        body: "ค้นหาด้วยชื่อ นามสกุล หรือรหัสนักศึกษา (กด Enter หรือปุ่มค้นหา) และสลับระหว่าง “แสดงวุฒิสูงสุด” คนละบรรทัดกับ “แสดงทุกวุฒิ” ของผู้ที่จบหลายวุฒิ",
      },
      {
        target: "all-alumni-facets",
        title: "ตัวกรองข้อมูล",
        body: "กรองตามระดับการศึกษา สาขาวิชา และปีที่สำเร็จการศึกษา เพื่อจำกัดขอบเขตข้อมูลที่ต้องการดูหรือส่งออก",
      },
      {
        target: "all-alumni-select",
        title: "โหมดเลือกแถว",
        body: "กด “เลือก” เพื่อเข้าสู่โหมดเลือกแถว แล้วคลิกแถวที่ต้องการ (แถวจะเน้นสีส้ม) เพื่อลบหรือส่งออกเฉพาะรายการที่เลือก",
      },
      {
        target: null,
        title: "พร้อมใช้งานแล้ว",
        body: "หากต้องการดูคำแนะนำอีกครั้ง กดปุ่ม “i” ที่แถบด้านบนของหน้าได้ทุกเมื่อ",
      },
    ],
  },
  {
    id: "admin-news",
    area: "admin",
    pathPattern: "/management/news",
    steps: [
      {
        target: "news-heading",
        title: "ข่าวสารและกิจกรรม",
        body: "จัดการข่าวประชาสัมพันธ์ของคณะ แสดงเป็นการ์ด (ไม่ใช่ตาราง) ข่าวมี 3 สถานะ ฉบับร่าง เผยแพร่ และยุติการเผยแพร่ — ศิษย์เก่าจะมองเห็นเฉพาะข่าวที่เผยแพร่แล้วเท่านั้น",
      },
      {
        target: "news-create",
        title: "สร้างข่าวใหม่",
        body: "เขียนข่าวด้วยตัวแก้ไข Rich Text รองรับหัวข้อ รายการ สี และรูปภาพปก บันทึกเป็นฉบับร่างก่อนได้ แล้วค่อยเผยแพร่เมื่อพร้อม",
      },
      {
        target: "news-filters",
        title: "ค้นหาและกรองสถานะ",
        body: "ค้นหาข่าวจากชื่อเรื่อง และกรองตามสถานะ เพื่อจัดการข่าวในแต่ละขั้นตอนการทำงาน",
      },
      {
        target: "news-pinned",
        title: "ประชาสัมพันธ์สำคัญ",
        body: "ข่าวที่ปักหมุดจะลอยขึ้นมาแสดงในส่วนนี้ทั้งบนหน้าผู้ดูแลและหน้าข่าวของศิษย์เก่า ปักหมุดได้เฉพาะข่าวที่เผยแพร่แล้ว และการยุติการเผยแพร่จะยกเลิกการปักหมุดโดยอัตโนมัติ",
      },
      {
        target: "news-select",
        title: "โหมดเลือกข่าว",
        body: "กด “เลือก” เพื่อเลือกหลายข่าวพร้อมกัน แล้วดำเนินการเป็นชุด เช่น เผยแพร่ ยุติการเผยแพร่ หรือปักหมุด ทั้งหมดในคลิกเดียว",
      },
      {
        target: "news-grid",
        title: "รายการข่าว",
        body: "แต่ละการ์ดแสดงภาพปก สถานะ และปุ่มจัดการ แก้ไข ปักหมุด เผยแพร่ หรือยุติการเผยแพร่ การลบข่าวคือการยุติการเผยแพร่ ไม่ได้ลบถาวร",
      },
      {
        target: null,
        title: "พร้อมใช้งานแล้ว",
        body: "หากต้องการดูคำแนะนำอีกครั้ง กดปุ่ม “i” ที่แถบด้านบนของหน้าได้ทุกเมื่อ",
      },
    ],
  },
];

function normalizePath(p: string): string {
  const stripped = p.replace(/\/+$/, "");
  return stripped === "" ? "/" : stripped;
}

/**
 * Find the tour for a pathname: exact or child-path prefix match (RegExp
 * patterns test the raw pathname), scoped to one area so admin and alumni
 * tours never collide. Returns undefined when no tour applies.
 */
export function tourForPath(area: TourArea, pathname: string): TourDefinition | undefined {
  const p = normalizePath(pathname);
  return TOURS.find((tour) => {
    if (tour.area !== area) return false;
    if (typeof tour.pathPattern === "string") {
      const base = normalizePath(tour.pathPattern);
      return p === base || p.startsWith(`${base}/`);
    }
    return tour.pathPattern.test(pathname);
  });
}
