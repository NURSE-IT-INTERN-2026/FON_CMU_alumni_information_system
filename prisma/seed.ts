import "dotenv/config";
import prisma from "../lib/prisma";
import { hashPassword } from "../lib/auth";

async function main() {
  console.log("Seeding database...\n");

  // ── 1. Clean existing data (reverse dependency order) ──
  console.log("Cleaning existing data...");
  await prisma.session.deleteMany();
  await prisma.award.deleteMany();
  await prisma.associationMember.deleteMany();
  await prisma.graduateCommittee.deleteMany();
  await prisma.news.deleteMany();
  await prisma.alumni.deleteMany();
  await prisma.adminUser.deleteMany();
  console.log("All existing data cleared.\n");

  // ── 2. Create admin users ──
  console.log("Creating admin users...");
  const adminHash = await hashPassword("password123");
  const superadminHash = await hashPassword("password123");

  const [admin, superadmin] = await Promise.all([
    prisma.adminUser.create({
      data: {
        name: "ผู้ดูแลระบบ",
        email: "admin@fon.cmu.ac.th",
        passwordHash: adminHash,
        role: "admin",
      },
    }),
    prisma.adminUser.create({
      data: {
        name: "ผู้ดูแลระบบสูงสุด",
        email: "superadmin@fon.cmu.ac.th",
        passwordHash: superadminHash,
        role: "superadmin",
      },
    }),
  ]);
  console.log(`  Created admin: ${admin.email}`);
  console.log(`  Created superadmin: ${superadmin.email}\n`);

  // ── 3. Create alumni records ──
  console.log("Creating alumni...");

  const firstNames = [
    "สมชาย", "สมหญิง", "วิชัย", "นภา", "พรรณี",
    "ธนา", "ประภาส", "จิตรา", "สุภาพ", "วันดี",
    "อรุณ", "ปิยะ", "มนัส", "กานดา", "ธีรพงษ์",
    "ศิริลักษณ์", "ชาตรี", "ภัทรา", "สมศักดิ์", "นิตยา",
    "สุนทร", "วิภา", "พิชญา", "กมล", "เสน่ห์",
    "อัญชลี", "ชูศรี", "สมบัติ", "รัตนา", "วิเชียร",
    "ประเสริฐ", "สายฝน", "กิตติ", "ละออ", "บุญส่ง",
    "ดวงใจ", "สมหวัง", "สุดา", "วิไล", "เกรียงศักดิ์",
    "อรนุช", "ชัยวัฒน์", "พิมพ์ใจ", "สุรพล", "จำเริญ",
    "อุไร", "เกียรติ", "พรทิพา", "สมปอง", "วรรณา",
  ];

  const lastNames = [
    "สุขใจ", "บุญมี", "ศรีสวัสดิ์", "วงศ์สวัสดิ์", "แก้วมณี",
    "ธนาพร", "รัตนชัย", "พงษ์ประเสริฐ", "สิทธิโชค", "เจริญสุข",
    "วิเชียรเจริญ", "สมบูรณ์", "กิจเจริญ", "ภูมิพัฒน์", "มณีรัตน์",
  ];

  const degreeLevels: ("BACHELOR" | "MASTER" | "DOCTORAL" | "NURSING_CERTIFICATE")[] = [
    "BACHELOR", "BACHELOR", "BACHELOR", "BACHELOR", "BACHELOR",
    "BACHELOR", "BACHELOR", "BACHELOR", "BACHELOR", "MASTER",
    "MASTER", "MASTER", "MASTER", "MASTER", "MASTER",
    "DOCTORAL", "DOCTORAL", "DOCTORAL",
    "NURSING_CERTIFICATE", "NURSING_CERTIFICATE", "NURSING_CERTIFICATE",
    "BACHELOR", "BACHELOR", "BACHELOR", "BACHELOR", "MASTER",
    "BACHELOR", "BACHELOR", "BACHELOR", "BACHELOR", "BACHELOR",
    "MASTER", "BACHELOR", "BACHELOR", "BACHELOR", "MASTER",
    "BACHELOR", "BACHELOR", "BACHELOR", "BACHELOR", "BACHELOR",
    "DOCTORAL", "BACHELOR", "MASTER", "BACHELOR", "BACHELOR",
    "NURSING_CERTIFICATE", "MASTER", "BACHELOR", "BACHELOR", "MASTER",
  ];

  const workplaces = [
    "โรงพยาบาลมหาราชนครเชียงใหม่",
    "โรงพยาบาลรามาธิบดี",
    "โรงพยาบาลศิริราช",
    "คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่",
    "โรงพยาบาลนพรัตนราชชาติ",
    "สถาบันสุขภาพเด็กแห่งชาติมหาราชินี",
    "โรงพยาบาลเชียงใหม่ใกล้หมอ",
    "กรมวิทยาศาสตร์การแพทย์",
    "กระทรวงสาธารณสุข",
    "โรงพยาบาลสงฆ์ พะเยา",
    "มหาวิทยาลัยมหิดล",
    "มหาวิทยาลัยเชียงใหม่",
    "โรงพยาบาลลำปาง",
    "สถาบันราชานุกูล",
    "โรงพยาบาลสมเด็จเจ้าพระยา",
    null, null, null,
  ];

  const abroadCountries = [
    "สหรัฐอเมริกา", "อังกฤษ", "ออสเตรเลีย", "ญี่ปุ่น",
    "สิงคโปร์", "เยอรมนี", "แคนาดา", "สหรัฐอเมริกา",
    "อังกฤษ", "ออสเตรเลีย", "ญี่ปุ่น", "สิงคโปร์",
    "เยอรมนี", "แคนาดา", "สหรัฐอเมริกา",
  ];

  const expertiseFields = [
    "การพยาบาลผู้สูงอายุ",
    "การพยาบาลเด็กแรกเกิด",
    "การพยาบาลผู้ป่วยวิกฤต",
    "การพยาบาลจิตเวช",
    "การพยาบาลชุมชน",
    "การวิจัยทางการพยาบาล",
    "การบริหารการพยาบาล",
    "การพยาบาลสูติกรรม",
    "การพยาบาลผู้ป่วยโรคมะเร็ง",
    "การพยาบาลแผนไทย",
  ];

  const achievementSummaries = [
    "เป็นผู้บุกเบิกด้านการพยาบาลผู้สูงอายุในภาคเหนือ มีผลงานวิจัยมากกว่า 30 เรื่อง",
    "ได้รับรางวัลพยาบาลดีเด่นระดับนานาชาติ และเป็นวิทยากรรับเชิญในงานประชุมระดับโลก",
    "บริหารโรงพยาบาลชุมชนให้ได้มาตรฐานระดับประเทศ และเป็นแบบอย่างในการบริหารจัดการ",
    "พัฒนาหลักสูตรการพยาบาลและผดุงครรภ์ขั้นสูง ที่ได้รับการยอมรับในระดับนานาชาติ",
    "เป็นผู้นำด้านการวิจัยพยาบาลผู้ป่วยวิกฤต และจัดตั้งศูนย์ฝึกอบรมพยาบาลวิกฤตแห่งแรกของภาคเหนือ",
    "อุทิศตนในการพยาบาลชุมชนที่ด้อยโอกาส นานกว่า 20 ปี ในพื้นที่ภูเขาจังหวัดเชียงใหม่",
    "เป็นที่ปรึกษาองค์การอนามัยโลกด้านการพยาบาล และเผยแพร่ความรู้สู่ประเทศกำลังพัฒนา",
    "พัฒนาระบบสารสนเทศสำหรับการบริหารการพยาบาล ที่ได้รับการนำไปใช้ในโรงพยาบาลกว่า 50 แห่ง",
  ];

  const alumniData = [];

  for (let i = 0; i < 50; i++) {
    const firstName = firstNames[i];
    const lastName = lastNames[i % lastNames.length];
    const degreeLevel = degreeLevels[i];
    const initialYear = 2540 + Math.floor(i * 21 / 50); // spread 2540-2560

    let graduationYear: number;
    if (degreeLevel === "DOCTORAL") {
      graduationYear = initialYear + 3;
    } else if (degreeLevel === "MASTER") {
      graduationYear = initialYear + 2;
    } else {
      graduationYear = initialYear + 4;
    }

    const hasEmail = i % 3 !== 2;
    const hasPhone = i % 2 === 0;
    const workplace = workplaces[i % workplaces.length];
    const isPotential = i < 10;
    const isModelRep = i >= 10 && i < 18;
    const isAbroad = i < 15;

    alumniData.push({
      studentId: `51${String(initialYear).slice(2)}${String(i + 1).padStart(4, "0")}`,
      firstName,
      lastName,
      degreeLevel,
      initialYear,
      graduationYear,
      email: hasEmail ? `${firstName}.${lastName}@gmail.com` : null,
      phone: hasPhone ? `0${8 + (i % 3)}-${String(1000 + i * 111).slice(0, 4)}-${String(1000 + i * 37).slice(0, 4)}` : null,
      currentWorkplace: isAbroad ? null : workplace,
      country: isAbroad ? abroadCountries[i % abroadCountries.length] : null,
      isPotential,
      isModelRepresentative: isModelRep,
      expertise: isPotential ? expertiseFields[i % expertiseFields.length] : null,
      achievementSummary: isModelRep ? achievementSummaries[(i - 10) % achievementSummaries.length] : null,
      photoUrl: null,
    });
  }

  const alumni = [];
  for (const data of alumniData) {
    const record = await prisma.alumni.create({ data });
    alumni.push(record);
  }
  console.log(`  Created ${alumni.length} alumni records\n`);

  // ── 4. Create awards ──
  console.log("Creating awards...");

  const awardNames = [
    "รางวัลพยาบาลดีเด่น",
    "รางวัลผู้ทำคุณประโยชน์",
    "รางวัลนักวิจัยยอดเยี่ยม",
    "รางวัลพยาบาลสังคม",
    "รางวัลศิษย์เก่าดีเด่น",
    "รางวัลผู้นำทางการพยาบาล",
    "รางวัลวิชาชีพพยาบาล",
    "รางวัลนวัตกรรมการพยาบาล",
    "รางวัลจิตอาสา",
    "รางวัลพยาบาลผู้อุทิศตน",
    "รางวัลการบริการวิชาชีพดีเด่น",
    "รางวัลอาจารย์พยาบาลดีเด่น",
    "รางวัลผู้บริหารการพยาบาลดีเด่น",
    "รางวัลนักวิชาการดีเด่น",
    "รางวัลผู้พัฒนาวิชาชีพพยาบาล",
  ];

  const awardTypes: ("INTERNATIONAL" | "NATIONAL" | "LOCAL")[] = [
    "INTERNATIONAL", "NATIONAL", "LOCAL", "NATIONAL", "INTERNATIONAL",
    "NATIONAL", "LOCAL", "NATIONAL", "LOCAL", "INTERNATIONAL",
    "NATIONAL", "LOCAL", "NATIONAL", "INTERNATIONAL", "NATIONAL",
    "INTERNATIONAL", "LOCAL", "NATIONAL", "LOCAL", "NATIONAL",
    "INTERNATIONAL", "NATIONAL", "LOCAL", "NATIONAL", "INTERNATIONAL",
    "NATIONAL", "LOCAL", "NATIONAL", "LOCAL", "NATIONAL",
  ];

  const awardDescriptions = [
    "ได้รับการคัดเลือกจากสมาคมพยาบาลแห่งประเทศไทย ให้เป็นพยาบาลดีเด่นประจำปี",
    "อุทิศตนเพื่อสังคมและสาธารณสุขมาอย่างยาวนาน",
    "มีผลงานวิจัยที่ได้รับการตีพิมพ์ในวารสารระดับนานาชาติ",
    "ทำงานเพื่อสังคมและชุมชนอย่างต่อเนื่อง",
    "เป็นศิษย์เก่าที่ประสบความสำเร็จและเป็นแบบอย่างที่ดี",
    "เป็นผู้นำในการพัฒนาวิชาชีพพยาบาล",
    "ปฏิบัติงานวิชาชีพพยาบาลด้วยความเสียสละ",
    "คิดค้นนวัตกรรมที่เป็นประโยชน์ต่อวงการพยาบาล",
    "อาสาทำงานเพื่อสาธารณประโยชน์อย่างต่อเนื่อง",
    "อุทิศชีวิตให้กับวิชาชีพพยาบาลอย่างแท้จริง",
    null, null, null, null, null,
  ];

  const awardData = [];
  for (let i = 0; i < 30; i++) {
    const alumniIdx = (i * 7 + 3) % alumni.length;
    const year = 2550 + Math.floor(i * 18 / 30); // spread 2550-2568
    awardData.push({
      alumniId: alumni[alumniIdx].id,
      awardName: awardNames[i % awardNames.length],
      awardType: awardTypes[i % awardTypes.length],
      year,
      description: awardDescriptions[i % awardDescriptions.length],
    });
  }

  const awards = [];
  for (const data of awardData) {
    const record = await prisma.award.create({ data });
    awards.push(record);
  }
  console.log(`  Created ${awards.length} award records\n`);

  // ── 5. Create association members ──
  console.log("Creating association members...");

  const associationNames = [
    "สมาคมศิษย์เก่าคณะพยาบาลศาสตร์ มช.",
    "ชมรมพยาบาลภาคเหนือ",
    "สมาคมพยาบาลแห่งประเทศไทย",
  ];

  const positions = [
    "ประธาน",
    "รองประธาน",
    "เลขานุการ",
    "กรรมการ",
    "ที่ปรึกษา",
  ];

  const associationData = [];
  const usedAssociationSlots = new Set<string>();

  for (let i = 0; i < 20; i++) {
    const alumniIdx = (i * 5 + 1) % alumni.length;
    const assocIdx = i % associationNames.length;
    const posIdx = i % positions.length;
    const termYear = 2560 + Math.floor(i * 8 / 20); // spread 2560-2568

    const key = `${alumni[alumniIdx].id}-${assocIdx}-${termYear}`;
    if (usedAssociationSlots.has(key)) continue;
    usedAssociationSlots.add(key);

    associationData.push({
      alumniId: alumni[alumniIdx].id,
      associationName: associationNames[assocIdx],
      position: positions[posIdx],
      termYear,
    });
  }

  const associationMembers = [];
  for (const data of associationData) {
    const record = await prisma.associationMember.create({ data });
    associationMembers.push(record);
  }
  console.log(`  Created ${associationMembers.length} association member records\n`);

  // ── 6. Create graduate committee members ──
  console.log("Creating graduate committee members...");

  const committeeRoles = [
    "ประธานกรรมการ",
    "กรรมการ",
    "เลขานุการกรรมการ",
    "ที่ปรึกษา",
  ];

  const committeeDegreeLevels: ("BACHELOR" | "MASTER" | "DOCTORAL" | "NURSING_CERTIFICATE")[] = [
    "MASTER", "DOCTORAL", "BACHELOR", "MASTER",
    "DOCTORAL", "BACHELOR", "MASTER", "MASTER",
    "DOCTORAL", "MASTER", "BACHELOR", "DOCTORAL",
    "MASTER", "MASTER", "DOCTORAL",
  ];

  const committeeData = [];
  const usedCommitteeSlots = new Set<string>();

  for (let i = 0; i < 15; i++) {
    const alumniIdx = (i * 3 + 7) % alumni.length;
    const termYear = 2560 + Math.floor(i * 8 / 15); // spread 2560-2568

    const key = `${alumni[alumniIdx].id}-${committeeRoles[i % committeeRoles.length]}-${termYear}`;
    if (usedCommitteeSlots.has(key)) continue;
    usedCommitteeSlots.add(key);

    committeeData.push({
      alumniId: alumni[alumniIdx].id,
      role: committeeRoles[i % committeeRoles.length],
      termYear,
      degreeLevel: committeeDegreeLevels[i % committeeDegreeLevels.length],
    });
  }

  const committees = [];
  for (const data of committeeData) {
    const record = await prisma.graduateCommittee.create({ data });
    committees.push(record);
  }
  console.log(`  Created ${committees.length} graduate committee records\n`);

  // ── 7. Create news articles ──
  console.log("Creating news articles...");

  const newsArticles = [
    {
      title: "กิจกรรมรับขวัญศิษย์เก่า ประจำปี 2568",
      body: "<p>คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่ จัดกิจกรรมรับขวัญศิษย์เก่า ประจำปี 2568 โดยมีศิษย์เก่าจากรุ่นต่างๆ เข้าร่วมงานอย่างคับคั่ง</p><p>กิจกรรมนี้ถือเป็นโอกาสทอดที่ศิษย์เก่าจะได้กลับมาพบปะสังสรรค์และแลกเปลี่ยนประสบการณ์กัน</p>",
      status: "PUBLISHED" as const,
      publishedAt: new Date("2025-11-15T09:00:00+07:00"),
    },
    {
      title: "ศิษย์เก่า FON CMU คว้ารางวัลระดับนานาชาติ",
      body: "<p>ศิษย์เก่าคณะพยาบาลศาสตร์ มช. ได้รับรางวัลระดับนานาชาติจากองค์การอนามัยโลก ในสาขาการพยาบาลชุมชน</p><p>ถือเป็นความภูมิใจของคณะและมหาวิทยาลัยอย่างยิ่ง</p>",
      status: "PUBLISHED" as const,
      publishedAt: new Date("2025-10-20T10:00:00+07:00"),
    },
    {
      title: "สัมมนาวิชาการพยาบาลแห่งอนาคต",
      body: "<p>คณะพยาบาลศาสตร์ มช. ร่วมกับสมาคมศิษย์เก่า จัดสัมมนาวิชาการหัวข้อ \"พยาบาลแห่งอนาคต: นวัตกรรมและเทคโนโลยี\"</p><p>งานจัดขึ้นในวันที่ 15 มกราคม 2569 ณ ห้องประชุมอาคารพยาบาลศาสตร์</p>",
      status: "PUBLISHED" as const,
      publishedAt: new Date("2025-12-01T08:30:00+07:00"),
    },
    {
      title: "โครงการอาสาสมัครพยาบาลชุมชน ปี 2568",
      body: "<p>เปิดรับสมัครอาสาสมัครพยาบาลชุมชน เพื่อให้บริการสาธารณสุขในพื้นที่ชนบท</p><p>ศิษย์เก่าที่สนใจสามารถสมัครได้ตั้งแต่บัดนี้เป็นต้นไป</p>",
      status: "PUBLISHED" as const,
      publishedAt: new Date("2025-09-10T14:00:00+07:00"),
    },
    {
      title: "รวมพลศิษย์เก่า FON CMU ครั้งที่ 25",
      body: "<p>สมาคมศิษย์เก่าคณะพยาบาลศาสตร์ มช. ขอเชิญศิษย์เก่าทุกท่านร่วมงานรวมพลศิษย์เก่า ครั้งที่ 25</p><p>กำหนดจัดในวันเสาร์ที่ 28 มีนาคม 2569 ณ โรงแรมดุสิตธานี เชียงใหม่</p>",
      status: "PUBLISHED" as const,
      publishedAt: new Date("2026-02-15T09:00:00+07:00"),
    },
    {
      title: "ทุนการศึกษาสำหรับศิษย์เก่าต่อทางการศึกษา",
      body: "<p>คณะพยาบาลศาสตร์ มช. เปิดรับสมัครทุนการศึกษาสำหรับศิษย์เก่าที่ต้องการศึกษาต่อในระดับปริญญาโทและปริญญาเอก</p><p>ทุนมีมูลค่า 50,000 - 100,000 บาท ต่อปี</p>",
      status: "PUBLISHED" as const,
      publishedAt: new Date("2026-01-20T10:00:00+07:00"),
    },
    {
      title: "ศิษย์เก่ารุ่นที่ 1 กลับมาเยี่ยมคณะ",
      body: "<p>ศิษย์เก่ารุ่นแรกของคณะพยาบาลศาสตร์ มช. กลับมาเยี่ยมคณะพร้อมบริจาคทุนการศึกษา</p><p>เป็นแรงบันดาลใจให้กับนิสิตรุ่นใหม่อย่างยิ่ง</p>",
      status: "PUBLISHED" as const,
      publishedAt: new Date("2025-08-05T11:00:00+07:00"),
    },
    {
      title: "อัพเดทระบบฐานข้อมูลศิษย์เก่าออนไลน์",
      body: "<p>กำลังพัฒนาระบบฐานข้อมูลศิษย์เก่าออนไลน์เวอร์ชันใหม่ คาดว่าจะเปิดใช้งานได้ในเดือนหน้า</p><p>ระบบใหม่จะรองรับการค้นหาและเชื่อมโยงศิษย์เก่าได้ดียิ่งขึ้น</p>",
      status: "DRAFT" as const,
      publishedAt: null,
    },
    {
      title: "แผนงานปรับปรุงหลักสูตรการพยาบาล ปี 2569",
      body: "<p>คณะพยาบาลศาสตร์ มช. วางแผนปรับปรุงหลักสูตรการพยาบาลให้ทันสมัยและสอดคล้องกับสถานการณ์ปัจจุบัน</p><p>ขอเชิญศิษย์เก่าร่วมให้ความคิดเห็นผ่านแบบสอบถามออนไลน์</p>",
      status: "DRAFT" as const,
      publishedAt: null,
    },
    {
      title: "โครงการพี่เลี้ยงศิษย์เก่าสู่นิสิตใหม่",
      body: "<p>โครงการพี่เลี้ยงศิษย์เก่าสู่นิสิตใหม่ เปิดโอกาสให้ศิษย์เก่าได้ให้คำปรึกษาและแนะแนวทางในการทำงานแก่นิสิตใหม่</p><p>สนใจร่วมโครงการติดต่อสมาคมศิษย์เก่าได้ตั้งแต่บัดนี้</p>",
      status: "DRAFT" as const,
      publishedAt: null,
    },
  ];

  const newsRecords = [];
  for (const article of newsArticles) {
    const record = await prisma.news.create({
      data: {
        title: article.title,
        body: article.body,
        coverImageUrl: null,
        status: article.status,
        publishedAt: article.publishedAt,
      },
    });
    newsRecords.push(record);
  }
  console.log(`  Created ${newsRecords.length} news articles\n`);

  // ── Summary ──
  console.log("=".repeat(50));
  console.log("Seeding complete! Summary:");
  console.log(`  Admin Users      : 2`);
  console.log(`  Alumni           : ${alumni.length}`);
  console.log(`  Awards           : ${awards.length}`);
  console.log(`  Association Mbrs : ${associationMembers.length}`);
  console.log(`  Graduate Comm.   : ${committees.length}`);
  console.log(`  News Articles    : ${newsRecords.length}`);
  console.log("=".repeat(50));
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
