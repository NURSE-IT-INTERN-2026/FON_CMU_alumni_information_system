import "dotenv/config";
import prisma from "../lib/prisma";
import { hashPassword } from "../lib/auth";

const ALL_DEGREE_LEVELS = ["BACHELOR", "MASTER", "DOCTORAL", "NURSING_ASSISTANT"] as const;
function randomDegreeLevel() {
  return ALL_DEGREE_LEVELS[Math.floor(Math.random() * ALL_DEGREE_LEVELS.length)];
}

function parseThaiName(raw: string): { prefix: string; firstName: string; maidenLastName: string; newLastName: string | null } {
  let name = raw.replace(/\s+/g, " ").trim();

  // Extract maiden name from parentheses: "ลดารักษณ์ (เกียรติพลพจน์) ตั้งชีวินศิริกุล"
  // → maidenLastName = "เกียรติพลพจน์", newLastName = "ตั้งชีวินศิริกุล"
  // But English parentheticals like (Dean), (President) are titles, not names
  let maidenLastName = "";
  let newLastName: string | null = null;
  const parenMatch = name.match(/^(.+?)\s*\(([^)]+)\)\s*(.*)$/);
  if (parenMatch) {
    const parenContent = parenMatch[2].trim();
    const isThaiName = /[฀-๿]/.test(parenContent);
    const isEnglishTitle = /^(Dean|President|Director|Former|Prof|Dr|Mr|Mrs|Ms)/i.test(parenContent);
    if (isThaiName && !isEnglishTitle) {
      name = parenMatch[1].trim();
      maidenLastName = parenContent;
      const after = parenMatch[3].trim();
      if (after) newLastName = after.replace(/\s*[\[(].*?[\])]/g, "").trim() || null;
    }
  }

  // Remove non-name parenthetical like [G 1], (Dean), (President)
  name = name.replace(/\s*[\[(].*?[\])]/g, "").trim();
  if (newLastName) newLastName = newLastName.replace(/\s*[\[(].*?[\])]/g, "").trim() || null;

  const thaiPrefixes = ["รศ.ดร.", "รศ ดร.", "ผศ.ดร.", "ผศ ดร.", "รศ.", "รศ ", "ผศ.", "ผศ ", "อ.ดร.", "ดร.", "อ.", "คุณ", "มล."];
  const engPrefixes = ["Prof.", "Assoc.Prof.", "Dr."];

  let prefix = "นางสาว";
  for (const p of thaiPrefixes) {
    if (name.startsWith(p)) {
      prefix = p.replace(/\s+/g, ".");
      name = name.slice(p.length).trim();
      break;
    }
  }
  if (prefix === "นางสาว") {
    for (const p of engPrefixes) {
      if (name.startsWith(p)) {
        prefix = p;
        name = name.slice(p.length).trim();
        break;
      }
    }
  }

  const parts = name.split(/\s+/).filter(Boolean);
  if (!maidenLastName) {
    maidenLastName = parts.slice(1).join(" ") || "ไม่ทราบ";
  }

  return {
    prefix,
    firstName: parts[0] || "ไม่ทราบ",
    maidenLastName,
    newLastName,
  };
}

