import "dotenv/config";
import prisma from "../lib/prisma";
import { hashPassword } from "../lib/auth";
import * as XLSX from "xlsx";

const ALL_DEGREE_LEVELS = ["BACHELOR", "MASTER", "DOCTORAL", "NURSING_ASSISTANT"] as const;

function cohortFromStudentId(sid: string): string | undefined {
  if (/^\d{5}$/.test(sid)) return `รุ่น ${sid[0]}`;
  return undefined;
}

function spreadPrefix(index: number, total: number): string {
  const prefixes = Array.from({ length: 15 }, (_, i) => String(51 + i));
  return prefixes[index % prefixes.length];
}

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
  const executiveHash = await hashPassword("password123");

  const [admin, superadmin, executive] = await Promise.all([
    prisma.adminUser.upsert({
      where: { email: "admin@cmu.ac.th" },
      update: { firstName: "ผู้ดูแล", lastName: "ระบบ", passwordHash: adminHash, role: "admin" },
      create: {
        firstName: "ผู้ดูแล",
        lastName: "ระบบ",
        email: "admin@cmu.ac.th",
        passwordHash: adminHash,
        role: "admin",
      },
    }),
    prisma.adminUser.upsert({
      where: { email: "superadmin@cmu.ac.th" },
      update: { firstName: "ผู้ดูแลระบบ", lastName: "สูงสุด", passwordHash: superadminHash, role: "superadmin" },
      create: {
        firstName: "ผู้ดูแลระบบ",
        lastName: "สูงสุด",
        email: "superadmin@cmu.ac.th",
        passwordHash: superadminHash,
        role: "superadmin",
      },
    }),
    prisma.adminUser.upsert({
      where: { email: "executive@cmu.ac.th" },
      update: { firstName: "ผู้บริหาร", lastName: "ระบบ", passwordHash: executiveHash, role: "executive" },
      create: {
        firstName: "ผู้บริหาร",
        lastName: "ระบบ",
        email: "executive@cmu.ac.th",
        passwordHash: executiveHash,
        role: "executive",
      },
    }),
  ]);
  console.log(`  Upserted admin: ${admin.email}`);
  console.log(`  Upserted superadmin: ${superadmin.email}`);
  console.log(`  Upserted executive: ${executive.email}\n`);

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

  // Generation prefixes (first 2 digits of studentId) — ranges 51–65
  const genPrefixes = [
    "51", "52", "53", "54", "55",
    "56", "57", "58", "59", "60",
    "61", "62", "63", "64", "65",
    "51", "52", "53", "54", "55",
    "56", "57", "58", "59", "60",
    "61", "62", "63", "64", "65",
    "51", "52", "53", "54", "55",
    "56", "57", "58", "59", "60",
    "61", "62", "63", "64", "65",
    "51", "52", "53", "54", "55",
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

  // ── 3. Upsert awards from real xlsx data ──
  console.log("Upserting awards from xlsx files...");

  function classifyAwardTier(awardName: string): "INTERNATIONAL" | "NATIONAL" | "LOCAL" {
    const upper = awardName.toUpperCase();
    const internationalKeywords = [
      "นานาชาติ", "INTERNATIONAL", "โลก", "USA", "AMERICAN", "FAAN",
      "STANFORD", "UAB", "HALL OF FAME", "PHI KAPPA", "PHI BETA",
      "TARA", "EACC", "UNIVERSITY OF WASHINGTON", "UNIVERSITY OF ALABAMA",
      "DISTINGUISHED ALUMNI AWARD",
    ];
    const nationalKeywords = [
      "ประเทศไทย", "แห่งชาติ", "ระดับประเทศ", "กระทรวง",
      "สภาการพยาบาล", "มหิดล", "เลิศรัฐ", "ข้าราชการพลเรือนดีเด่น",
      "สตรีตัวอย่างแห่งชาติ", "สมาคมพยาบาลแห่งประเทศไทย",
      "อาจารย์ดีเด่นแห่งชาติ",
    ];
    if (internationalKeywords.some((kw) => upper.includes(kw.toUpperCase()))) return "INTERNATIONAL";
    if (nationalKeywords.some((kw) => upper.includes(kw))) return "NATIONAL";
    return "LOCAL";
  }

  // Build alumni name lookup: "firstname lastname" -> studentId
  const allAlumni = await prisma.alumni.findMany({ select: { studentId: true, firstName: true, maidenLastName: true } });
  const alumniByName = new Map<string, string>();
  for (const a of allAlumni) {
    alumniByName.set(`${a.firstName.trim()} ${a.maidenLastName.trim()}`.toLowerCase(), a.studentId);
  }

  interface AwardRow { studentId: string | null; recipientName: string | null; awardName: string; awardType: "INTERNATIONAL" | "NATIONAL" | "LOCAL"; year: number; description: string | null; }

  const awardRows: AwardRow[] = [];
  const seenAwards = new Set<string>();

  function dedupKey(sid: string | null, name: string, yr: number) {
    return sid ? `${sid}::${name}::${yr}` : `NULL::${name}::${yr}`;
  }

  // --- File 1: back up รางวัลศิษย์เก่า.xlsx ---
  const wb1 = XLSX.readFile("imports/award/back up รางวัลศิษย์เก่า.xlsx");
  const d1 = XLSX.utils.sheet_to_json(wb1.Sheets["Sheet1"], { header: 1, defval: "" }) as (string | number)[][];
  for (let i = 2; i < d1.length; i++) {
    const row = d1[i];
    const studentId = String(row[1] || "").trim();
    const fullName = String(row[2] || "").trim();
    const awardName = String(row[5] || "").trim();
    const year = Number(row[6]);
    if (!awardName || !year) continue;

    // Create alumni stub if needed
    if (studentId) {
      const parsed = parseThaiName(fullName);
      await prisma.alumni.upsert({
        where: { studentId },
        update: { prefix: parsed.prefix, firstName: parsed.firstName, maidenLastName: parsed.maidenLastName, cohort: cohortFromStudentId(studentId) },
        create: { studentId, prefix: parsed.prefix, firstName: parsed.firstName, maidenLastName: parsed.maidenLastName, degreeLevel: "BACHELOR", cohort: cohortFromStudentId(studentId) },
      });
      alumniByName.set(`${parsed.firstName.trim()} ${parsed.maidenLastName.trim()}`.toLowerCase(), studentId);
    }

    const key = dedupKey(studentId, awardName, year);
    if (seenAwards.has(key)) continue;
    seenAwards.add(key);

    awardRows.push({ studentId, recipientName: null, awardName, awardType: classifyAwardTier(awardName), year, description: null });
  }

  // --- File 2: ข้อมูลรางวัลศิษย์เก่าจาก CMU Alumni Information System.xlsx ---
  const wb2 = XLSX.readFile("imports/award/ข้อมูลรางวัลศิษย์เก่าจาก CMU Alumni Information System.xlsx");
  const d2 = XLSX.utils.sheet_to_json(wb2.Sheets["Sheet1"], { header: 1, defval: "" }) as (string | number)[][];
  for (let i = 1; i < d2.length; i++) {
    const row = d2[i];
    const studentId = String(row[1] || "").trim();
    const fullName = String(row[2] || "").trim();
    const awardName = String(row[4] || "").trim();
    const year = Number(row[5]);
    if (!awardName || !year) continue;

    if (studentId) {
      const parsed = parseThaiName(fullName);
      await prisma.alumni.upsert({
        where: { studentId },
        update: { prefix: parsed.prefix, firstName: parsed.firstName, maidenLastName: parsed.maidenLastName, cohort: cohortFromStudentId(studentId) },
        create: { studentId, prefix: parsed.prefix, firstName: parsed.firstName, maidenLastName: parsed.maidenLastName, degreeLevel: "BACHELOR", cohort: cohortFromStudentId(studentId) },
      });
      alumniByName.set(`${parsed.firstName.trim()} ${parsed.maidenLastName.trim()}`.toLowerCase(), studentId);
    }

    const key = dedupKey(studentId, awardName, year);
    if (seenAwards.has(key)) continue;
    seenAwards.add(key);

    awardRows.push({ studentId, recipientName: null, awardName, awardType: classifyAwardTier(awardName), year, description: null });
  }

  // --- File 3: รางวัลนักศึกษา 3ปีย้อนหลัง.xlsx — ศิษย์เก่า sheet ---
  const wb3 = XLSX.readFile("imports/award/รางวัลนักศึกษา 3ปีย้อนหลัง.xlsx");
  const d3a = XLSX.utils.sheet_to_json(wb3.Sheets["ศิษย์เก่า"], { header: 1, defval: "" }) as (string | number)[][];
  let currentYear3a = 0;
  for (let i = 2; i < d3a.length; i++) {
    const row = d3a[i];
    if (row[0] && typeof row[0] === "number") currentYear3a = row[0];
    // Skip header rows repeated in the sheet
    if (String(row[0]) === "ปีที่รับ") { currentYear3a = 0; continue; }

    const prefix = String(row[1] || "").trim();
    const fullName = String(row[2] || "").trim();
    const awardName = String(row[3] || "").trim();
    const year = currentYear3a;
    if (!fullName || !awardName || !year) continue;

    // Try to match by name
    const parsed = parseThaiName(fullName);
    const nameKey = `${parsed.firstName.trim()} ${parsed.maidenLastName.trim()}`.toLowerCase();
    const matchedStudentId = alumniByName.get(nameKey) || null;

    const key = dedupKey(matchedStudentId, awardName, year);
    if (seenAwards.has(key)) continue;
    seenAwards.add(key);

    if (matchedStudentId) {
      awardRows.push({ studentId: matchedStudentId, recipientName: null, awardName, awardType: classifyAwardTier(awardName), year, description: null });
    } else {
      console.log(`  ⚠ No alumni match for: ${fullName} — storing with recipientName`);
      awardRows.push({ studentId: null, recipientName: `${prefix}${fullName}`.trim(), awardName, awardType: classifyAwardTier(awardName), year, description: null });
    }
  }

  // --- File 3: นักศึกษา sheet ---
  const d3b = XLSX.utils.sheet_to_json(wb3.Sheets["นักศึกษา"], { header: 1, defval: "" }) as (string | number)[][];
  let currentYear3b = 0;
  for (let i = 2; i < d3b.length; i++) {
    const row = d3b[i];
    if (row[0] && typeof row[0] === "number") currentYear3b = row[0];

    const fullName = String(row[1] || "").trim();
    const awardName = String(row[2] || "").trim();
    const year = currentYear3b;
    if (!fullName || !awardName || !year) continue;

    const parsed = parseThaiName(fullName);
    const nameKey = `${parsed.firstName.trim()} ${parsed.maidenLastName.trim()}`.toLowerCase();
    const matchedStudentId = alumniByName.get(nameKey) || null;

    const key = dedupKey(matchedStudentId, awardName, year);
    if (seenAwards.has(key)) continue;
    seenAwards.add(key);

    if (matchedStudentId) {
      awardRows.push({ studentId: matchedStudentId, recipientName: null, awardName, awardType: classifyAwardTier(awardName), year, description: null });
    } else {
      console.log(`  ⚠ No alumni match for: ${fullName} — storing with recipientName`);
      awardRows.push({ studentId: null, recipientName: fullName, awardName, awardType: classifyAwardTier(awardName), year, description: null });
    }
  }

  // Create all awards
  const awards: { id: string }[] = [];
  for (const data of awardRows) {
    const record = await prisma.award.create({ data });
    awards.push(record);
  }
  console.log(`  Created ${awards.length} award records\n`);

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

  // ── 8. Upsert abroad alumni (from Excel import) ──
  console.log("Upserting abroad alumni from xlsx file...");

  const abroadWb = XLSX.readFile("imports/abroad-alumni/ศิษย์เก่าที่ทำงานในต่างประเทศ.xlsx");
  const abroadRows = XLSX.utils.sheet_to_json(abroadWb.Sheets[abroadWb.SheetNames[0]], { header: 1, defval: "" }) as (string | number)[][];

  function inferCountry(wp: string): string {
    const w = wp.toLowerCase();
    if (w.includes("australia") || w.includes("brisbane") || w.includes("perth")) return "ออสเตรเลีย";
    if (w.includes("canada")) return "แคนาดา";
    if (w.includes("denmark")) return "เดนมาร์ก";
    if (w.includes("new zealand")) return "นิวซีแลนด์";
    if (w.includes("france") || w.includes("paris")) return "ฝรั่งเศส";
    if (w.includes("usa") || w.includes("u.s.a") || w.includes("california") || w.includes("chicago") || w.includes("texas") || w.includes("new york") || w.includes("illinois") || w.includes("florida") || w.includes("pennsylvania") || w.includes("georgia") || w.includes("missouri") || w.includes("connecticut") || w.includes("maryland") || w.includes("washington") || w.includes("nevada") || w.includes("indiana") || w.includes("kansas")) return "สหรัฐอเมริกา";
    return "สหรัฐอเมริกา";
  }

  const abroadAlumniData: { cohort: string | null; prefix: string; thaiName: string | null; englishName: string | null; workplace: string | null; country: string; notes: string | null; order: number }[] = [];

  for (let i = 1; i < abroadRows.length; i++) {
    const r = abroadRows[i];
    const cohort = String(r[0] || "").trim() || null;
    const prefix = String(r[1] || "").trim() || "คุณ";
    const thaiName = String(r[2] || "").trim() || null;
    const englishName = String(r[3] || "").trim() || null;
    const workplace = String(r[4] || "").trim() || null;
    const notes = String(r[5] || "").trim() || null;
    const country = inferCountry(workplace || "");

    abroadAlumniData.push({ cohort, prefix, thaiName, englishName, workplace, country, notes, order: i });
  }

  const abroadAlumni = [];
  for (const data of abroadAlumniData) {
    const record = await prisma.abroadAlumni.create({ data });
    abroadAlumni.push(record);
  }
  console.log(`  Created ${abroadAlumni.length} abroad alumni records\n`);

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
      studentId = `${spreadPrefix(idx, modelRepData.length)}43${String(idx + 1).padStart(4, "0")}`;
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
