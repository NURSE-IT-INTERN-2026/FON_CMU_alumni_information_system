import "dotenv/config";
import prisma from "../lib/prisma";
import { hashPassword } from "../lib/auth";

async function main() {
  console.log("Seeding database...\n");

  // ── 1. Clean existing data (reverse dependency order) ──
  console.log("Cleaning existing data...");
  await prisma.session.deleteMany();
  await prisma.award.deleteMany();
  await prisma.association.deleteMany();
  await prisma.graduateCommittee.deleteMany();
  await prisma.news.deleteMany();
  await prisma.potential.deleteMany();
  await prisma.abroadAlumni.deleteMany();
  await prisma.alumni.deleteMany();
  await prisma.adminUser.deleteMany();
  console.log("All existing data cleared.\n");

  // ── 2. Create admin users ──
  console.log("Creating admin users...");
  const adminHash = await hashPassword("password123");
  const superadminHash = await hashPassword("password123");

  const [admin, superadmin] = await Promise.all([
    prisma.adminUser.upsert({
      where: { email: "admin@fon.cmu.ac.th" },
      update: {},
      create: {
        name: "ผู้ดูแลระบบ",
        email: "admin@fon.cmu.ac.th",
        passwordHash: adminHash,
        role: "admin",
      },
    }),
    prisma.adminUser.upsert({
      where: { email: "superadmin@fon.cmu.ac.th" },
      update: {},
      create: {
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
    const initialYear = Math.min(2540 + Math.floor(i * 21 / 50), 2569);

    let graduationYear: number;
    if (degreeLevel === "DOCTORAL") {
      graduationYear = initialYear + 3;
    } else if (degreeLevel === "MASTER") {
      graduationYear = initialYear + 2;
    } else {
      graduationYear = initialYear + 4;
    }
    graduationYear = Math.min(graduationYear, 2569);

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
    const record = await prisma.alumni.upsert({
      where: { studentId: data.studentId },
      update: {},
      create: data,
    });
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
    const year = Math.min(2550 + Math.floor(i * 18 / 30), 2569);
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

  // ── 5. Create associations ──
  console.log("Creating associations...");

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

  const associationSeedData = [
    { studentId: "51430001", fullName: "สมชาย สุขใจ", associationName: "สมาคมศิษย์เก่าคณะพยาบาลศาสตร์ มช.", position: "ประธาน", recordedYear: 2568 },
    { studentId: "51440002", fullName: "สมหญิง บุญมี", associationName: "สมาคมศิษย์เก่าคณะพยาบาลศาสตร์ มช.", position: "รองประธาน", recordedYear: 2568 },
    { studentId: "51450003", fullName: "วิชัย ศรีสวัสดิ์", associationName: "สมาคมศิษย์เก่าคณะพยาบาลศาสตร์ มช.", position: "เลขานุการ", recordedYear: 2568 },
    { studentId: "51460004", fullName: "นภา วงศ์สวัสดิ์", associationName: "ชมรมพยาบาลภาคเหนือ", position: "ประธาน", recordedYear: 2569 },
    { studentId: "51470005", fullName: "พรรณี แก้วมณี", associationName: "ชมรมพยาบาลภาคเหนือ", position: "รองประธาน", recordedYear: 2569 },
    { studentId: "51480006", fullName: "ธนา ธนาพร", associationName: "ชมรมพยาบาลภาคเหนือ", position: "กรรมการ", recordedYear: 2569 },
    { studentId: "51490007", fullName: "ประภาส รัตนชัย", associationName: "สมาคมพยาบาลแห่งประเทศไทย", position: "ประธาน", recordedYear: 2567 },
    { studentId: "51500008", fullName: "จิตรา พงษ์ประเสริฐ", associationName: "สมาคมพยาบาลแห่งประเทศไทย", position: "ที่ปรึกษา", recordedYear: 2567 },
    { studentId: "51510009", fullName: "สุภาพ สิทธิโชค", associationName: "สมาคมศิษย์เก่าคณะพยาบาลศาสตร์ มช.", position: "กรรมการ", recordedYear: 2569 },
    { studentId: "51520010", fullName: "วันดี เจริญสุข", associationName: "ชมรมพยาบาลภาคเหนือ", position: "เลขานุการ", recordedYear: 2568 },
    { studentId: "51530011", fullName: "อรุณ วิเชียรเจริญ", associationName: "สมาคมพยาบาลแห่งประเทศไทย", position: "กรรมการ", recordedYear: 2568 },
    { studentId: "51540012", fullName: "ปิยะ สมบูรณ์", associationName: "สมาคมศิษย์เก่าคณะพยาบาลศาสตร์ มช.", position: "ที่ปรึกษา", recordedYear: 2567 },
  ];

  const associations = [];
  for (const data of associationSeedData) {
    const record = await prisma.association.create({ data });
    associations.push(record);
  }
  console.log(`  Created ${associations.length} association records\n`);

  // ── 6. Create graduate committee members ──
  console.log("Creating graduate committee members...");

  const committeePositions = [
    "ประธานกรรมการ",
    "กรรมการ",
    "เลขานุการกรรมการ",
    "ที่ปรึกษา",
  ];

  const committeeData = [
    { termYear: 2568, studentId: "51430001", fullName: "สมชาย สุขใจ", cohort: "1", position: "ประธานกรรมการ", remarks: null },
    { termYear: 2568, studentId: "51440002", fullName: "สมหญิง บุญมี", cohort: "1", position: "กรรมการ", remarks: null },
    { termYear: 2568, studentId: "51450003", fullName: "วิชัย ศรีสวัสดิ์", cohort: "2", position: "เลขานุการกรรมการ", remarks: null },
    { termYear: 2569, studentId: "51460004", fullName: "นภา วงศ์สวัสดิ์", cohort: "2", position: "ที่ปรึกษา", remarks: null },
    { termYear: 2569, studentId: "51470005", fullName: "พรรณี แก้วมณี", cohort: "3", position: "ประธานกรรมการ", remarks: null },
    { termYear: 2569, studentId: "51480006", fullName: "ธนา ธนาพร", cohort: "3", position: "กรรมการ", remarks: "ด้านวิชาการ" },
    { termYear: 2567, studentId: "51490007", fullName: "ประภาส รัตนชัย", cohort: "4", position: "กรรมการ", remarks: null },
    { termYear: 2567, studentId: "51500008", fullName: "จิตรา พงษ์ประเสริฐ", cohort: "4", position: "เลขานุการกรรมการ", remarks: null },
    { termYear: 2567, studentId: "51510009", fullName: "สุภาพ สิทธิโชค", cohort: "5", position: "ประธานกรรมการ", remarks: null },
    { termYear: 2568, studentId: "51520010", fullName: "วันดี เจริญสุข", cohort: "5", position: "ที่ปรึกษา", remarks: null },
    { termYear: 2568, studentId: "51530011", fullName: "อรุณ วิเชียรเจริญ", cohort: "6", position: "กรรมการ", remarks: null },
    { termYear: 2569, studentId: "51540012", fullName: "ปิยะ สมบูรณ์", cohort: "6", position: "กรรมการ", remarks: null },
    { termYear: 2569, studentId: "51550013", fullName: "มนัส กิจเจริญ", cohort: "7", position: "ประธานกรรมการ", remarks: null },
    { termYear: 2568, studentId: "51560014", fullName: "กานดา ภูมิพัฒน์", cohort: "7", position: "เลขานุการกรรมการ", remarks: null },
    { termYear: 2567, studentId: "51570015", fullName: "ธีรพงษ์ มณีรัตน์", cohort: "8", position: "ที่ปรึกษา", remarks: "ด้านบริหาร" },
  ];

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

  // ── 8. Create potentials ──
  console.log("Creating potentials...");

  const potentialData = [
    { studentId: "51430001", fullName: "สมชาย สุขใจ", career: "พยาบาลวิชาชีพ", position: "ผู้จัดการแผนกผู้ป่วยใน", recordedYear: 2568 },
    { studentId: "51440002", fullName: "สมหญิง บุญมี", career: "อาจารย์พยาบาล", position: "รองศาสตราจารย์", recordedYear: 2568 },
    { studentId: "51450003", fullName: "วิชัย ศรีสวัสดิ์", career: "ผู้บริหารโรงพยาบาล", position: "ผู้อำนวยการโรงพยาบาล", recordedYear: 2568 },
    { studentId: "51460004", fullName: "นภา วงศ์สวัสดิ์", career: "นักวิจัยทางการพยาบาล", position: "หัวหน้าทีมวิจัย", recordedYear: 2569 },
    { studentId: "51470005", fullName: "พรรณี แก้วมณี", career: "พยาบาลผู้ป่วยวิกฤต", position: "พยาบาลวิชาชีพชำนาญการพิเศษ", recordedYear: 2569 },
    { studentId: "51480006", fullName: "ธนา ธนาพร", career: "ที่ปรึกษาด้านสาธารณสุข", position: "ที่ปรึกษาองค์การอนามัยโลก", recordedYear: 2569 },
    { studentId: "51490007", fullName: "ประภาส รัตนชัย", career: "พยาบาลสูติกรรม", position: "หัวหน้าหอผู้ป่วย", recordedYear: 2567 },
    { studentId: "51500008", fullName: "จิตรา พงษ์ประเสริฐ", career: "นักวิชาการสาธารณสุข", position: "ผู้เชี่ยวชาญด้านนโยบายสาธารณสุข", recordedYear: 2567 },
    { studentId: "51510009", fullName: "สุภาพ สิทธิโชค", career: "พยาบาลจิตเวช", position: "พยาบาลวิชาชีพชำนาญการ", recordedYear: 2567 },
    { studentId: "51520010", fullName: "วันดี เจริญสุข", career: "ผู้จัดการโครงการสุขภาพ", position: "ผู้จัดการโครงการ", recordedYear: 2568 },
    { studentId: "51530011", fullName: "อรุณ วิเชียรเจริญ", career: "อาจารย์คลินิก", position: "อาจารย์ ระดับ 9", recordedYear: 2569 },
    { studentId: "51540012", fullName: "ปิยะ สมบูรณ์", career: "พยาบาลเด็กแรกเกิด", position: "พยาบาลวิชาชีพชำนาญการพิเศษ", recordedYear: 2569 },
    { studentId: "51550013", fullName: "มนัส กิจเจริญ", career: "ผู้บริหารการพยาบาล", position: "ผู้อำนวยการกองการพยาบาล", recordedYear: 2568 },
    { studentId: "51560014", fullName: "กานดา ภูมิพัฒน์", career: "นักวิจัยด้านมะเร็งวิทยา", position: "นักวิจัยหลังปริญญาเอก", recordedYear: 2567 },
    { studentId: "51570015", fullName: "ธีรพงษ์ มณีรัตน์", career: "พยาบาลชุมชน", position: "หัวหน้าสถานีอนามัย", recordedYear: 2568 },
  ];

  const potentials = [];
  for (const data of potentialData) {
    const record = await prisma.potential.create({ data });
    potentials.push(record);
  }
  console.log(`  Created ${potentials.length} potential records\n`);

  // ── 9. Create abroad alumni (scraped from reference site) ──
  console.log("Creating abroad alumni...");

  const abroadAlumniData = [
    // USA alumni (1-45)
    { name: "สุดฤทัย ศรีกำพล", address: "14300 Terra Bella #29 Panorama City CA.91402", country: "สหรัฐอเมริกา", university: null, order: 1 },
    { name: "Vachareeratang Sererut", address: "5545 N.California Chicago IL.60625", country: "สหรัฐอเมริกา", university: null, order: 2 },
    { name: "กาญจนา แต่งสอน", address: "81-60 247 th St.Bellerose, N.Y. 11426", country: "สหรัฐอเมริกา", university: null, order: 3 },
    { name: "วไลลักษณ์ ภัณธนเกษม", address: "373 ถ.วานิช 1 ต.จักรวรรดิ สัมพันธวงศ์ กทม. 10100", country: "สหรัฐอเมริกา", university: null, order: 4 },
    { name: "อรพรรณ พันธาภิรัตน์", address: "624 LongHilll RN River Valr N.S. 07672", country: "สหรัฐอเมริกา", university: null, order: 5 },
    { name: "Thida Petchor", address: "965 Ramsden Run, Alpharetta, CA. 30022-4702", country: "สหรัฐอเมริกา", university: null, order: 6 },
    { name: "พิศมัย ตันพัฒนาเจริญ", address: "500 Ackly St.Monterey Park CA. 91755 USA.", country: "สหรัฐอเมริกา", university: null, order: 7 },
    { name: "Orapin Chullasavock", address: "4035 N.Sawyer Chicago Illinois 60618", country: "สหรัฐอเมริกา", university: null, order: 8 },
    { name: "จินตนา ไกรลาศ (กูรมะโรหิต)", address: "1461 LA Lome Drive, Santa ANA, CA. 92705", country: "สหรัฐอเมริกา", university: null, order: 9 },
    { name: "ฉวีวรรณ สีละวิทย์", address: "3308, W. 189 th St.Torrance, CA. 90504", country: "สหรัฐอเมริกา", university: null, order: 10 },
    { name: "กัลยาณี นาคประดิษฐ์ (เนตรอัคคี)", address: "33-12 86 Street Jackson Heights, N.Y. 11372-1536", country: "สหรัฐอเมริกา", university: null, order: 11 },
    { name: "Pimpaka Suriyong", address: "4035 N.Sawyer Chicago IL. 60618", country: "สหรัฐอเมริกา", university: null, order: 12 },
    { name: "ผกาวรรณ อุณหะสูต", address: "711 Prospect Ave Mamaroneck N.Y. 10543", country: "สหรัฐอเมริกา", university: null, order: 13 },
    { name: "พวงทรัพย์ เปรื่องการ สูณัฐตระกูล", address: "7338 Wolfreen Trail Fairview Heights, IL. 62208", country: "สหรัฐอเมริกา", university: null, order: 14 },
    { name: "ประจง (วิญิบุตร) พิทยาธิคุณ", address: "705 Campbell Drive Sparta IL.62286", country: "สหรัฐอเมริกา", university: null, order: 15 },
    { name: "ลดารัตน์ (เกียรติพลพจน์) ตั้งชีวินศิริกุล", address: "7346 Wolfreen Trail, Fairview Heights, IL.62208.", country: "สหรัฐอเมริกา", university: null, order: 16 },
    { name: "เจือจันทร์ จัยสิน", address: "1165 Cruknit Lane Coring CA.92880", country: "สหรัฐอเมริกา", university: null, order: 17 },
    { name: "เครือวัลย์ ศรีวภา (Kruewan Srivapa)", address: "1 EI Vaquero, Rnch Snta Margar, CA 92688", country: "สหรัฐอเมริกา", university: null, order: 18 },
    { name: "จำนง นิ่มตระกูล (C. Nimtragool)", address: "13130 Caravel St., Cerritos, CA 90703", country: "สหรัฐอเมริกา", university: null, order: 19 },
    { name: "ชวนพิศ (เกิดเนียม) สังขกิจกรณีย์ (C.Sungkakitkoranee)", address: "5896 Sycamore Ave., Rialto, CA 92377-3910", country: "สหรัฐอเมริกา", university: null, order: 20 },
    { name: "ทัสนีย์ (ธนานุรักษ์) (Thasani Chandra)", address: "1168 Barbara Dr., Cherry Hill, NJ. 08003", country: "สหรัฐอเมริกา", university: null, order: 21 },
    { name: "พัฒนา บุญมี (P.Boonmee)", address: "19625 Sabrina Ct. Cerritos, CA 90701", country: "สหรัฐอเมริกา", university: null, order: 22 },
    { name: "เพ็ญศรี (กุยยกานนท์) อติภัทธะ (Pensri Athipatha)", address: "7852 West Park Ave., Niles, IL 60714", country: "สหรัฐอเมริกา", university: null, order: 23 },
    { name: "วรรธนา (การุณยุญญานันท์) ชุณห์ถนอม (Wadhana Choontanom)", address: "1825 Jacaranda Place, Fullerton, CA 92833", country: "สหรัฐอเมริกา", university: null, order: 24 },
    { name: "วัลลภา (ศุภศิริรัตน์) รักสกุลไทย (V.Rukskulthai)", address: "201 Williams, Fredericktown, MO 63645", country: "สหรัฐอเมริกา", university: null, order: 25 },
    { name: "สมสุข (เครือวรรณ) สาระชัย (S.K. Sarachai)", address: "3318 76th St., Flushing, NY. 11372-1152", country: "สหรัฐอเมริกา", university: null, order: 26 },
    { name: "เสาวนีย์ (สุทธพินธุ) จุฬามรกต (S.Chulamorakodt)", address: "R.R. #3 Box 94, Vandalia, IL 62471 E-mail: Chulamorkodt@yahoo.com.", country: "สหรัฐอเมริกา", university: null, order: 27 },
    { name: "โสมนัส (ไชยเพ็ชร) เสริมชีพ (S.Sermchief)", address: "1222 Stonewolf Tr., Fairveiw Height, IL. 62208", country: "สหรัฐอเมริกา", university: null, order: 28 },
    { name: "อารียา (จินตธรรม) Adams", address: "8634 Forsythe St., Sunland, CA 91041", country: "สหรัฐอเมริกา", university: null, order: 29 },
    { name: "พริ้มเพรา สุชาตานนท์ (P. SUTATANOND)", address: "1209 E. CLARK TRAIL HERRIN IL 62948 U.S.A. H: 618-942-2807", country: "สหรัฐอเมริกา", university: null, order: 30 },
    { name: "ประคองศรี ศักดิ์ศรี (P. SAKDISRI)", address: "121 CRESTMOOR St COLLINSVILLE IL 62234 U.S.A. H: 618-346-2549 C: 618-210-7679", country: "สหรัฐอเมริกา", university: null, order: 31 },
    { name: "พวงทรัพย์ สุณัฐตระกูล (P. SOONATTRAKUL)", address: "7338 WOLF RUN TRAIL FAIRVIEW HEIGHTS IL 62208 U.S.A. H: 618-628-7262 C: 573-888-2128", country: "สหรัฐอเมริกา", university: null, order: 32 },
    { name: "พิจิตร พฤติธรรม (P. PHRUTTITUM)", address: "3 FLAG STICK COURT St. LOUIS MO 63127 U.S.A. H: 641-228-6084 C: 641-330-5736", country: "สหรัฐอเมริกา", university: null, order: 33 },
    { name: "ละเอียด ฉัตรคุปต์", address: "1213 JILL LANE EXELSIOR SPRING, MO 64024 U.S.A. H: 816-630-5269 C: 816-686-5069", country: "สหรัฐอเมริกา", university: null, order: 34 },
    { name: "ลิบดา ติวรศักดิ์ (L. TIVORSAK)", address: "1716 COUNTRY LANE AT CHINSON KA 66002 U.S.A. H: 913-367-0089", country: "สหรัฐอเมริกา", university: null, order: 35 },
    { name: "อัมพร ศุภวนิช (A. SUPAWANICH)", address: "9841 CANNON GATE PKWY VILLA RICA, GA 30180 U.S.A. H: 770-456-0666 C: 678-371-8006", country: "สหรัฐอเมริกา", university: null, order: 36 },
    { name: "แสงดาว ตุลยเสถียร (S. TULYASATHIEN)", address: "4306 156Th AVE NE APT PP 147 REDMOND, WA 98052 U.S.A. C: 425-885-2636", country: "สหรัฐอเมริกา", university: null, order: 37 },
    { name: "จุไร ไกรสร (J. KRAISORN)", address: "1104 S. CALIFORNIA AVE W. COVINA, CA 91790 U.S.A. H: 626-960-7134 C: 626-806-2133", country: "สหรัฐอเมริกา", university: null, order: 38 },
    { name: "จิตราภรณ์ Kanares", address: "840 E LIVE OAK St. APT. B GABRIEL, CA 91776 U.S.A. 626-291-2594", country: "สหรัฐอเมริกา", university: null, order: 39 },
    { name: "พรรณี CLARK", address: "2175 DE COTO APT # 192 UNION CITY CA 94587 U.S.A.", country: "สหรัฐอเมริกา", university: null, order: 40 },
    { name: "ขวัญใจ Narangajavana (K. NARANGAJAVANA)", address: "2804 A WELSH ROAD PHILADELPHIA. PA 19152 U.S.A. 215-969-4872", country: "สหรัฐอเมริกา", university: null, order: 41 },
    { name: "สุทธิลักษณ์ BRENT", address: "6441 lock LOCK LOMMOND DR. KEYSTONE HEIGHTS FL 32656 U.S.A. H: 352-473-2350", country: "สหรัฐอเมริกา", university: null, order: 42 },
    { name: "ปานจิต ฮันตระกูล (P. HUNTRAKUL)", address: "1501 METROPOLITAN AVE #8 D BRONX, NY 10462 U.S.A. 718-863-0800", country: "สหรัฐอเมริกา", university: null, order: 43 },
    { name: "ศุภนิตย์ Sethakorn", address: "541 Meadow Dr. Gibson city, IL 60931 U.S.A. H. 217-784-4104", country: "สหรัฐอเมริกา", university: null, order: 44 },
    { name: "เกสร จันทร์ประภาพ", address: "S. 308 Birnam Trail Willow Brook, IL 60527 U.S.A. / 6 ถ. สันติรักษ์ ต. ช้างเผือก อ. เมือง จ. เชียงใหม่ 50300 H: 053-219-831", country: "สหรัฐอเมริกา", university: null, order: 45 },
    // Central South University Xiang-Ya School of Nursing — Changsha, Hunan
    { name: "Prof. He Guoping (Dean)", address: "Xiangya School of Nursing, 172 Tongzipo Rd, Changsha, Hunan 410013", country: "ประเทศจีน", university: "Central South University Xiang-Ya School of Nursing", order: 1 },
    { name: "Cai Yimin [G 5]", address: "Xiangya School of Nursing, 172 Tongzipo Rd, Changsha, Hunan 410013", country: "ประเทศจีน", university: "Central South University Xiang-Ya School of Nursing", order: 2 },
    { name: "Huang Jin [G 1]", address: "Xiangya School of Nursing, 172 Tongzipo Rd, Changsha, Hunan 410013", country: "ประเทศจีน", university: "Central South University Xiang-Ya School of Nursing", order: 3 },
    { name: "Li Lezhi [G 2]", address: "Xiangya School of Nursing, 172 Tongzipo Rd, Changsha, Hunan 410013", country: "ประเทศจีน", university: "Central South University Xiang-Ya School of Nursing", order: 4 },
    { name: "Wang Honghong [G 1]", address: "Xiangya School of Nursing, 172 Tongzipo Rd, Changsha, Hunan 410013", country: "ประเทศจีน", university: "Central South University Xiang-Ya School of Nursing", order: 5 },
    { name: "Yan Jin [G 2]", address: "Xiangya School of Nursing, 172 Tongzipo Rd, Changsha, Hunan 410013", country: "ประเทศจีน", university: "Central South University Xiang-Ya School of Nursing", order: 6 },
    { name: "Zeng Hui [G 5]", address: "Xiangya School of Nursing, 172 Tongzipo Rd, Changsha, Hunan 410013", country: "ประเทศจีน", university: "Central South University Xiang-Ya School of Nursing", order: 7 },
    { name: "Zhang Jingping [G 3]", address: "Xiangya School of Nursing, 172 Tongzipo Rd, Changsha, Hunan 410013", country: "ประเทศจีน", university: "Central South University Xiang-Ya School of Nursing", order: 8 },
    // China Medical University — Shenyang, Liaoning
    { name: "Prof. Qiao Min (Dean)", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 1 },
    { name: "Prof. Yu Yan Gin (Director of Nursing College)", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 2 },
    { name: "Cao Ying [G 3]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 3 },
    { name: "Fan Ling [G 5]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 4 },
    { name: "Guo Hong [G 4]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 5 },
    { name: "Li Xiaohan [G 1]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 6 },
    { name: "Sun Tianjie [G 5]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 7 },
    { name: "Wang Jian [G 1]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 8 },
    { name: "Zhang Bo [G 4]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 9 },
    { name: "Zhang Xiuyue [G 4]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 10 },
    { name: "Zhao Haping [G 2]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 11 },
    // Fudan University — Shanghai
    { name: "Dr. Jai Hongli (Dean)", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 1 },
    { name: "Prof. Dai Baozhen (Former Dean)", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 2 },
    { name: "Prof. Yang Yinghua (Former Dean)", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 3 },
    { name: "Cheng Yun [G 3]", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 4 },
    { name: "Hu Yan [G 1]", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 5 },
    { name: "Li Xiaoying [G 4]", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 6 },
    { name: "Shao Wenli [G 1]", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 7 },
    { name: "Xi Shuxin [G 4]", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 8 },
    { name: "Xia Haiou [G 4]", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 9 },
    { name: "Xu Hong [G 3]", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 10 },
    { name: "Yan Meiqiong [G 2]", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 11 },
    // Peking Union Medical College — Beijing
    { name: "Dr. Huaping Liu (Dean)", address: "School of Nursing, 9 Dongdan 3rd Alley, Dongcheng District, Beijing 100730", country: "ประเทศจีน", university: "Peking Union Medical College", order: 1 },
    { name: "Chen Jingli [G 2]", address: "School of Nursing, 9 Dongdan 3rd Alley, Dongcheng District, Beijing 100730", country: "ประเทศจีน", university: "Peking Union Medical College", order: 2 },
    { name: "Li Zheng [G 1]", address: "School of Nursing, 9 Dongdan 3rd Alley, Dongcheng District, Beijing 100730", country: "ประเทศจีน", university: "Peking Union Medical College", order: 3 },
    { name: "Liang Xiaokun [G 3]", address: "School of Nursing, 9 Dongdan 3rd Alley, Dongcheng District, Beijing 100730", country: "ประเทศจีน", university: "Peking Union Medical College", order: 4 },
    { name: "Liu Jianfen [G 2]", address: "School of Nursing, 9 Dongdan 3rd Alley, Dongcheng District, Beijing 100730", country: "ประเทศจีน", university: "Peking Union Medical College", order: 5 },
    { name: "Sheng Yu [G 5]", address: "School of Nursing, 9 Dongdan 3rd Alley, Dongcheng District, Beijing 100730", country: "ประเทศจีน", university: "Peking Union Medical College", order: 6 },
    { name: "Zhao Yan [G 4]", address: "School of Nursing, 9 Dongdan 3rd Alley, Dongcheng District, Beijing 100730", country: "ประเทศจีน", university: "Peking Union Medical College", order: 7 },
    // Peking University Health Science Center — Beijing
    { name: "Prof. Zheng Xiuxia (Dean)", address: "School of Nursing, 38 Xueyuan Rd, Haidian District, Beijing 100191", country: "ประเทศจีน", university: "Peking University Health Science Center", order: 1 },
    { name: "Prof. Yao Jingpeng (Former Dean)", address: "School of Nursing, 38 Xueyuan Rd, Haidian District, Beijing 100191", country: "ประเทศจีน", university: "Peking University Health Science Center", order: 2 },
    { name: "Liu Jun-e [G 3]", address: "School of Nursing, 38 Xueyuan Rd, Haidian District, Beijing 100191", country: "ประเทศจีน", university: "Peking University Health Science Center", order: 3 },
    { name: "Liu Yu [G 4]", address: "School of Nursing, 38 Xueyuan Rd, Haidian District, Beijing 100191", country: "ประเทศจีน", university: "Peking University Health Science Center", order: 4 },
    { name: "Wang Chenguang [G 5]", address: "School of Nursing, 38 Xueyuan Rd, Haidian District, Beijing 100191", country: "ประเทศจีน", university: "Peking University Health Science Center", order: 5 },
    { name: "Wang Qun [G 3]", address: "School of Nursing, 38 Xueyuan Rd, Haidian District, Beijing 100191", country: "ประเทศจีน", university: "Peking University Health Science Center", order: 6 },
    { name: "Zhang Haiyan [G 2]", address: "School of Nursing, 38 Xueyuan Rd, Haidian District, Beijing 100191", country: "ประเทศจีน", university: "Peking University Health Science Center", order: 7 },
    // Sichuan University — Chengdu, Sichuan
    { name: "Prof. Jiang Xiaolian (Dean)", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 1 },
    { name: "Prof. Yin Kei (Former Dean)", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 2 },
    { name: "Feng Xiangqiong [G 5]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 3 },
    { name: "Li Xiao lin [G 3]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 4 },
    { name: "Li Xiaoling [G 1]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 5 },
    { name: "Liu Suzhen [G 3]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 6 },
    { name: "Song Jingping [G 5]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 7 },
    { name: "Wang Shiping [G 1]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 8 },
    { name: "Wang Yuqiong [G 2]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 9 },
    { name: "Zhao Xiufang [G 4]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 10 },
    { name: "Zhu Mingxia [G 2]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 11 },
    // Sun Yat-Sen University, Guangzhou — Guangdong
    { name: "Assoc.Prof. You Liming (Dean)", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 1 },
    { name: "Chen Xhi Qun [G 4]", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 2 },
    { name: "Gao Lingling [G 5]", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 3 },
    { name: "Liu Ke [G 3]", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 4 },
    { name: "Lin Xiyin [G 1]", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 5 },
    { name: "Luo Xhimin [G 3]", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 6 },
    { name: "Yan Jun [G 4]", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 7 },
    { name: "Zeng Wen [G 1]", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 8 },
    { name: "Zhang Meifen [G 2]", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 9 },
    { name: "Zhu Yanli", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 10 },
    // Xi'an Jiaotong University — Xi'an, Shaanxi
    { name: "Prof. Zheng Nanning (President)", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 1 },
    { name: "Prof. Ren Huimin", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 2 },
    { name: "Dr. Yan Jianqun", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 3 },
    { name: "Dr. Yan Hong", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 4 },
    { name: "Dr. Li Wei", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 5 },
    { name: "Dr. Zhu Hongliang", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 6 },
    { name: "Assoc.Prof. Li Xiaomei (Dean) [G 1]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 7 },
    { name: "Gao Rui [G 4]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 8 },
    { name: "Gu Wei [G 3]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 9 },
    { name: "Jiang Wenhui [G 2]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 10 },
    { name: "Li Jing [G 2]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 11 },
    { name: "Liu Ming [G 4]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 12 },
    { name: "Lu Aili [G 5]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 13 },
    { name: "Wang Wenru [G 1]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 14 },
    { name: "Wang Xiaoquin [G 5]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 15 },
  ];

  const abroadAlumni = [];
  for (const data of abroadAlumniData) {
    const record = await prisma.abroadAlumni.create({ data });
    abroadAlumni.push(record);
  }
  console.log(`  Created ${abroadAlumni.length} abroad alumni records\n`);

  // ── Summary ──
  console.log("=".repeat(50));
  console.log("Seeding complete! Summary:");
  console.log(`  Admin Users      : 2`);
  console.log(`  Alumni           : ${alumni.length}`);
  console.log(`  Awards           : ${awards.length}`);
  console.log(`  Associations     : ${associations.length}`);
  console.log(`  Graduate Comm.   : ${committees.length}`);
  console.log(`  News Articles    : ${newsRecords.length}`);
  console.log(`  Potentials       : ${potentials.length}`);
  console.log(`  Abroad Alumni    : ${abroadAlumni.length}`);
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
