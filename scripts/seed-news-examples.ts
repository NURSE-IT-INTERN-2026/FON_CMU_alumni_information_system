/**
 * One-off / dev seed: generate example News articles for the FON CMU alumni
 * system, all using a single shared cover image (FON building photo) as the
 * thumbnail. Distribution: 6 PUBLISHED, 3 DRAFT, 3 DISCONTINUED.
 *
 * The cover image must already exist in the dev container's named volume at
 * /app/public/uploads/fon-building.jpg (the host public/uploads/ is shadowed by
 * the named volume — copy via `docker cp ... fon-cmu-alumni-app-1:/app/public/uploads/`).
 *
 *   node --env-file=.env --import tsx scripts/seed-news-examples.ts
 *
 * Non-destructive: uses upsert by `title` (idempotent, safe to re-run) and does
 * NOT touch existing news rows. Mirrors prisma/seed.ts's news section (direct
 * Prisma, coverImageUrl set, publishedAt set only for PUBLISHED).
 */
import "dotenv/config";
import prisma from "../lib/prisma";
import type { NewsStatus } from "../app/generated/prisma/client";

const COVER = "/uploads/fon-building.jpg";

type Article = {
  title: string;
  body: string;
  status: NewsStatus;
  publishedAt: Date | null;
};

const articles: Article[] = [
  // ── 6 PUBLISHED ──
  {
    title: "รวมพลศิษย์เก่า FON CMU ครั้งที่ 25",
    body: "<p>สมาคมศิษย์เก่าคณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่ ขอเชิญศิษย์เก่าทุกท่านร่วมงานรวมพลศิษย์เก่า ครั้งที่ 25 เพื่อพบปะสังสรรค์และระลึกถึงความทรงจำสมัยเป็นนิสิต</p><p>กำหนดจัดในวันเสาร์ที่ 28 มีนาคม 2569 ณ โรงแรมดุสิตธานี เชียงใหม่ ขอเชิญร่วมสร้างความทรงจำที่งดงามร่วมกัน</p>",
    status: "PUBLISHED",
    publishedAt: new Date("2026-02-15T09:00:00+07:00"),
  },
  {
    title: "ศิษย์เก่า FON CMU คว้ารางวัลพยาบาลดีเด่นระดับชาติ",
    body: "<p>ศิษย์เก่าคณะพยาบาลศาสตร์ มช. ได้รับรางวัลพยาบาลดีเด่นระดับชาติ สาขาการพยาบาลชุมชน ถือเป็นความภูมิใจของคณะและมหาวิทยาลัยอย่างยิ่ง</p><p>ขอแสดงความยินดีกับศิษย์เก่าผู้มีความสามารถและเป็นแบบอย่างที่ดีให้กับนิสิตและบุคลากรต่อไป</p>",
    status: "PUBLISHED",
    publishedAt: new Date("2025-12-01T08:30:00+07:00"),
  },
  {
    title: "สัมมนาวิชาการ “พยาบาลแห่งอนาคต: นวัตกรรมและเทคโนโลยี”",
    body: "<p>คณะพยาบาลศาสตร์ มช. ร่วมกับสมาคมศิษย์เก่า จัดสัมมนาวิชาการหัวข้อ “พยาบาลแห่งอนาคต: นวัตกรรมและเทคโนโลยี”</p><p>งานจัดขึ้นในวันพฤหัสบดีที่ 15 มกราคม 2569 ณ ห้องประชุมอาคารพยาบาลศาสตร์ ขอเชิญศิษย์เก่าและบุคลากรเข้าร่วมรับฟังโดยไม่เสียค่าใช้จ่าย</p>",
    status: "PUBLISHED",
    publishedAt: new Date("2025-11-15T09:00:00+07:00"),
  },
  {
    title: "เปิดรับทุนการศึกษาศิษย์เก่า FON CMU ต่อปริญญาโทและเอก",
    body: "<p>คณะพยาบาลศาสตร์ มช. เปิดรับสมัครทุนการศึกษาสำหรับศิษย์เก่าที่ต้องการศึกษาต่อในระดับปริญญาโทและปริญญาเอก</p><p>ทุนมีมูลค่า 50,000 – 100,000 บาทต่อปี ผู้สนใจสามารถดาวน์โหลดใบสมัครและส่งเอกสารได้ตั้งแต่บัดนี้จนถึง 31 มีนาคม 2569</p>",
    status: "PUBLISHED",
    publishedAt: new Date("2026-01-20T10:00:00+07:00"),
  },
  {
    title: "โครงการอาสาสมัครพยาบาลชุมชน ประจำปี 2568",
    body: "<p>เปิดรับสมัครอาสาสมัครพยาบาลชุมชน เพื่อให้บริการสาธารณสุขและส่งเสริมสุขภาพในพื้นที่ชนบท</p><p>ศิษย์เก่าที่สนใจร่วมอุทิศตนเพื่อสังคมสามารถสมัครได้ตั้งแต่บัดนี้เป็นต้นไป</p>",
    status: "PUBLISHED",
    publishedAt: new Date("2025-09-10T14:00:00+07:00"),
  },
  {
    title: "กิจกรรมรับขวัญศิษย์เก่าและทำบุญตักบาตรขึ้นปีใหม่",
    body: "<p>คณะพยาบาลศาสตร์ มช. จัดกิจกรรมรับขวัญศิษย์เก่าและทำบุญตักบาตรเนื่องในโอกาสปีใหม่ 2569 โดยมีศิษย์เก่าจากรุ่นต่าง ๆ เข้าร่วมงานเป็นจำนวนมาก</p><p>กิจกรรมนี้ถือเป็นโอกาสอันดีที่ศิษย์เก่าจะได้กลับมาเยี่ยมคณะและร่วมทำบุญเพื่อความเป็นสิริมงคล</p>",
    status: "PUBLISHED",
    publishedAt: new Date("2025-12-20T08:00:00+07:00"),
  },

  // ── 3 DRAFT ──
  {
    title: "แผนงานปรับปรุงหลักสูตรพยาบาลศาสตร์ ปี 2569 (ร่าง)",
    body: "<p>คณะพยาบาลศาสตร์ มช. วางแผนปรับปรุงหลักสูตรการพยาบาลให้ทันสมัยและสอดคล้องกับสถานการณ์ปัจจุบัน</p><p>ขอเชิญศิษย์เก่าร่วมให้ความคิดเห็นผ่านแบบสอบถามออนไลน์ <em>(เอกสารร่าง — ยังไม่เผยแพร่)</em></p>",
    status: "DRAFT",
    publishedAt: null,
  },
  {
    title: "โครงการพี่เลี้ยงศิษย์เก่าสู่นิสิตใหม่ (ร่าง)",
    body: "<p>โครงการพี่เลี้ยงศิษย์เก่าสู่นิสิตใหม่ เปิดโอกาสให้ศิษย์เก่าได้ให้คำปรึกษาและแนะแนวทางในการทำงานแก่นิสิตใหม่</p><p><em>(กำลังจัดทำรายละเอียด — ยังไม่เผยแพร่)</em></p>",
    status: "DRAFT",
    publishedAt: null,
  },
  {
    title: "ประกาศรับสมัครตัวแทนศิษย์เก่าเครือข่าย ประจำปี 2569 (ร่าง)",
    body: "<p>เปิดรับสมัครตัวแทนศิษย์เก่าเครือข่าย 5 เครือข่าย เพื่อประสานงานและเชื่อมโยงศิษย์เก่าในแต่ละรุ่น</p><p><em>(ร่างประกาศ — ยังไม่เผยแพร่)</em></p>",
    status: "DRAFT",
    publishedAt: null,
  },

  // ── 3 DISCONTINUED ──
  {
    title: "ขอเชิญร่วมงานวันพยาบาลแห่งชาติ ประจำปี 2568",
    body: "<p>คณะพยาบาลศาสตร์ มช. ขอเชิญศิษย์เก่าร่วมเป็นเกียรติในงานวันพยาบาลแห่งชาติ ประจำปี 2568</p><p>กิจกรรมเสร็จสิ้นไปแล้ว <strong>(ยุติการเผยแพร่)</strong></p>",
    status: "DISCONTINUED",
    publishedAt: null,
  },
  {
    title: "ประกาศผลการประกวดภาพถ่าย “ความภาคภูมิใจของศิษย์เก่า”",
    body: "<p>คณะพยาบาลศาสตร์ มช. ขอแสดงความยินดีกับผู้ชนะการประกวดภาพถ่าย “ความภาคภูมิใจของศิษย์เก่า”</p><p><strong>(ยุติการเผยแพร่)</strong></p>",
    status: "DISCONTINUED",
    publishedAt: null,
  },
  {
    title: "อบรมหลักสูตรพยาบาลเวชปฏิบัติครอบครัว รุ่นที่ 5",
    body: "<p>เปิดอบรมหลักสูตรพยาบาลเวชปฏิบัติครอบครัว รุ่นที่ 5 สำหรับศิษย์เก่าและบุคลากรทางการพยาบาล</p><p><strong>(ยุติการเผยแพร่ — รับสมัครเต็มแล้ว)</strong></p>",
    status: "DISCONTINUED",
    publishedAt: null,
  },
];

async function main() {
  const before = await prisma.news.count();
  console.log(`Existing news rows (left untouched): ${before}`);

  let upserted = 0;
  for (const a of articles) {
    await prisma.news.upsert({
      where: { title: a.title },
      update: {
        body: a.body,
        coverImageUrl: COVER,
        status: a.status,
        publishedAt: a.publishedAt,
      },
      create: {
        title: a.title,
        body: a.body,
        coverImageUrl: COVER,
        status: a.status,
        publishedAt: a.publishedAt,
      },
    });
    upserted++;
  }

  const byStatus = await prisma.news.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  console.log(`\nUpserted ${upserted} example news articles (cover = ${COVER}).`);
  console.log("TOTAL news by status (incl. any pre-existing rows):");
  for (const s of byStatus) {
    console.log(`  ${s.status.padEnd(12)} ${s._count._all}`);
  }
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