async function main() {
  console.log("Seeding database...\n");

  // ── 0. Clean up existing data ──
  console.log("Cleaning up existing data...");
  await prisma.abroadAlumni.deleteMany();
  await prisma.modelRepresentative.deleteMany();
  await prisma.potential.deleteMany();
  await prisma.graduateCommittee.deleteMany();
  await prisma.association.deleteMany();
  await prisma.award.deleteMany();
  await prisma.news.deleteMany();
  await prisma.alumni.deleteMany();
  console.log("  All existing data cleared\n");

  // ── 1. Upsert admin users ──
  console.log("Upserting admin users...");
  const adminHash = await hashPassword("password123");
  const superadminHash = await hashPassword("password123");

  const [admin, superadmin] = await Promise.all([
    prisma.adminUser.upsert({
      where: { email: "admin@fon.cmu.ac.th" },
      update: { firstName: "ผู้ดูแล", lastName: "ระบบ", passwordHash: adminHash, role: "admin" },
      create: {
        firstName: "ผู้ดูแล",
        lastName: "ระบบ",
        email: "admin@fon.cmu.ac.th",
        passwordHash: adminHash,
        role: "admin",
      },
    }),
    prisma.adminUser.upsert({
      where: { email: "superadmin@fon.cmu.ac.th" },
      update: { firstName: "ผู้ดูแลระบบ", lastName: "สูงสุด", passwordHash: superadminHash, role: "superadmin" },
      create: {
        firstName: "ผู้ดูแลระบบ",
        lastName: "สูงสุด",
        email: "superadmin@fon.cmu.ac.th",
        passwordHash: superadminHash,
        role: "superadmin",
      },
    }),
  ]);
  console.log(`  Upserted admin: ${admin.email}`);
  console.log(`  Upserted superadmin: ${superadmin.email}\n`);

  // ── 2. Upsert alumni records ──
  console.log("Upserting alumni...");

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

  const prefixes = [
    "นางสาว", "นาง", "นาย", "นางสาว", "นาง",
    "นาย", "นาย", "นางสาว", "นาย", "นาง",
    "นาย", "นางสาว", "นาย", "นางสาว", "นาง",
    "ดร.", "ดร.", "นาย",
    "นางสาว", "นางสาว", "นางสาว",
    "นาย", "นางสาว", "นาง", "นาย", "นางสาว",
    "นาย", "นาง", "นาย", "นางสาว", "นาย",
    "นางสาว", "นาย", "นาง", "นางสาว", "ดร.",
    "นาย", "นาง", "นางสาว", "นาย", "นาย",
    "ดร.", "นางสาว", "ดร.", "นาย", "นาง",
    "นางสาว", "นาง", "นาย", "นางสาว", "ดร.",
  ];

  const provinces = [
    "เชียงใหม่", "กรุงเทพมหานคร", "ลำปาง", "เชียงราย", "พะเยา",
    "น่าน", "แพร่", "สุโขทัย", "พิษณุโลก", "ขอนแก่น",
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

  const degreeLevels: ("BACHELOR" | "MASTER" | "DOCTORAL" | "NURSING_ASSISTANT")[] = [
    "BACHELOR", "BACHELOR", "BACHELOR", "BACHELOR", "MASTER",
    "BACHELOR", "BACHELOR", "BACHELOR", "MASTER", "BACHELOR",
    "BACHELOR", "BACHELOR", "MASTER", "DOCTORAL", "BACHELOR",
    "BACHELOR", "BACHELOR", "MASTER", "BACHELOR", "MASTER",
    "BACHELOR", "MASTER", "BACHELOR", "BACHELOR", "DOCTORAL",
    "MASTER", "BACHELOR", "BACHELOR", "BACHELOR", "MASTER",
    "BACHELOR", "MASTER", "BACHELOR", "DOCTORAL", "BACHELOR",
    "MASTER", "BACHELOR", "BACHELOR", "BACHELOR", "MASTER",
    "DOCTORAL", "BACHELOR", "MASTER", "BACHELOR", "NURSING_ASSISTANT",
    "NURSING_ASSISTANT", "NURSING_ASSISTANT", "NURSING_ASSISTANT", "NURSING_ASSISTANT", "NURSING_ASSISTANT",
  ];

  // Generation prefixes (first 2 digits of studentId) — varies per record
  const genPrefixes = [
    "51", "51", "52", "52", "53",
    "53", "54", "54", "55", "55",
    "51", "52", "53", "54", "55",
    "51", "52", "53", "54", "55",
    "51", "52", "53", "54", "55",
    "51", "52", "53", "54", "55",
    "51", "52", "53", "54", "55",
    "51", "52", "53", "54", "55",
    "51", "52", "53", "54", "51",
    "52", "53", "54", "55", "51",
  ];

  const alumniData = [];

  for (let i = 0; i < 50; i++) {
    const firstName = firstNames[i];
    const maidenLastName = lastNames[i % lastNames.length];

    const hasEmail = i % 3 !== 2;
    const hasPhone = i % 2 === 0;
    const workplace = workplaces[i % workplaces.length];
    const isPotential = i < 10;
    const isModelRep = i >= 10 && i < 18;
    const isAbroad = i < 15;

    alumniData.push({
      studentId: `${genPrefixes[i]}43${String(i + 1).padStart(4, "0")}`,
      prefix: prefixes[i],
      firstName,
      maidenLastName,
      degreeLevel: degreeLevels[i],
      cohort: `รุ่น ${(i % 38) + 1}`,
      newLastName: i % 7 === 0 ? "วงศ์สวัสดิ์ใหม่" : null,
      province: i % 3 === 0 ? provinces[i % provinces.length] : null,
      email: hasEmail ? `${firstName}.${maidenLastName}@gmail.com` : null,
      phone: hasPhone ? `0${8 + (i % 3)}-${String(1000 + i * 111).slice(0, 4)}-${String(1000 + i * 37).slice(0, 4)}` : null,
      currentWorkplace: isAbroad ? null : workplace,
      country: isAbroad ? abroadCountries[i % abroadCountries.length] : null,
      isPotential,
      isModelRepresentative: isModelRep,
      photoUrl: null,
    });
  }

  const alumni = [];
  for (const data of alumniData) {
    const record = await prisma.alumni.upsert({
      where: { studentId: data.studentId },
      update: data,
      create: data,
    });
    alumni.push(record);
  }
  console.log(`  Upserted ${alumni.length} alumni records\n`);

  // ── 3. Upsert awards ──
  console.log("Upserting awards...");

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
      studentId: alumni[alumniIdx].studentId,
      awardName: awardNames[i % awardNames.length],
      awardType: awardTypes[i % awardTypes.length],
      year,
      description: awardDescriptions[i % awardDescriptions.length],
    });
  }

  const awards = [];
  for (const data of awardData) {
    const record = await prisma.award.upsert({
      where: {
        studentId_awardName_year: {
          studentId: data.studentId,
          awardName: data.awardName,
          year: data.year,
        },
      },
      update: data,
      create: data,
    });
    awards.push(record);
  }
  console.log(`  Upserted ${awards.length} award records\n`);

  // ── 4. Upsert associations ──
  console.log("Upserting associations...");

  const associationSeedData = [
    { studentId: alumni[0].studentId, fullName: "สมชาย สุขใจ", associationName: "สมาคมศิษย์เก่าคณะพยาบาลศาสตร์ มช.", position: "ประธาน", recordedYear: 2568 },
    { studentId: alumni[1].studentId, fullName: "สมหญิง บุญมี", associationName: "สมาคมศิษย์เก่าคณะพยาบาลศาสตร์ มช.", position: "รองประธาน", recordedYear: 2568 },
    { studentId: alumni[2].studentId, fullName: "วิชัย ศรีสวัสดิ์", associationName: "สมาคมศิษย์เก่าคณะพยาบาลศาสตร์ มช.", position: "เลขานุการ", recordedYear: 2568 },
    { studentId: alumni[3].studentId, fullName: "นภา วงศ์สวัสดิ์", associationName: "ชมรมพยาบาลภาคเหนือ", position: "ประธาน", recordedYear: 2569 },
    { studentId: alumni[4].studentId, fullName: "พรรณี แก้วมณี", associationName: "ชมรมพยาบาลภาคเหนือ", position: "รองประธาน", recordedYear: 2569 },
    { studentId: alumni[5].studentId, fullName: "ธนา ธนาพร", associationName: "ชมรมพยาบาลภาคเหนือ", position: "กรรมการ", recordedYear: 2569 },
    { studentId: alumni[6].studentId, fullName: "ประภาส รัตนชัย", associationName: "สมาคมพยาบาลแห่งประเทศไทย", position: "ประธาน", recordedYear: 2567 },
    { studentId: alumni[7].studentId, fullName: "จิตรา พงษ์ประเสริฐ", associationName: "สมาคมพยาบาลแห่งประเทศไทย", position: "ที่ปรึกษา", recordedYear: 2567 },
    { studentId: alumni[8].studentId, fullName: "สุภาพ สิทธิโชค", associationName: "สมาคมศิษย์เก่าคณะพยาบาลศาสตร์ มช.", position: "กรรมการ", recordedYear: 2569 },
    { studentId: alumni[9].studentId, fullName: "วันดี เจริญสุข", associationName: "ชมรมพยาบาลภาคเหนือ", position: "เลขานุการ", recordedYear: 2568 },
    { studentId: alumni[10].studentId, fullName: "อรุณ วิเชียรเจริญ", associationName: "สมาคมพยาบาลแห่งประเทศไทย", position: "กรรมการ", recordedYear: 2568 },
    { studentId: alumni[11].studentId, fullName: "ปิยะ สมบูรณ์", associationName: "สมาคมศิษย์เก่าคณะพยาบาลศาสตร์ มช.", position: "ที่ปรึกษา", recordedYear: 2567 },
  ];

  const associations = [];
  for (const data of associationSeedData) {
    const record = await prisma.association.upsert({
      where: {
        studentId_associationName_position_recordedYear: {
          studentId: data.studentId,
          associationName: data.associationName,
          position: data.position,
          recordedYear: data.recordedYear,
        },
      },
      update: data,
      create: data,
    });
    associations.push(record);
  }
  console.log(`  Upserted ${associations.length} association records\n`);

  // ── 5. Upsert graduate committee members ──
  console.log("Upserting graduate committee members...");

  const committeeData = [
    { termYear: 2568, studentId: alumni[0].studentId, fullName: "สมชาย สุขใจ", cohort: "1", position: "ประธานกรรมการ", remarks: null },
    { termYear: 2568, studentId: alumni[1].studentId, fullName: "สมหญิง บุญมี", cohort: "1", position: "กรรมการ", remarks: null },
    { termYear: 2568, studentId: alumni[2].studentId, fullName: "วิชัย ศรีสวัสดิ์", cohort: "2", position: "เลขานุการกรรมการ", remarks: null },
    { termYear: 2569, studentId: alumni[3].studentId, fullName: "นภา วงศ์สวัสดิ์", cohort: "2", position: "ที่ปรึกษา", remarks: null },
    { termYear: 2569, studentId: alumni[4].studentId, fullName: "พรรณี แก้วมณี", cohort: "3", position: "ประธานกรรมการ", remarks: null },
    { termYear: 2569, studentId: alumni[5].studentId, fullName: "ธนา ธนาพร", cohort: "3", position: "กรรมการ", remarks: "ด้านวิชาการ" },
    { termYear: 2567, studentId: alumni[6].studentId, fullName: "ประภาส รัตนชัย", cohort: "4", position: "กรรมการ", remarks: null },
    { termYear: 2567, studentId: alumni[7].studentId, fullName: "จิตรา พงษ์ประเสริฐ", cohort: "4", position: "เลขานุการกรรมการ", remarks: null },
    { termYear: 2567, studentId: alumni[8].studentId, fullName: "สุภาพ สิทธิโชค", cohort: "5", position: "ประธานกรรมการ", remarks: null },
    { termYear: 2568, studentId: alumni[9].studentId, fullName: "วันดี เจริญสุข", cohort: "5", position: "ที่ปรึกษา", remarks: null },
    { termYear: 2568, studentId: alumni[10].studentId, fullName: "อรุณ วิเชียรเจริญ", cohort: "6", position: "กรรมการ", remarks: null },
    { termYear: 2569, studentId: alumni[11].studentId, fullName: "ปิยะ สมบูรณ์", cohort: "6", position: "กรรมการ", remarks: null },
    { termYear: 2569, studentId: alumni[12].studentId, fullName: "มนัส กิจเจริญ", cohort: "7", position: "ประธานกรรมการ", remarks: null },
    { termYear: 2568, studentId: alumni[13].studentId, fullName: "กานดา ภูมิพัฒน์", cohort: "7", position: "เลขานุการกรรมการ", remarks: null },
    { termYear: 2567, studentId: alumni[14].studentId, fullName: "ธีรพงษ์ มณีรัตน์", cohort: "8", position: "ที่ปรึกษา", remarks: "ด้านบริหาร" },
  ];

  const committees = [];
  for (const data of committeeData) {
    const record = await prisma.graduateCommittee.upsert({
      where: {
        studentId_termYear_position: {
          studentId: data.studentId,
          termYear: data.termYear,
          position: data.position,
        },
      },
      update: data,
      create: data,
    });
    committees.push(record);
  }
  console.log(`  Upserted ${committees.length} graduate committee records\n`);

  // ── 6. Upsert news articles ──
  console.log("Upserting news articles...");

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
    const data = {
      title: article.title,
      body: article.body,
      coverImageUrl: null,
      status: article.status,
      publishedAt: article.publishedAt,
    };
    const record = await prisma.news.upsert({
      where: { title: article.title },
      update: data,
      create: data,
    });
    newsRecords.push(record);
  }
  console.log(`  Upserted ${newsRecords.length} news articles\n`);

  // ── 7. Upsert potentials ──
  console.log("Upserting potentials...");

  const potentialData = [
    { studentId: alumni[0].studentId, fullName: "สมชาย สุขใจ", career: "พยาบาลวิชาชีพ", position: "ผู้จัดการแผนกผู้ป่วยใน", recordedYear: 2568 },
    { studentId: alumni[1].studentId, fullName: "สมหญิง บุญมี", career: "อาจารย์พยาบาล", position: "รองศาสตราจารย์", recordedYear: 2568 },
    { studentId: alumni[2].studentId, fullName: "วิชัย ศรีสวัสดิ์", career: "ผู้บริหารโรงพยาบาล", position: "ผู้อำนวยการโรงพยาบาล", recordedYear: 2568 },
    { studentId: alumni[3].studentId, fullName: "นภา วงศ์สวัสดิ์", career: "นักวิจัยทางการพยาบาล", position: "หัวหน้าทีมวิจัย", recordedYear: 2569 },
    { studentId: alumni[4].studentId, fullName: "พรรณี แก้วมณี", career: "พยาบาลผู้ป่วยวิกฤต", position: "พยาบาลวิชาชีพชำนาญการพิเศษ", recordedYear: 2569 },
    { studentId: alumni[5].studentId, fullName: "ธนา ธนาพร", career: "ที่ปรึกษาด้านสาธารณสุข", position: "ที่ปรึกษาองค์การอนามัยโลก", recordedYear: 2569 },
    { studentId: alumni[6].studentId, fullName: "ประภาส รัตนชัย", career: "พยาบาลสูติกรรม", position: "หัวหน้าหอผู้ป่วย", recordedYear: 2567 },
    { studentId: alumni[7].studentId, fullName: "จิตรา พงษ์ประเสริฐ", career: "นักวิชาการสาธารณสุข", position: "ผู้เชี่ยวชาญด้านนโยบายสาธารณสุข", recordedYear: 2567 },
    { studentId: alumni[8].studentId, fullName: "สุภาพ สิทธิโชค", career: "พยาบาลจิตเวช", position: "พยาบาลวิชาชีพชำนาญการ", recordedYear: 2567 },
    { studentId: alumni[9].studentId, fullName: "วันดี เจริญสุข", career: "ผู้จัดการโครงการสุขภาพ", position: "ผู้จัดการโครงการ", recordedYear: 2568 },
    { studentId: alumni[10].studentId, fullName: "อรุณ วิเชียรเจริญ", career: "อาจารย์คลินิก", position: "อาจารย์ ระดับ 9", recordedYear: 2569 },
    { studentId: alumni[11].studentId, fullName: "ปิยะ สมบูรณ์", career: "พยาบาลเด็กแรกเกิด", position: "พยาบาลวิชาชีพชำนาญการพิเศษ", recordedYear: 2569 },
    { studentId: alumni[12].studentId, fullName: "มนัส กิจเจริญ", career: "ผู้บริหารการพยาบาล", position: "ผู้อำนวยการกองการพยาบาล", recordedYear: 2568 },
    { studentId: alumni[13].studentId, fullName: "กานดา ภูมิพัฒน์", career: "นักวิจัยด้านมะเร็งวิทยา", position: "นักวิจัยหลังปริญญาเอก", recordedYear: 2567 },
    { studentId: alumni[14].studentId, fullName: "ธีรพงษ์ มณีรัตน์", career: "พยาบาลชุมชน", position: "หัวหน้าสถานีอนามัย", recordedYear: 2568 },
  ];

  const potentials = [];
  for (const data of potentialData) {
    const record = await prisma.potential.upsert({
      where: {
        studentId_recordedYear: {
          studentId: data.studentId,
          recordedYear: data.recordedYear,
        },
      },
      update: data,
      create: data,
    });
    potentials.push(record);
  }
  console.log(`  Upserted ${potentials.length} potential records\n`);

  // ── 8. Upsert abroad alumni (scraped from reference site) ──
  console.log("Upserting abroad alumni...");

  const abroadAlumniData = [
    // USA alumni (1-45)
    { studentId: "", name: "สุดฤทัย ศรีกำพล", address: "14300 Terra Bella #29 Panorama City CA.91402", country: "สหรัฐอเมริกา", university: null, order: 1 },
    { studentId: "", name: "Vachareeratang Sererut", address: "5545 N.California Chicago IL.60625", country: "สหรัฐอเมริกา", university: null, order: 2 },
    { studentId: "", name: "กาญจนา แต่งสอน", address: "81-60 247 th St.Bellerose, N.Y. 11426", country: "สหรัฐอเมริกา", university: null, order: 3 },
    { studentId: "", name: "วไลลักษณ์ ภัณธนเกษม", address: "373 ถ.วานิช 1 ต.จักรวรรดิ สัมพันธวงศ์ กทม. 10100", country: "สหรัฐอเมริกา", university: null, order: 4 },
    { studentId: "", name: "อรพรรณ พันธาภิรัตน์", address: "624 LongHilll RN River Valr N.S. 07672", country: "สหรัฐอเมริกา", university: null, order: 5 },
    { studentId: "", name: "Thida Petchor", address: "965 Ramsden Run, Alpharetta, CA. 30022-4702", country: "สหรัฐอเมริกา", university: null, order: 6 },
    { studentId: "", name: "พิศมัย ตันพัฒนาเจริญ", address: "500 Ackly St.Monterey Park CA. 91755 USA.", country: "สหรัฐอเมริกา", university: null, order: 7 },
    { studentId: "", name: "Orapin Chullasavock", address: "4035 N.Sawyer Chicago Illinois 60618", country: "สหรัฐอเมริกา", university: null, order: 8 },
    { studentId: "", name: "จินตนา ไกรลาศ (กูรมะโรหิต)", address: "1461 LA Lome Drive, Santa ANA, CA. 92705", country: "สหรัฐอเมริกา", university: null, order: 9 },
    { studentId: "", name: "ฉวีวรรณ สีละวิทย์", address: "3308, W. 189 th St.Torrance, CA. 90504", country: "สหรัฐอเมริกา", university: null, order: 10 },
    { studentId: "", name: "กัลยาณี นาคประดิษฐ์ (เนตรอัคคี)", address: "33-12 86 Street Jackson Heights, N.Y. 11372-1536", country: "สหรัฐอเมริกา", university: null, order: 11 },
    { studentId: "", name: "Pimpaka Suriyong", address: "4035 N.Sawyer Chicago IL. 60618", country: "สหรัฐอเมริกา", university: null, order: 12 },
    { studentId: "", name: "ผกาวรรณ อุณหะสูต", address: "711 Prospect Ave Mamaroneck N.Y. 10543", country: "สหรัฐอเมริกา", university: null, order: 13 },
    { studentId: "", name: "พวงทรัพย์ เปรื่องการ สูณัฐตระกูล", address: "7338 Wolfreen Trail Fairview Heights, IL. 62208", country: "สหรัฐอเมริกา", university: null, order: 14 },
    { studentId: "", name: "ประจง (วิญิบุตร) พิทยาธิคุณ", address: "705 Campbell Drive Sparta IL.62286", country: "สหรัฐอเมริกา", university: null, order: 15 },
    { studentId: "", name: "ลดารัตน์ (เกียรติพลพจน์) ตั้งชีวินศิริกุล", address: "7346 Wolfreen Trail, Fairview Heights, IL.62208.", country: "สหรัฐอเมริกา", university: null, order: 16 },
    { studentId: "", name: "เจือจันทร์ จัยสิน", address: "1165 Cruknit Lane Coring CA.92880", country: "สหรัฐอเมริกา", university: null, order: 17 },
    { studentId: "", name: "เครือวัลย์ ศรีวภา (Kruewan Srivapa)", address: "1 EI Vaquero, Rnch Snta Margar, CA 92688", country: "สหรัฐอเมริกา", university: null, order: 18 },
    { studentId: "", name: "จำนง นิ่มตระกูล (C. Nimtragool)", address: "13130 Caravel St., Cerritos, CA 90703", country: "สหรัฐอเมริกา", university: null, order: 19 },
    { studentId: "", name: "ชวนพิศ (เกิดเนียม) สังขกิจกรณีย์ (C.Sungkakitkoranee)", address: "5896 Sycamore Ave., Rialto, CA 92377-3910", country: "สหรัฐอเมริกา", university: null, order: 20 },
    { studentId: "", name: "ทัสนีย์ (ธนานุรักษ์) (Thasani Chandra)", address: "1168 Barbara Dr., Cherry Hill, NJ. 08003", country: "สหรัฐอเมริกา", university: null, order: 21 },
    { studentId: "", name: "พัฒนา บุญมี (P.Boonmee)", address: "19625 Sabrina Ct. Cerritos, CA 90701", country: "สหรัฐอเมริกา", university: null, order: 22 },
    { studentId: "", name: "เพ็ญศรี (กุยยกานนท์) อติภัทธะ (Pensri Athipatha)", address: "7852 West Park Ave., Niles, IL 60714", country: "สหรัฐอเมริกา", university: null, order: 23 },
    { studentId: "", name: "วรรธนา (การุณยุญญานันท์) ชุณห์ถนอม (Wadhana Choontanom)", address: "1825 Jacaranda Place, Fullerton, CA 92833", country: "สหรัฐอเมริกา", university: null, order: 24 },
    { studentId: "", name: "วัลลภา (ศุภศิริรัตน์) รักสกุลไทย (V.Rukskulthai)", address: "201 Williams, Fredericktown, MO 63645", country: "สหรัฐอเมริกา", university: null, order: 25 },
    { studentId: "", name: "สมสุข (เครือวรรณ) สาระชัย (S.K. Sarachai)", address: "3318 76th St., Flushing, NY. 11372-1152", country: "สหรัฐอเมริกา", university: null, order: 26 },
    { studentId: "", name: "เสาวนีย์ (สุทธพินธุ) จุฬามรกต (S.Chulamorakodt)", address: "R.R. #3 Box 94, Vandalia, IL 62471 E-mail: Chulamorkodt@yahoo.com.", country: "สหรัฐอเมริกา", university: null, order: 27 },
    { studentId: "", name: "โสมนัส (ไชยเพ็ชร) เสริมชีพ (S.Sermchief)", address: "1222 Stonewolf Tr., Fairveiw Height, IL. 62208", country: "สหรัฐอเมริกา", university: null, order: 28 },
    { studentId: "", name: "อารียา (จินตธรรม) Adams", address: "8634 Forsythe St., Sunland, CA 91041", country: "สหรัฐอเมริกา", university: null, order: 29 },
    { studentId: "", name: "พริ้มเพรา สุชาตานนท์ (P. SUTATANOND)", address: "1209 E. CLARK TRAIL HERRIN IL 62948 U.S.A. H: 618-942-2807", country: "สหรัฐอเมริกา", university: null, order: 30 },
    { studentId: "", name: "ประคองศรี ศักดิ์ศรี (P. SAKDISRI)", address: "121 CRESTMOOR St COLLINSVILLE IL 62234 U.S.A. H: 618-346-2549 C: 618-210-7679", country: "สหรัฐอเมริกา", university: null, order: 31 },
    { studentId: "", name: "พวงทรัพย์ สุณัฐตระกูล (P. SOONATTRAKUL)", address: "7338 WOLF RUN TRAIL FAIRVIEW HEIGHTS IL 62208 U.S.A. H: 618-628-7262 C: 573-888-2128", country: "สหรัฐอเมริกา", university: null, order: 32 },
    { studentId: "", name: "พิจิตร พฤติธรรม (P. PHRUTTITUM)", address: "3 FLAG STICK COURT St. LOUIS MO 63127 U.S.A. H: 641-228-6084 C: 641-330-5736", country: "สหรัฐอเมริกา", university: null, order: 33 },
    { studentId: "", name: "ละเอียด ฉัตรคุปต์", address: "1213 JILL LANE EXELSIOR SPRING, MO 64024 U.S.A. H: 816-630-5269 C: 816-686-5069", country: "สหรัฐอเมริกา", university: null, order: 34 },
    { studentId: "", name: "ลิบดา ติวรศักดิ์ (L. TIVORSAK)", address: "1716 COUNTRY LANE AT CHINSON KA 66002 U.S.A. H: 913-367-0089", country: "สหรัฐอเมริกา", university: null, order: 35 },
    { studentId: "", name: "อัมพร ศุภวนิช (A. SUPAWANICH)", address: "9841 CANNON GATE PKWY VILLA RICA, GA 30180 U.S.A. H: 770-456-0666 C: 678-371-8006", country: "สหรัฐอเมริกา", university: null, order: 36 },
    { studentId: "", name: "แสงดาว ตุลยเสถียร (S. TULYASATHIEN)", address: "4306 156Th AVE NE APT PP 147 REDMOND, WA 98052 U.S.A. C: 425-885-2636", country: "สหรัฐอเมริกา", university: null, order: 37 },
    { studentId: "", name: "จุไร ไกรสร (J. KRAISORN)", address: "1104 S. CALIFORNIA AVE W. COVINA, CA 91790 U.S.A. H: 626-960-7134 C: 626-806-2133", country: "สหรัฐอเมริกา", university: null, order: 38 },
    { studentId: "", name: "จิตราภรณ์ Kanares", address: "840 E LIVE OAK St. APT. B GABRIEL, CA 91776 U.S.A. 626-291-2594", country: "สหรัฐอเมริกา", university: null, order: 39 },
    { studentId: "", name: "พรรณี CLARK", address: "2175 DE COTO APT # 192 UNION CITY CA 94587 U.S.A.", country: "สหรัฐอเมริกา", university: null, order: 40 },
    { studentId: "", name: "ขวัญใจ Narangajavana (K. NARANGAJAVANA)", address: "2804 A WELSH ROAD PHILADELPHIA. PA 19152 U.S.A. 215-969-4872", country: "สหรัฐอเมริกา", university: null, order: 41 },
    { studentId: "", name: "สุทธิลักษณ์ BRENT", address: "6441 lock LOCK LOMMOND DR. KEYSTONE HEIGHTS FL 32656 U.S.A. H: 352-473-2350", country: "สหรัฐอเมริกา", university: null, order: 42 },
    { studentId: "", name: "ปานจิต ฮันตระกูล (P. HUNTRAKUL)", address: "1501 METROPOLITAN AVE #8 D BRONX, NY 10462 U.S.A. 718-863-0800", country: "สหรัฐอเมริกา", university: null, order: 43 },
    { studentId: "", name: "ศุภนิตย์ Sethakorn", address: "541 Meadow Dr. Gibson city, IL 60931 U.S.A. H. 217-784-4104", country: "สหรัฐอเมริกา", university: null, order: 44 },
    { studentId: "", name: "เกสร จันทร์ประภาพ", address: "S. 308 Birnam Trail Willow Brook, IL 60527 U.S.A. / 6 ถ. สันติรักษ์ ต. ช้างเผือก อ. เมือง จ. เชียงใหม่ 50300 H: 053-219-831", country: "สหรัฐอเมริกา", university: null, order: 45 },
    // Central South University Xiang-Ya School of Nursing — Changsha, Hunan
    { studentId: "", name: "Prof. He Guoping (Dean)", address: "Xiangya School of Nursing, 172 Tongzipo Rd, Changsha, Hunan 410013", country: "ประเทศจีน", university: "Central South University Xiang-Ya School of Nursing", order: 1 },
    { studentId: "", name: "Cai Yimin [G 5]", address: "Xiangya School of Nursing, 172 Tongzipo Rd, Changsha, Hunan 410013", country: "ประเทศจีน", university: "Central South University Xiang-Ya School of Nursing", order: 2 },
    { studentId: "", name: "Huang Jin [G 1]", address: "Xiangya School of Nursing, 172 Tongzipo Rd, Changsha, Hunan 410013", country: "ประเทศจีน", university: "Central South University Xiang-Ya School of Nursing", order: 3 },
    { studentId: "", name: "Li Lezhi [G 2]", address: "Xiangya School of Nursing, 172 Tongzipo Rd, Changsha, Hunan 410013", country: "ประเทศจีน", university: "Central South University Xiang-Ya School of Nursing", order: 4 },
    { studentId: "", name: "Wang Honghong [G 1]", address: "Xiangya School of Nursing, 172 Tongzipo Rd, Changsha, Hunan 410013", country: "ประเทศจีน", university: "Central South University Xiang-Ya School of Nursing", order: 5 },
    { studentId: "", name: "Yan Jin [G 2]", address: "Xiangya School of Nursing, 172 Tongzipo Rd, Changsha, Hunan 410013", country: "ประเทศจีน", university: "Central South University Xiang-Ya School of Nursing", order: 6 },
    { studentId: "", name: "Zeng Hui [G 5]", address: "Xiangya School of Nursing, 172 Tongzipo Rd, Changsha, Hunan 410013", country: "ประเทศจีน", university: "Central South University Xiang-Ya School of Nursing", order: 7 },
    { studentId: "", name: "Zhang Jingping [G 3]", address: "Xiangya School of Nursing, 172 Tongzipo Rd, Changsha, Hunan 410013", country: "ประเทศจีน", university: "Central South University Xiang-Ya School of Nursing", order: 8 },
    // China Medical University — Shenyang, Liaoning
    { studentId: "", name: "Prof. Qiao Min (Dean)", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 1 },
    { studentId: "", name: "Prof. Yu Yan Gin (Director of Nursing College)", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 2 },
    { studentId: "", name: "Cao Ying [G 3]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 3 },
    { studentId: "", name: "Fan Ling [G 5]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 4 },
    { studentId: "", name: "Guo Hong [G 4]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 5 },
    { studentId: "", name: "Li Xiaohan [G 1]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 6 },
    { studentId: "", name: "Sun Tianjie [G 5]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 7 },
    { studentId: "", name: "Wang Jian [G 1]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 8 },
    { studentId: "", name: "Zhang Bo [G 4]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 9 },
    { studentId: "", name: "Zhang Xiuyue [G 4]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 10 },
    { studentId: "", name: "Zhao Haping [G 2]", address: "School of Nursing, 77 Puhe Rd, Shenbei New Area, Shenyang, Liaoning 110122", country: "ประเทศจีน", university: "China Medical University", order: 11 },
    // Fudan University — Shanghai
    { studentId: "", name: "Dr. Jai Hongli (Dean)", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 1 },
    { studentId: "", name: "Prof. Dai Baozhen (Former Dean)", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 2 },
    { studentId: "", name: "Prof. Yang Yinghua (Former Dean)", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 3 },
    { studentId: "", name: "Cheng Yun [G 3]", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 4 },
    { studentId: "", name: "Hu Yan [G 1]", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 5 },
    { studentId: "", name: "Li Xiaoying [G 4]", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 6 },
    { studentId: "", name: "Shao Wenli [G 1]", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 7 },
    { studentId: "", name: "Xi Shuxin [G 4]", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 8 },
    { studentId: "", name: "Xia Haiou [G 4]", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 9 },
    { studentId: "", name: "Xu Hong [G 3]", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 10 },
    { studentId: "", name: "Yan Meiqiong [G 2]", address: "School of Nursing, 138 Yixueyuan Rd, Xuhui District, Shanghai 200032", country: "ประเทศจีน", university: "Fudan University", order: 11 },
    // Peking Union Medical College — Beijing
    { studentId: "", name: "Dr. Huaping Liu (Dean)", address: "School of Nursing, 9 Dongdan 3rd Alley, Dongcheng District, Beijing 100730", country: "ประเทศจีน", university: "Peking Union Medical College", order: 1 },
    { studentId: "", name: "Chen Jingli [G 2]", address: "School of Nursing, 9 Dongdan 3rd Alley, Dongcheng District, Beijing 100730", country: "ประเทศจีน", university: "Peking Union Medical College", order: 2 },
    { studentId: "", name: "Li Zheng [G 1]", address: "School of Nursing, 9 Dongdan 3rd Alley, Dongcheng District, Beijing 100730", country: "ประเทศจีน", university: "Peking Union Medical College", order: 3 },
    { studentId: "", name: "Liang Xiaokun [G 3]", address: "School of Nursing, 9 Dongdan 3rd Alley, Dongcheng District, Beijing 100730", country: "ประเทศจีน", university: "Peking Union Medical College", order: 4 },
    { studentId: "", name: "Liu Jianfen [G 2]", address: "School of Nursing, 9 Dongdan 3rd Alley, Dongcheng District, Beijing 100730", country: "ประเทศจีน", university: "Peking Union Medical College", order: 5 },
    { studentId: "", name: "Sheng Yu [G 5]", address: "School of Nursing, 9 Dongdan 3rd Alley, Dongcheng District, Beijing 100730", country: "ประเทศจีน", university: "Peking Union Medical College", order: 6 },
    { studentId: "", name: "Zhao Yan [G 4]", address: "School of Nursing, 9 Dongdan 3rd Alley, Dongcheng District, Beijing 100730", country: "ประเทศจีน", university: "Peking Union Medical College", order: 7 },
    // Peking University Health Science Center — Beijing
    { studentId: "", name: "Prof. Zheng Xiuxia (Dean)", address: "School of Nursing, 38 Xueyuan Rd, Haidian District, Beijing 100191", country: "ประเทศจีน", university: "Peking University Health Science Center", order: 1 },
    { studentId: "", name: "Prof. Yao Jingpeng (Former Dean)", address: "School of Nursing, 38 Xueyuan Rd, Haidian District, Beijing 100191", country: "ประเทศจีน", university: "Peking University Health Science Center", order: 2 },
    { studentId: "", name: "Liu Jun-e [G 3]", address: "School of Nursing, 38 Xueyuan Rd, Haidian District, Beijing 100191", country: "ประเทศจีน", university: "Peking University Health Science Center", order: 3 },
    { studentId: "", name: "Liu Yu [G 4]", address: "School of Nursing, 38 Xueyuan Rd, Haidian District, Beijing 100191", country: "ประเทศจีน", university: "Peking University Health Science Center", order: 4 },
    { studentId: "", name: "Wang Chenguang [G 5]", address: "School of Nursing, 38 Xueyuan Rd, Haidian District, Beijing 100191", country: "ประเทศจีน", university: "Peking University Health Science Center", order: 5 },
    { studentId: "", name: "Wang Qun [G 3]", address: "School of Nursing, 38 Xueyuan Rd, Haidian District, Beijing 100191", country: "ประเทศจีน", university: "Peking University Health Science Center", order: 6 },
    { studentId: "", name: "Zhang Haiyan [G 2]", address: "School of Nursing, 38 Xueyuan Rd, Haidian District, Beijing 100191", country: "ประเทศจีน", university: "Peking University Health Science Center", order: 7 },
    // Sichuan University — Chengdu, Sichuan
    { studentId: "", name: "Prof. Jiang Xiaolian (Dean)", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 1 },
    { studentId: "", name: "Prof. Yin Kei (Former Dean)", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 2 },
    { studentId: "", name: "Feng Xiangqiong [G 5]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 3 },
    { studentId: "", name: "Li Xiao lin [G 3]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 4 },
    { studentId: "", name: "Li Xiaoling [G 1]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 5 },
    { studentId: "", name: "Liu Suzhen [G 3]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 6 },
    { studentId: "", name: "Song Jingping [G 5]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 7 },
    { studentId: "", name: "Wang Shiping [G 1]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 8 },
    { studentId: "", name: "Wang Yuqiong [G 2]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 9 },
    { studentId: "", name: "Zhao Xiufang [G 4]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 10 },
    { studentId: "", name: "Zhu Mingxia [G 2]", address: "West China School of Nursing, 37 Guoxue Rd, Wuhou District, Chengdu, Sichuan 610041", country: "ประเทศจีน", university: "Sichuan University", order: 11 },
    // Sun Yat-Sen University, Guangzhou — Guangdong
    { studentId: "", name: "Assoc.Prof. You Liming (Dean)", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 1 },
    { studentId: "", name: "Chen Xhi Qun [G 4]", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 2 },
    { studentId: "", name: "Gao Lingling [G 5]", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 3 },
    { studentId: "", name: "Liu Ke [G 3]", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 4 },
    { studentId: "", name: "Lin Xiyin [G 1]", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 5 },
    { studentId: "", name: "Luo Xhimin [G 3]", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 6 },
    { studentId: "", name: "Yan Jun [G 4]", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 7 },
    { studentId: "", name: "Zeng Wen [G 1]", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 8 },
    { studentId: "", name: "Zhang Meifen [G 2]", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 9 },
    { studentId: "", name: "Zhu Yanli", address: "School of Nursing, 74 Zhongshan 2nd Rd, Yuexiu District, Guangzhou, Guangdong 510080", country: "ประเทศจีน", university: "Sun Yat-Sen University, Guangzhou", order: 10 },
    // Xi'an Jiaotong University — Xi'an, Shaanxi
    { studentId: "", name: "Prof. Zheng Nanning (President)", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 1 },
    { studentId: "", name: "Prof. Ren Huimin", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 2 },
    { studentId: "", name: "Dr. Yan Jianqun", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 3 },
    { studentId: "", name: "Dr. Yan Hong", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 4 },
    { studentId: "", name: "Dr. Li Wei", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 5 },
    { studentId: "", name: "Dr. Zhu Hongliang", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 6 },
    { studentId: "", name: "Assoc.Prof. Li Xiaomei (Dean) [G 1]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 7 },
    { studentId: "", name: "Gao Rui [G 4]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 8 },
    { studentId: "", name: "Gu Wei [G 3]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 9 },
    { studentId: "", name: "Jiang Wenhui [G 2]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 10 },
    { studentId: "", name: "Li Jing [G 2]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 11 },
    { studentId: "", name: "Liu Ming [G 4]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 12 },
    { studentId: "", name: "Lu Aili [G 5]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 13 },
    { studentId: "", name: "Wang Wenru [G 1]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 14 },
    { studentId: "", name: "Wang Xiaoquin [G 5]", address: "School of Nursing, 28 Xianning West Rd, Beilin District, Xi'an, Shaanxi 710049", country: "ประเทศจีน", university: "Xi'an Jiaotong University", order: 15 },
  ];

  const abroadAlumni = [];
  for (let idx = 0; idx < abroadAlumniData.length; idx++) {
    const data = abroadAlumniData[idx];
    let studentId = data.studentId;
    if (!studentId) {
      studentId = `6043${String(idx + 1).padStart(4, "0")}`;
      const parsed = parseThaiName(data.name);
      await prisma.alumni.upsert({
        where: { studentId },
        update: {
          prefix: parsed.prefix,
          firstName: parsed.firstName,
          maidenLastName: parsed.maidenLastName,
          newLastName: parsed.newLastName,
          country: data.country,
          degreeLevel: randomDegreeLevel(),
        },
        create: {
          studentId,
          prefix: parsed.prefix,
          firstName: parsed.firstName,
          maidenLastName: parsed.maidenLastName,
          newLastName: parsed.newLastName,
          country: data.country,
          degreeLevel: randomDegreeLevel(),
        },
      });
    }
    // Build display name: prefix + firstName + (maidenLastName) + newLastName
    const displayParsed = parseThaiName(data.name);
    const displayName = displayParsed.newLastName
      ? `${displayParsed.prefix}${displayParsed.firstName} (${displayParsed.maidenLastName}) ${displayParsed.newLastName}`
      : `${displayParsed.prefix}${displayParsed.firstName} ${displayParsed.maidenLastName}`;
    const record = await prisma.abroadAlumni.upsert({
      where: {
        studentId_order: { studentId, order: data.order },
      },
      update: { ...data, studentId, name: displayName },
      create: { ...data, studentId, name: displayName },
    });
    abroadAlumni.push(record);
  }
  console.log(`  Upserted ${abroadAlumni.length} abroad alumni records\n`);

  // ── 9. Upsert model representatives (from reference site) ──
  console.log("Upserting model representatives...");

  const ASSIST = "รายชื่อเครือข่ายศิษย์เก่าผู้ช่วยพยาบาล";
  const MASTER = "รายชื่อเครือข่ายศิษย์เก่าปริญญาโท";
  const ASSOC = "รายชื่อเครือข่ายศิษย์เก่าอนุปริญญาพยาบาล";
  const BACHELOR = "รายชื่อเครือข่ายศิษย์เก่าปริญญาพยาบาล";
  const DOCTORAL = "รายชื่อเครือข่ายศิษย์เก่าปริญญาเอก";

  const modelRepData = [
    // ผู้ช่วยพยาบาล รุ่น 1–38
    { studentId: "", name: "คุณบุญชู   วรรณฤทธิ์", cohort: ASSIST, generation: 1 },
    { studentId: "", name: "คุณพีระพงษ์  สุทธโทธน", cohort: ASSIST, generation: 2 },
    { studentId: "", name: "คุณพิมพ์ทอง   วรรณฤทธิ์", cohort: ASSIST, generation: 3 },
    { studentId: "", name: "คุณนวลจันทร์  จันทรประเสริฐ", cohort: ASSIST, generation: 4 },
    { studentId: "", name: "คุณมาลินี   รุ่งตานนท์", cohort: ASSIST, generation: 5 },
    { studentId: "", name: "คุณสมเจตต์  ไตรวุฒิวัฒนา", cohort: ASSIST, generation: 6 },
    { studentId: "", name: "คุณเทียมนิล  ปินตาศรี", cohort: ASSIST, generation: 7 },
    { studentId: "", name: "คุณปทุมวรรณ  บูรณะศิริ", cohort: ASSIST, generation: 8 },
    { studentId: "", name: "คุณนิเวศน์  คันธรส", cohort: ASSIST, generation: 9 },
    { studentId: "", name: "คุณอารีย์  สิทธิน้อย", cohort: ASSIST, generation: 10 },
    { studentId: "", name: "คุณสายทอง  พิจการ", cohort: ASSIST, generation: 11 },
    { studentId: "", name: "คุณสุมาลี  สุขศรี", cohort: ASSIST, generation: 12 },
    { studentId: "", name: "คุณกนกพัชร์  สุวรรณภัค", cohort: ASSIST, generation: 13 },
    { studentId: "", name: "คุณพงษ์พันธ์  รัตนะ", cohort: ASSIST, generation: 14 },
    { studentId: "", name: "คุณสมบูรณ์  วิศร", cohort: ASSIST, generation: 15 },
    { studentId: "", name: "คุณเรืองรอง  โสภา", cohort: ASSIST, generation: 16 },
    { studentId: "", name: "คุณนงพงา  บุญสูง", cohort: ASSIST, generation: 17 },
    { studentId: "", name: "คุณถนอม   ยอดยา", cohort: ASSIST, generation: 18 },
    { studentId: "", name: "คุณธีรารัตน์   ธีระอัครพงษ์", cohort: ASSIST, generation: 19 },
    { studentId: "", name: "คุณปราณี  สินธพอาชากุล", cohort: ASSIST, generation: 20 },
    { studentId: "", name: "คุณวรดิษฐ์   คุณยศยิ่ง", cohort: ASSIST, generation: 21 },
    { studentId: "", name: "คุณกนกพร   สุมนต์ศาสตร์", cohort: ASSIST, generation: 22 },
    { studentId: "", name: "คุณเสกสรร   จิตสุทธิ", cohort: ASSIST, generation: 23 },
    { studentId: "", name: "คุณแน่งน้อย   ทองทา", cohort: ASSIST, generation: 24 },
    { studentId: "", name: "คุณขวัญใจ   แดงสด", cohort: ASSIST, generation: 25 },
    { studentId: "", name: "คุณวาริกา   นาวารี", cohort: ASSIST, generation: 26 },
    { studentId: "", name: "คุณอิงอร  งามศรี", cohort: ASSIST, generation: 27 },
    { studentId: "", name: "คุณพรรณา  รอบรู้", cohort: ASSIST, generation: 28 },
    { studentId: "", name: "คุณอุดร  ศรีประดิษฐ์", cohort: ASSIST, generation: 29 },
    { studentId: "", name: "คุณดวงใจ  อนุขุน", cohort: ASSIST, generation: 30 },
    { studentId: "", name: "คุณนงคราญ  อินถาเขียว", cohort: ASSIST, generation: 31 },
    { studentId: "", name: "คุณประภาส  รัตนพงษ์พิทักษ์", cohort: ASSIST, generation: 32 },
    { studentId: "", name: "คุณทักษิน  ดีออน", cohort: ASSIST, generation: 33 },
    { studentId: "", name: "คุณอรพินธ์   ใจโต", cohort: ASSIST, generation: 34 },
    { studentId: "", name: "คุณชูวงษ์   ตันธรัตน์", cohort: ASSIST, generation: 35 },
    { studentId: "", name: "คุณประทุมพร  ขันแก้ว", cohort: ASSIST, generation: 36 },
    { studentId: "", name: "คุณเดือนวรางค์   อินทวิชัย", cohort: ASSIST, generation: 37 },
    { studentId: "", name: "คุณสหภณ   ดีสอน", cohort: ASSIST, generation: 38 },
    // ปริญญาโท รุ่น 1–21
    { studentId: "", name: "อ.จันทร์ฉาย  หวันแก้ว", cohort: MASTER, generation: 1 },
    { studentId: "", name: "คุณศิริลักษณ์  กิจศรีไพศาล", cohort: MASTER, generation: 2 },
    { studentId: "", name: "ผศ.ดร.ฐิติณัฎฐ์  อัคคะเดชอนันต์", cohort: MASTER, generation: 3 },
    { studentId: "", name: "คุณวิภา  เอี่ยมสำอางค์", cohort: MASTER, generation: 4 },
    { studentId: "", name: "คุณสุพิณ  ชัยรัตนภิวงศ์", cohort: MASTER, generation: 5 },
    { studentId: "", name: "รศ.ดร.ยุพิน  เพียงมงคล", cohort: MASTER, generation: 6 },
    { studentId: "", name: "คุณมาลินี  วัฒนากูล", cohort: MASTER, generation: 7 },
    { studentId: "", name: "คุณพวงเพชร  ยัพวัฒนพันธ์", cohort: MASTER, generation: 8 },
    { studentId: "", name: "อ.ดร.นงเยาว์   เกษตร์ภิบาล", cohort: MASTER, generation: 9 },
    { studentId: "", name: "อ.สมใจ  ศิระกมล", cohort: MASTER, generation: 10 },
    { studentId: "", name: "คุณศิริพร  พรพุทธษา", cohort: MASTER, generation: 11 },
    { studentId: "", name: "คุณจิตตวดี  เหรียญทอง", cohort: MASTER, generation: 12 },
    { studentId: "", name: "อ.ดร.สุดารัตน์  ชัยอาจ", cohort: MASTER, generation: 13 },
    { studentId: "", name: "คุณฉัตรชัย  ใหม่เขียว", cohort: MASTER, generation: 14 },
    { studentId: "", name: "คุณสุคนทา  คุณาพันธ์", cohort: MASTER, generation: 15 },
    { studentId: "", name: "คุณศักรินทร์   สุวรรณเวหา", cohort: MASTER, generation: 16 },
    { studentId: "", name: "คุณกัลยาณี  ตันตรานนท์", cohort: MASTER, generation: 17 },
    { studentId: "", name: "คุณขวัญหทัย  กัณทะโรจน์", cohort: MASTER, generation: 18 },
    { studentId: "", name: "คุณธนพัฒน์  ชัยป้อ", cohort: MASTER, generation: 19 },
    { studentId: "", name: "คุณบุญธิดา  เทือกสุบรรณ", cohort: MASTER, generation: 20 },
    { studentId: "", name: "คุณเยาวมาลย์   เหลืองอร่าม", cohort: MASTER, generation: 21 },
    // อนุปริญญาพยาบาล รุ่น 1–13
    { studentId: "", name: "รศ.นิลพรรณ   รัตนดิลกพานิชย์", cohort: ASSOC, generation: 1 },
    { studentId: "", name: "ผศ.วันเพ็ญ   เอี่ยมจ้อย", cohort: ASSOC, generation: 2 },
    { studentId: "", name: "คุณลัดดา  ธารนพ", cohort: ASSOC, generation: 3 },
    { studentId: "", name: "รศ.ศิริพร  สิงหเนตร", cohort: ASSOC, generation: 4 },
    { studentId: "", name: "รศ.มล.อัครอนงค์  ปราโมช", cohort: ASSOC, generation: 5 },
    { studentId: "", name: "คุณพรพิมล  จุลาสัย", cohort: ASSOC, generation: 6 },
    { studentId: "", name: "รศ.อุดมรัตน์   สงวนศิริธรรม", cohort: ASSOC, generation: 7 },
    { studentId: "", name: "คุณสมลักษณ์  บุญมา", cohort: ASSOC, generation: 8 },
    { studentId: "", name: "คุณประทิน  ไชยศรี", cohort: ASSOC, generation: 9 },
    { studentId: "", name: "คุณดรรชนี  ลิ้มสุคนธ์", cohort: ASSOC, generation: 10 },
    { studentId: "", name: "คุณปติลักษณ์   เยาวภาคย์โสภณ", cohort: ASSOC, generation: 11 },
    { studentId: "", name: "รศ.ดร.ดวงฤดี  ลาศุขะ", cohort: ASSOC, generation: 12 },
    { studentId: "", name: "คุณสุนทรี   เหลียวตระกูล", cohort: ASSOC, generation: 13 },
    // ปริญญาพยาบาล รุ่น 1–38
    { studentId: "", name: "รศ.กรรณิการ์  พงษ์สนิท", cohort: BACHELOR, generation: 1 },
    { studentId: "", name: "รศ.ดร.เรมวล  นันท์ศุภวัฒน์", cohort: BACHELOR, generation: 2 },
    { studentId: "", name: "รศ ดร.สุจิตรา  เหลืองอมรเลิศ", cohort: BACHELOR, generation: 3 },
    { studentId: "", name: "คุณกรองกาญจน์  จิรพรเจริญ", cohort: BACHELOR, generation: 4 },
    { studentId: "", name: "คุณวิไล    อุตวิชัย", cohort: BACHELOR, generation: 5 },
    { studentId: "", name: "คุณอาภรณ์   ชัยรัต", cohort: BACHELOR, generation: 6 },
    { studentId: "", name: "ผศ.วราภรณ์   เลิศพูนวิไลกุล", cohort: BACHELOR, generation: 7 },
    { studentId: "", name: "คุณผาณิต   สกุลวัฒนะ", cohort: BACHELOR, generation: 8 },
    { studentId: "", name: "คุณสิริลักษณ์  สลักคำ", cohort: BACHELOR, generation: 9 },
    { studentId: "", name: "ผศ.อำไพ   จารุวัชรพาณิชกุล", cohort: BACHELOR, generation: 10 },
    { studentId: "", name: "คุณเพชรา   หาญศิริวัฒนกิจ", cohort: BACHELOR, generation: 11 },
    { studentId: "", name: "รศ.ดร.ภารดี   นานาศิลป์", cohort: BACHELOR, generation: 12 },
    { studentId: "", name: "คุณชลอ   น้อยเผ่า", cohort: BACHELOR, generation: 13 },
    { studentId: "", name: "คุณปริศนา   เรืองรองรัตน์", cohort: BACHELOR, generation: 14 },
    { studentId: "", name: "คุณบุญเรือง  ตั้งสินมั่นคง", cohort: BACHELOR, generation: 15 },
    { studentId: "", name: "อ.ดร.โรจนี   จินตนาวัฒน์", cohort: BACHELOR, generation: 16 },
    { studentId: "", name: "คุณพรศิริ  ใจสม", cohort: BACHELOR, generation: 17 },
    { studentId: "", name: "อ.สมบัติ   สกุลพรรณ์", cohort: BACHELOR, generation: 18 },
    { studentId: "", name: "คุณสดับพร   เกษชนก", cohort: BACHELOR, generation: 19 },
    { studentId: "", name: "อ.ธารีวรรณ  ไชยบุญเรือง", cohort: BACHELOR, generation: 20 },
    { studentId: "", name: "ผศ.ดร.วันชัย   มุ้งตุ้ย", cohort: BACHELOR, generation: 21 },
    { studentId: "", name: "คุณศรีทัย    สีทิพย์", cohort: BACHELOR, generation: 22 },
    { studentId: "", name: "คุณดาราลักษณ์  ถาวรประสิทธิ์", cohort: BACHELOR, generation: 23 },
    { studentId: "", name: "คุณนพวรรณ   รัตนดำรงค์อักษร", cohort: BACHELOR, generation: 24 },
    { studentId: "", name: "อ.เนตรทอง   นามพรม", cohort: BACHELOR, generation: 25 },
    { studentId: "", name: "ผศ.พัชรี   วรกิจพูนผล", cohort: BACHELOR, generation: 26 },
    { studentId: "", name: "คุณสมาคม  บุญยงค์", cohort: BACHELOR, generation: 27 },
    { studentId: "", name: "คุณอรุณศรี   มุงเมือง", cohort: BACHELOR, generation: 28 },
    { studentId: "", name: "คุณสิริรัตน์  จำปา", cohort: BACHELOR, generation: 29 },
    { studentId: "", name: "คุณขวัญจิต  มหากิตติคุณ", cohort: BACHELOR, generation: 30 },
    { studentId: "", name: "คุณฉันทนา  จันทร์แจ่ม", cohort: BACHELOR, generation: 31 },
    { studentId: "", name: "คุณเกษมณี  มูลปานันท์", cohort: BACHELOR, generation: 32 },
    { studentId: "", name: "คุณทัศนย์  ฟองใจ", cohort: BACHELOR, generation: 33 },
    { studentId: "", name: "คุณเกรียงไกร  ทวีหอม", cohort: BACHELOR, generation: 34 },
    { studentId: "", name: "คุณสมคิด  ขัติยะ", cohort: BACHELOR, generation: 35 },
    { studentId: "", name: "คุณลัดดาวัลย์   ภีระคำ", cohort: BACHELOR, generation: 36 },
    { studentId: "", name: "คุณอรรธางค์   ปัญญางาม", cohort: BACHELOR, generation: 37 },
    { studentId: "", name: "คุณวราภรณ์   ประพันธ์ศรี", cohort: BACHELOR, generation: 38 },
    // ปริญญาเอก รุ่น 1–6
    { studentId: "", name: "อ.ดร.นัทธมน  วุทธานนท์", cohort: DOCTORAL, generation: 1 },
    { studentId: "", name: "อ.ดร.สุดารัตน์   ชัยอาจ", cohort: DOCTORAL, generation: 2 },
    { studentId: "", name: "อ.ดร.ประทุม  สร้อยวงศ์", cohort: DOCTORAL, generation: 3 },
    { studentId: "", name: "ผศ.ดร.อุษณีย์  จินตะเวช", cohort: DOCTORAL, generation: 4 },
    { studentId: "", name: "ผศ.ดร.ทศพร  คำผลศิริ", cohort: DOCTORAL, generation: 5 },
    { studentId: "", name: "อ.ดร.เพชรสุนีย์   ทั้งเจริญกุล", cohort: DOCTORAL, generation: 6 },
  ];

  const modelReps = [];
  for (let idx = 0; idx < modelRepData.length; idx++) {
    const data = modelRepData[idx];
    let studentId = data.studentId;
    if (!studentId) {
      studentId = `7043${String(idx + 1).padStart(4, "0")}`;
      const parsed = parseThaiName(data.name);
      await prisma.alumni.upsert({
        where: { studentId },
        update: {
          prefix: parsed.prefix,
          firstName: parsed.firstName,
          maidenLastName: parsed.maidenLastName,
          newLastName: parsed.newLastName,
          degreeLevel: randomDegreeLevel(),
        },
        create: {
          studentId,
          prefix: parsed.prefix,
          firstName: parsed.firstName,
          maidenLastName: parsed.maidenLastName,
          newLastName: parsed.newLastName,
          degreeLevel: randomDegreeLevel(),
        },
      });
    }
    const modelDisplayName = parseThaiName(data.name);
    const displayName = modelDisplayName.newLastName
      ? `${modelDisplayName.prefix}${modelDisplayName.firstName} (${modelDisplayName.maidenLastName}) ${modelDisplayName.newLastName}`
      : `${modelDisplayName.prefix}${modelDisplayName.firstName} ${modelDisplayName.maidenLastName}`;
    const record = await prisma.modelRepresentative.upsert({
      where: {
        studentId_cohort_generation: {
          studentId,
          cohort: data.cohort,
          generation: data.generation,
        },
      },
      update: { ...data, studentId, name: displayName },
      create: { ...data, studentId, name: displayName },
    });
    modelReps.push(record);
  }
  console.log(`  Upserted ${modelReps.length} model representative records\n`);

  // ── Summary ──
  console.log("=".repeat(50));
  console.log("Seeding complete! Summary:");
  console.log(`  Admin Users        : 2`);
  console.log(`  Alumni             : ${alumni.length}`);
  console.log(`  Awards             : ${awards.length}`);
  console.log(`  Associations       : ${associations.length}`);
  console.log(`  Graduate Comm.     : ${committees.length}`);
  console.log(`  News Articles      : ${newsRecords.length}`);
  console.log(`  Potentials         : ${potentials.length}`);
  console.log(`  Abroad Alumni      : ${abroadAlumni.length}`);
  console.log(`  Model Reps         : ${modelReps.length}`);
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
