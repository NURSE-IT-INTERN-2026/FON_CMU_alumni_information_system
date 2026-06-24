# Product Requirements Document (PRD)
# Alumni Information System — Faculty of Nursing, Chiang Mai University (FON CMU)

**Date:** 2026-05-29 (revised 2026-06-16)
**Author:** Lead Supervisor, Faculty of Nursing CMU
**Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL

---

## 1. Overview

A web-based alumni information system for the Faculty of Nursing, Chiang Mai University (FON CMU). The system is built by the faculty's lead supervisor and serves two audiences:

1. **Administrators** — manage alumni data through an admin dashboard: display data in filterable/sortable tables, perform full CRUD on alumni data, and import/export Excel.
2. **Alumni** — log in, update their own data, and socialize with other alumni.

**Primary goal:** let admins export/import Excel tables of alumni, display the data in tables that can be filtered and sorted, and perform CRUD actions on alumni data — plus an alumni side where alumni log in, update their own data, and interact with other alumni.

---

## 2. Users & Roles

### 2.1 Admin Roles

| Role | Description |
|------|-------------|
| **Superadmin** | Full CRUD on all data and user account management. Confirms/restores/hard-deletes soft-deleted records. |
| **Admin** | Full CRUD on all data. Can import/export Excel. |
| **Executive** | Read-only access — can view and search data but cannot add, edit, or delete anything. |

> Admins authenticate via **CMU OAuth** only. *(During development/testing, email–password login is used instead for convenience.)*

### 2.2 Alumni Role

| Role | Description |
|------|-------------|
| **Alumni** | Logs in with email + password. Can self-register (sign up) by verifying their identity against an existing record, then view and edit their own profile data only. No access to admin pages or other alumni's data. |

- Alumni are **not** pre-registered by an admin account-wise; instead, an alumni record must already exist in the system (imported/created by an admin), and the alumni **claims** that record by verifying their identity at sign-up (see §3.1.2).
- Alumni can only view and edit the `Alumni` record linked to them.

---

## 3. Functional Requirements (MVP)

### 3.1 Authentication & Login

The login page has **two separate login sections — Admin and Alumni** — and a button to toggle between them.

#### 3.1.1 Admin Login

- Admins use **CMU OAuth** to log in.
- *(Current/testing mode: email–password login for easier testing.)*
- Access is granted only if the CMU account has been pre-registered by a superadmin/admin.
- Session-based authentication with HTTP-only cookies (`fon-cmu-session`); sessions expire after 7 days.
- Write endpoints require a valid admin/superadmin session (`checkWritePermission`).

#### 3.1.2 Alumni Login & Sign-up

- Alumni log in using **email and password**.
- If they have not signed up yet, they can choose to **sign up**. The sign-up form collects:
  - ชื่อ (first name)
  - นามสกุล (last name)
  - รหัสนักศึกษา (student ID)
  - ปีที่จบ (graduation year)
  - วันเกิด in `วว/ดด/ปปปป` (DD/MM/YYYY) format
  - (plus the email + password they will use to log in)
- The system **verifies** whether the provided data matches a record already in the app.
- **If the data matches an existing record**, sign-up is **approved automatically** and the alumni is logged in (the account is linked to that record).
- If no match is found, the alumni is told their data is not in the system and should contact the faculty.
- Rate limiting is applied to prevent brute-forcing of the verification fields.

#### 3.1.3 Alumni First-Login & Terms of Service

- On **first login** (after the alumni's identity is verified/claimed), the alumni is greeted with a **Terms of Service (TOS)** page. The alumni must **agree to the TOS** to use the app; the only other choice is to **logout**.
- After accepting, subsequent logins skip the TOS.

#### 3.1.4 Alumni Profile (Default Landing)

- After logging in (and accepting the TOS), the alumni lands on their **personal profile page**.
- The profile is **auto-filled** from the linked record (data linking across pages), and the alumni is **notified that the data has been auto-filled**.
- The profile page has **view mode** and **edit mode**.
- **First-time data-found notice:** if the alumni's record already existed in the system, a modal notifies them to review/edit the auto-filled data:
  > "พบข้อมูลของท่านในระบบแล้ว กรุณาตรวจสอบและแก้ไขข้อมูลตามต้องการ"
- **Admin-edit notification:** if an admin has edited the profile since the alumni's last login (tracked via `adminEditedAt`), a modal appears on next login (presented as a popup on the alumni side informing them their data was edited by an admin):
  > "ผู้ดูแลระบบได้แก้ไขข้อมูลของท่าน กรุณาตรวจสอบความถูกต้อง หากไม่ถูกต้องกรุณาติดต่อผู้ดูแลระบบ"

**Profile sections** — sections with no data are hidden:

| Section | Fields |
|---------|--------|
| ข้อมูลส่วนตัว | คำนำหน้า, ชื่อ, นามสกุล, วันเกิด, ที่อยู่ |
| ข้อมูลการติดต่อ | อีเมล, เบอร์โทรศัพท์ |
| ข้อมูลการศึกษา | Grouped into subsections by ระดับการศึกษา (one per degree studied at FON CMU). Fields per subsection: รหัสนักศึกษา, รุ่น, สาขาวิชา, ระดับการศึกษา |
| ข้อมูลรางวัล *(hidden if empty)* | Table: ชื่อรางวัล, ประเภท, ลิงค์, รูปภาพ, รายละเอียด |
| ข้อมูลศักยภาพ *(hidden if empty)* | อาชีพ, ตำแหน่ง, หมายเหตุ |
| ข้อมูลสมาคม/ชมรม *(hidden if empty)* | ชื่อสมาคม/ชมรม, ตำแหน่ง, ปีที่บันทึก, หมายเหตุ |
| ข้อมูลดำรงตำแหน่งกรรมการบัณฑิต *(hidden if empty)* | ปีพ.ศ., รุ่นที่ *(graduate-committee-exclusive cohort)*, ตำแหน่ง, หมายเหตุ |
| ข้อมูลการเป็นผู้แทนรุ่น *(hidden if empty)* | เครือข่าย, รุ่นที่ *(model-representative-exclusive cohort)*, หมายเหตุ |
| ข้อมูลการทำงาน *(hidden if empty)* | ชื่ออังกฤษ, ประเทศ, สถานที่ทำงาน, ที่อยู่บ้าน, หมายเหตุ |

- Editable by alumni: prefix, firstName, lastName, cohort, degreeLevel, major, email, phone, currentWorkplace, country, etc.
- **Not** editable by alumni: `studentId`, `birthDate`, `citizenId` (read-only).
- **Self-edit Reason field:** every alumni profile edit requires the alumni to choose a **Reason** from [แก้ไขให้ถูกต้อง, อัปเดตข้อมูล] for logging (no default value).
- All alumni edits are written to the `ActivityLog`; admins can filter logs to alumni-only activities.

### 3.2 Admin Main Page (หน้าหลัก) — Dashboard

- Route: `/`
- A dashboard that displays a summarized card view for each of the other admin pages.
- **All-alumni summary:** a **line graph** with X-axis = cohort (รุ่น) and Y-axis = alumni count, with **5 lines** grouped by degree level, in this order:
  1. หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล
  2. อนุปริญญา
  3. ปริญญาตรี
  4. ปริญญาโท
  5. ปริญญาเอก
  - Plus **5 mini cards** showing each group's count, ordered the same as above.
- **Awards summary:** the page name + record counts grouped by award type [ระดับท้องถิ่น, ระดับชาติ, ระดับนานาชาติ].
- **Other pages (excluding news):** the page name + the total record count.
- **Latest news section:** the 3 latest published news items.

### 3.3 All-alumni Page (ข้อมูลนักศึกษาเก่า)

- Route: `/alumni-count` (all-alumni data table)
- Table columns: รหัสนักศึกษา, รุ่น, คำนำหน้า, ชื่อ, นามสกุล, ระดับการศึกษา, สาขาวิชา, ปีสำเร็จการศึกษา, วันเกิด (`วว/ดด/ปปปป`), หมายเหตุ
- **Filters:** ระดับการศึกษา, สาขาวิชา, ปีที่สำเร็จการศึกษา
- *(Note: the dashboard's line graph + 5 mini count cards also live on the dashboard, see §3.2.)*
- **Row click:** clicking a row opens that alumni's profile view (§3.18). Manage rows link by alumni id; View (CMU) rows link by `student_id` (the profile shows "ไม่พบข้อมูลศิษย์เก่า" if the alumni isn't in the local DB yet).

### 3.4 Awards Page (รางวัล)

- Route: `/awards`
- **3 cards** displaying counts of each award type [ระดับท้องถิ่น, ระดับชาติ, ระดับนานาชาติ].
- Table columns: รหัสนักศึกษา, สาขาวิชา, คำนำหน้า, ชื่อ, นามสกุล, ชื่อรางวัล, ประเภท, ลิงค์, รูปภาพ, รายละเอียด
- **Image upload:** `.jpg` and `.png` only, max **5 MB**.
- **Filters:** สาขาวิชา, ประเภท

### 3.5 Potentials Page (ศักยภาพ)

- Route: `/potentials`
- Table columns: รหัสนักศึกษา, สาขาวิชา, คำนำหน้า, ชื่อ, นามสกุล, อาชีพ, ตำแหน่ง, ปีที่บันทึก, หมายเหตุ
- **Filters:** สาขาวิชา, อาชีพ, ตำแหน่ง, ปีที่บันทึก

### 3.6 Association / Club Page (สมาคม/ชมรม)

- Route: `/associations`
- Table columns: รหัสนักศึกษา, สาขาวิชา, คำนำหน้า, ชื่อ, นามสกุล, ชื่อสมาคม/ชมรม, ตำแหน่ง, ปีที่บันทึก, หมายเหตุ
- **Filters:** ชื่อสมาคม/ชมรม, ตำแหน่ง, ปีที่บันทึก, สาขาวิชา

### 3.7 Graduate Committee Page (กรรมการบัณฑิต)

- Route: `/graduate-committee`
- Table columns: ปีพ.ศ., รุ่นที่ *(graduate-committee-exclusive cohort value)*, รหัสนักศึกษา, สาขาวิชา, คำนำหน้า, ชื่อ, นามสกุล, ตำแหน่ง, หมายเหตุ
- **Filters:** ปีพ.ศ., รุ่นที่ *(graduate-committee-exclusive cohort value)*, ตำแหน่ง, สาขาวิชา

### 3.8 Model Representative Page (ผู้แทนรุ่น)

- Route: `/model-representatives`
- Table columns: เครือข่าย, รุ่นที่ *(model-representative-exclusive cohort value)*, รหัสนักศึกษา, สาขาวิชา, คำนำหน้า, ชื่อ, นามสกุล, หมายเหตุ
- **Filters:** เครือข่าย, รุ่นที่ *(model-representative-exclusive cohort value)*, สาขาวิชา

### 3.9 Alumni-Agency Page (ต้นสังกัดศิษย์เก่า)

- Route: `/alumni-agency`
- A **toggle** between two modes: **Thailand** and **Abroad**. Both modes share the same columns; **Abroad mode adds ประเทศ (country)**.
- **Thailand mode** — table of alumni and the domestic agency they work at:
  - รหัสนักศึกษา, รุ่น, สาขาวิชา, คำนำหน้า, ชื่อ-นามสกุล, ชื่ออังกฤษ, สถานที่ทำงาน, ที่อยู่บ้าน, หมายเหตุ
- **Abroad mode** — table of alumni working abroad:
  - รหัสนักศึกษา, รุ่น, สาขาวิชา, คำนำหน้า, ชื่อ-นามสกุล, ชื่ออังกฤษ, ประเทศ, สถานที่ทำงาน, ที่อยู่บ้าน, หมายเหตุ
- **Filters:** สถานที่ทำงาน, ประเทศ *(Abroad mode only)*

### 3.10 Filters (Behavior)

- **Non-number filters** (e.g. สาขาวิชา, อาชีพ, ตำแหน่ง, ชื่อสมาคม/ชมรม, เครือข่าย): display filter value choices for the user to pick. Show the **5 most frequent values** (by record count) in **descending order**, in a paginated dropdown where the user can click to see more choices.
- **Number filters** (e.g. ปีที่บันทึก, ปีที่สำเร็จการศึกษา): behave as above, but instead of "5 most frequent", they list the **years in descending order**.

### 3.11 Management Mode (CRUD)

Each admin page that displays alumni data has a **management mode toggle**. After toggling into management mode, the admin can:

- Choose to **add a record**, **import records**, or **export records**.
- The table remains visible; the admin can **edit** a record, **delete** a record, or **select multiple records** to delete.
- **Edit Reason field:** editing a record requires the admin to choose a **Reason** from [แก้ไขให้ถูกต้อง, อัปเดตข้อมูล] (no default value, to prevent false logs). The reason is recorded with the activity-log entry.
- **Delete is a soft delete** — the record is marked deleted and the deletion is logged for a **superadmin to confirm**. The superadmin can then **restore** the record or **hard-delete** it (hard delete requires an additional confirmation to avoid accidental permanent deletion).
- **Add a record** toggles a **modal form** to create a record.
  - The **All-alumni page** shows a **full-form**: the admin can also **optionally add additional data for the other pages** at the same time, so creating one record here can affect other pages too (every page except news).
  - For **other pages** (except all-alumni and news), entering values for **รหัสนักศึกษา, ชื่อ, นามสกุล** triggers a **dropdown** that auto-fills the form and **links the data to an alumni record**. The dropdown displays the values in order: **รหัสนักศึกษา, ชื่อ, นามสกุล**.

### 3.12 News Page

- Route: `/news`
- Displays **published** news cards, ordered by **published date** from latest to oldest.
- Each news card can be clicked to see the details (at `/news/[id]`).
- **3 news statuses** used to create and filter news:
  1. ฉบับร่าง (draft)
  2. เผยแพร่ (published)
  3. ยุติการเผยแพร่ (discontinued/archived)
- **Pagination:** each page shows **at most 9 news cards**.
- **Management mode** does **not** turn the cards into a table. Instead, it adds an **edit** button (to edit the news) and a **delete** button (which changes the news status to **ยุติการเผยแพร่**).
- **News form:** a **WYSIWYG** editor to customize the news display.
  - Can upload a **thumbnail** image and **in-news images (max 4 images)**.
  - Each image: max **5 MB**, `.png` or `.jpg` only.

### 3.13 Pagination

- Each data table displays a **maximum of 10 records per page**.
- *(News cards: maximum 9 per page, see §3.12.)*

### 3.14 Sorting

- Every data-field column header on every table can be clicked to **sort by that field**, toggling the sort style between **ascending** and **descending**.

### 3.15 Admin Account Management System

Accessed via the **cog (⚙) icon** on the top navbar, opening a sub-navigation (left navbar) with the following pages:

- **My Account** — displays the logged-in admin's ชื่อ, นามสกุล, CMU account, ตำแหน่ง (role).
- **Account Management** — manage admin and alumni accounts.
- **System Logs** — activity logs (see §3.16).
- **Trash Bin** *(superadmin exclusive)* — review/confirm/restore/hard-delete soft-deleted records (see §3.11).

#### Account Management

- **Admin/Executive accounts table:** ชื่อ, นามสกุล, CMU acc, ตำแหน่ง. A **superadmin** can **suspend** admin accounts.
- **Alumni accounts table:** รหัสนักศึกษา, รุ่น, ชื่อ, นามสกุล, วันเกิด, อีเมล. Searchable, paginated.
  - Admins can click an **eye icon** on an alumni row to **view the alumni profile** (full detail at `/settings/alumni/[id]`).
  - Admins can **change an alumni's email** (e.g., forgotten email).
  - Admins can **edit alumni profile data** with an additional **Reason field** [แก้ไขให้ถูกต้อง, อัปเดตข้อมูล] for logging; admins can edit the same fields the alumni can edit, plus `citizenId`/`birthDate` which only admins can edit. Saving sets `adminEditedAt`, which triggers the admin-edit popup on the alumni's next login (§3.1.4).
  - Admins can **suspend alumni accounts**.

### 3.16 System Logs

- Logs every action in a table with columns: ชื่อ, นามสกุล, ตำแหน่ง (role), กิจกรรม, รายละเอียด.
- **กิจกรรม (activity) types:** create, edit, update, import, export, delete, suspend.
- **รายละเอียด (details):** an **eye icon** opens a modal explaining the changes (e.g., editing first name: สมศักดิ์ → สมศรี).
- **Update indicators (orange values):** when a record's data is **updated**, each admin alumni-data page also logs the update. If a change affects every page (e.g., updating first or last name), it is logged on **every** page. The updated value is rendered in **orange and is clickable**; clicking opens a modal showing the **update history** (old value, new value, update date).
- Supports filtering to alumni-only activities.

### 3.17 Alumni News Page

- Alumni can **view news** created by admins (published news cards, same display as the admin/public news page), but cannot create or edit news.

### 3.18 Admin Alumni Profile View

- Route: `/management/alumni/[id]` — the route param accepts the alumni UUID **or** `studentId`.
- **Entry:** reached by **clicking any row** in the all-alumni table and every alumni-related table (alumni-agency, awards, associations, graduate-committee, model-representatives, potentials). Clicks on a checkbox, edit/delete button, an orange value, or a link/image inside a row do not navigate.
- **Layout** mirrors the alumni-portal profile page: ข้อมูลพื้นฐาน / ข้อมูลติดต่อ / ข้อมูลการทำงาน + related sections (รางวัล, สมาคม/ชมรม, กรรมการบัณฑิต, ศักยภาพ, ผู้แทนรุ่น, ต้นสังกัดศิษย์เก่า).
- **Orange edit-history indicators:** core fields changed by an admin (`resourceType: alumni`) **or** by the alumni themselves (`resourceType: alumni_profile`) render orange; clicking opens the per-field edit-history modal (old → new, who, when, reason).
- **Edit mode** (roles with write permission): edits core fields + the 5 related sections via `PUT /api/alumni/update-with-related/[id]` (requires เหตุผลในการแก้ไข; sets `adminEditedAt`). ต้นสังกัดศิษย์เก่า is view-only here (the route does not persist it).
- **ประวัติการเปลี่ยนแปลง toggle:** switches the page to a merged change timeline — field-change history (alumni core `alumni`/`alumni_profile` + this alumni's related rows) ∪ activity-log events for the alumni; newest first (see §9.3 `/api/alumni/[id]/activity`).

---

## 4. Access Control Summary

### 4.1 Admin Access

| Feature | Superadmin | Admin | Executive |
|---------|-----------|-------|-----------|
| View all pages | ✓ | ✓ | ✓ |
| Search / filter / sort data | ✓ | ✓ | ✓ |
| Export `.xlsx` | ✓ | ✓ | ✓ |
| Create / Edit / Delete records (soft delete) | ✓ | ✓ | ✗ |
| Import `.xlsx` | ✓ | ✓ | ✗ |
| Confirm/restore/hard-delete soft-deleted records | ✓ | ✗ | ✗ |
| Manage user accounts | ✓ | ✓ | ✗ |
| Suspend admin accounts | ✓ | ✗ | ✗ |
| Suspend alumni accounts | ✓ | ✓ | ✗ |
| View/edit alumni profiles (from account management) | ✓ | ✓ | ✗ |
| View alumni activity logs / filter to alumni-only | ✓ | ✓ | ✓ |

### 4.2 Alumni Access

| Feature | Alumni |
|---------|--------|
| Sign up (verify identity against existing record) | ✓ |
| View / edit own profile | ✓ |
| View other alumni's data | ✗ |
| Access admin pages | ✗ |
| Import / Export | ✗ |
| Manage user accounts | ✗ |

---

## 5. Data Model

> **Note:** Several fields/enum values below reflect the revised spec (§3). They imply schema migrations beyond what is currently implemented (e.g. 5 degree levels, 3 news statuses, `major`/`graduationYear`/`password` on Alumni). See the schema in `prisma/schema.prisma` for current state.

### Enums

| Enum | Values |
|------|--------|
| **DegreeLevel** | NURSING_ASSISTANT (หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล), ASSOCIATE (อนุปริญญา), BACHELOR (ปริญญาตรี), MASTER (ปริญญาโท), DOCTORAL (ปริญญาเอก) |
| **AwardType** | LOCAL (ระดับท้องถิ่น), NATIONAL (ระดับชาติ), INTERNATIONAL (ระดับนานาชาติ) |
| **NewsStatus** | DRAFT (ฉบับร่าง), PUBLISHED (เผยแพร่), DISCONTINUED (ยุติการเผยแพร่) |
| **UserRole** | SUPERADMIN, ADMIN, EXECUTIVE |
| **SessionType** | ADMIN, ALUMNI |

### Alumni
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String | Unique |
| citizenId | String? | Thai national ID (13 digits). Unique if provided. |
| birthDate | String? | Birthday `วว/ดด/ปปปป` / `DDMMYYYY`. Read-only for alumni. Used for sign-up verification. |
| email | String? | Login email for alumni |
| passwordHash | String? | Hashed login password for alumni (spec — pending schema) |
| prefix | String | นางสาว, นาง, นาย, ดร., อื่นๆ |
| firstName | String | ชื่อ |
| lastName | String | นามสกุล |
| cohort | String? | รุ่นที่ |
| degreeLevel | DegreeLevel | ระดับการศึกษา |
| major | String? | สาขาวิชา (spec — pending schema) |
| graduationYear | Int? | ปีสำเร็จการศึกษา (spec — pending schema) |
| province | String? | |
| phone | String? | |
| currentWorkplace | String? | สถานที่ทำงาน |
| country | String? | |
| remarks | String? | หมายเหตุ |
| deletedAt | DateTime? | Soft-delete timestamp (spec-aligned; migration in progress) |
| hasLoggedIn | Boolean | Default `false`. Set `true` after first alumni login. |
| adminEditedAt | DateTime? | Last admin edit; triggers notification modal on next alumni login; cleared after viewed. |
| lastLoginAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Award
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String? | FK → Alumni.studentId |
| major | String? | สาขาวิชา |
| prefix | String? | คำนำหน้า |
| firstName | String? | ชื่อ |
| lastName | String? | นามสกุล |
| awardName | String | ชื่อรางวัล |
| awardType | AwardType | ประเภท |
| link | String? | ลิงค์ |
| imageUrl | String? | รูปภาพ |
| year | Int | Buddhist year (พ.ศ.) |
| description | String? | รายละเอียด |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Association
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String | FK → Alumni.studentId |
| major | String? | สาขาวิชา |
| prefix | String? | |
| firstName | String? | |
| lastName | String? | |
| associationName | String | ชื่อสมาคม/ชมรม |
| position | String | ตำแหน่ง |
| recordedYear | Int | ปีที่บันทึก |
| remarks | String? | หมายเหตุ |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### GraduateCommittee
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| termYear | Int | ปีพ.ศ. |
| cohort | String | รุ่นที่ *(graduate-committee-exclusive cohort value)* |
| studentId | String | FK → Alumni.studentId |
| major | String? | สาขาวิชา |
| prefix | String? | |
| firstName | String? | |
| lastName | String? | |
| position | String | ตำแหน่ง |
| remarks | String? | หมายเหตุ |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Potential
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String | FK → Alumni.studentId |
| major | String? | สาขาวิชา |
| prefix | String? | |
| firstName | String? | |
| lastName | String? | |
| career | String | อาชีพ |
| position | String | ตำแหน่ง |
| recordedYear | Int | ปีที่บันทึก |
| remarks | String? | หมายเหตุ |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### ModelRepresentative
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| network | String | เครือข่าย |
| cohort | String | รุ่นที่ *(model-representative-exclusive cohort value)* |
| studentId | String | FK → Alumni.studentId |
| major | String? | สาขาวิชา |
| prefix | String? | |
| firstName | String? | |
| lastName | String? | |
| remarks | String? | หมายเหตุ |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### AbroadAlumni
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String | FK → Alumni.studentId |
| cohort | String | รุ่น |
| major | String? | สาขาวิชา |
| prefix | String? | |
| fullName | String | ชื่อ-นามสกุล |
| fullNameEn | String? | ชื่ออังกฤษ |
| country | String | ประเทศ |
| workplace | String? | สถานที่ทำงาน |
| homeAddress | String? | ที่อยู่บ้าน |
| remarks | String? | หมายเหตุ |
| order | Int | Display ordering within group |
| createdAt | DateTime | |
| updatedAt | DateTime | |

> The **Thailand** and **Abroad** modes (§3.9) share the same column set. Both are sourced from the `AbroadAlumni` model (the page/API was renamed to **alumni-agency**): **Thailand** rows are domestic (no `country`), **Abroad** rows carry a `country` value. The model already holds `fullName`, `fullNameEn`, `workplace`, `homeAddress`, and `remarks` for both modes.

### News
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| title | String | |
| body | String | Rich text (HTML) |
| coverImageUrl | String? | Thumbnail |
| images | String[]? | In-news images (max 4) |
| status | NewsStatus | DRAFT, PUBLISHED, or DISCONTINUED |
| publishedAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### AdminUser
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| name | String | |
| email | String | Unique (CMU email) |
| passwordHash | String? | Used only for email–password testing mode |
| role | UserRole | SUPERADMIN, ADMIN, EXECUTIVE |
| isActive | Boolean | |
| lastLoginAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Session
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| userId | String? | FK → AdminUser.id (cascade delete). Null for alumni sessions. |
| alumniId | String? | FK → Alumni.id. Set when session type is ALUMNI. |
| token | String | Unique |
| sessionType | SessionType | `ADMIN` or `ALUMNI` |
| expiresAt | DateTime | |
| createdAt | DateTime | |

### ActivityLog
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| userId | String? | FK → AdminUser.id (admin who performed the action) |
| alumniId | String? | FK → Alumni.id (alumni self-action) |
| actorName | String? | Denormalized ชื่อ นามสกุล of the actor |
| actorRole | String? | ตำแหน่ง (role) of the actor |
| action | String | create, edit, update, import, export, delete, suspend |
| details | JSON | Change details (field-level old/new values, reason); shown in the details modal |
| createdAt | DateTime | |

---

## 6. Non-Functional Requirements

- **Language:** Thai primary — all UI labels, column headers, validation messages, and enum display values use Thai.
- **Calendar:** Buddhist calendar years (e.g., 2569, not 2026).
- **Responsive:** Desktop, tablet, and mobile.
- **Performance:** Tables and Excel import/export should handle up to 10,000 records without noticeable lag.
- **Security:** HTTP-only session cookies. Input sanitization on all forms. CMU OAuth for admin auth (email–password in testing mode). Alumni sign-up verification and login are rate-limited to prevent brute-force attacks.
- **File storage:** Uploaded images stored locally in `public/uploads/` with UUID filenames. Max 5 MB, PNG/JPG only, enforced at client and server. News allows 1 thumbnail + up to 4 in-news images.

---

## 7. Out of Scope (Post-MVP)

- Email notifications.
- Multi-language support (English).
- Advanced analytics dashboard.
- API for external integrations.
- Alumni-to-alumni socializing features beyond profile editing (captured as a long-term goal in §1; detailed MVP scope is profile self-service only).

---

## 8. Page Route Summary

### 8.1 Admin Routes

| Route | Auth Required | Description |
|-------|--------------|-------------|
| `/login` | Public | Login page with **Admin/Alumni toggle**. Admin uses CMU OAuth (email–password in testing) |
| `/` | Public | Main dashboard — summarized cards + line graph + latest news |
| `/news` | Public | News cards (published), 9 per page |
| `/news/[id]` | Public | Full news article |
| `/alumni-count` | Public | All-alumni table (filters: degree level, major, graduation year) + dashboard graph |
| `/awards` | Public | 3 award-type count cards + awards table |
| `/potentials` | Public | Potentials table |
| `/associations` | Public | Associations/clubs table |
| `/graduate-committee` | Public | Graduate committee table |
| `/model-representatives` | Public | Model representatives table |
| `/alumni-agency` | Public | Alumni-agency page with **Thailand/Abroad toggle** (columns now shared; Abroad adds ประเทศ) |
| `/settings/profile` | Any admin | My account — ชื่อ, นามสกุล, CMU account, ตำแหน่ง |
| `/settings/users` | Superadmin/Admin | Account management (admin/exec accounts + alumni accounts); suspend accounts, change alumni email, view alumni profile |
| `/management/alumni/[id]` | Any admin (write for edit) | Individual alumni profile view — orange edit-history indicators, edit mode, and ประวัติการเปลี่ยนแปลง toggle (replaces the old `/settings/alumni/[id]`) |
| `/settings/logs` | Superadmin/Admin/Executive | System logs — activity types incl. update/suspend; orange clickable updated values show history |
| `/settings/trash` | Superadmin exclusive | Trash bin — review/restore/hard-delete soft-deleted records |

### 8.2 Alumni Routes

| Route | Auth Required | Description |
|-------|--------------|-------------|
| `/login` (Alumni section) | Public | Alumni login (email + password) + sign-up/verification |
| TOS page | First-time alumni | Terms of Service on first login — accept to continue, or logout |
| `/alumni/profile` | Alumni session | Alumni profile view/edit (default landing after login) |
| `/alumni/news` | Alumni session | View published news created by admins (read-only) |

---

## 9. API Route Summary

All API routes are under `/api/`.

### 9.1 Auth Routes

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/api/auth/login` | POST | Public | Admin login — CMU OAuth (email–password in testing) |
| `/api/auth/cmu-login` | POST | Public | Initiate CMU OAuth login |
| `/api/auth/callback` | GET | Public | OAuth callback (admin) |
| `/api/auth/logout` | POST | Authenticated | Logout |
| `/api/alumni-auth/signup` | POST | Public | Alumni sign-up + identity verification (ชื่อ, นามสกุล, รหัสนักศึกษา, ปีที่จบ, วันเกิด). Approves + logs in if a matching record exists |
| `/api/alumni-auth/login` | POST | Public | Alumni login via email + password |
| `/api/alumni-auth/logout` | POST | Alumni session | Logout alumni |

### 9.2 Alumni Profile Routes

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/api/alumni-profile` | GET | Alumni session | Get logged-in alumni's own profile |
| `/api/alumni-profile` | PUT | Alumni session | Update logged-in alumni's own profile (editable fields only) |

### 9.3 Admin Alumni Management Routes

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/api/alumni-accounts` | GET | Admin | List all alumni who have logged in at least once (paginated, searchable) |
| `/api/alumni-accounts/[id]` | GET, PUT | Admin | View/update an alumni's profile (admins can edit `citizenId`/`birthDate`; sets `adminEditedAt` on save) |
| `/api/alumni/[id]/activity` | GET | Admin | Merged change timeline for one alumni — field-change history (alumni core `alumni`/`alumni_profile` + related rows) ∪ activity-log events; newest first (powers §3.18 data-logs toggle) |

### 9.4 Data Entity Routes (Admin)

Each entity follows the pattern: `/` (GET list / POST create), `/[id]` (GET/PUT/DELETE), `/import` (POST Excel), `/export` (GET Excel), `/bulk-delete` (POST by IDs). DELETE is a **soft delete**; `/restore` (POST) and hard-delete confirmation are superadmin-only.

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/api/alumni` | GET, POST | GET public, POST admin | List/create alumni (POST supports create-with-related for the full-form) |
| `/api/alumni/[id]` | GET, PUT, DELETE | GET public, PUT/DELETE admin | Read/update/soft-delete alumni |
| `/api/alumni/import` | POST | Admin | Import alumni from Excel |
| `/api/alumni/export` | GET | Public | Export alumni to Excel |
| `/api/alumni/bulk-delete` | POST | Admin | Soft-delete alumni by IDs |
| `/api/alumni-count` | GET | Public | Alumni counts grouped by degree level (dashboard graph + cards) |
| `/api/news` | GET, POST | GET public, POST admin | List/create news |
| `/api/news/[id]` | GET, PUT, DELETE | GET public, PUT/DELETE admin | Read/update/delete (delete → DISCONTINUED status) |
| `/api/news/bulk-delete` | POST | Admin | Bulk set news to DISCONTINUED |
| `/api/awards` | GET, POST | GET public, POST admin | List/create awards |
| `/api/awards/[id]` | PUT, DELETE | Admin | Update/soft-delete award |
| `/api/awards/import` | POST | Admin | Import awards from Excel |
| `/api/awards/export` | GET | Public | Export awards to Excel |
| `/api/awards/bulk-delete` | POST | Admin | Soft-delete awards by IDs |
| `/api/potentials` | GET, POST | GET public, POST admin | List/create potentials |
| `/api/potentials/[id]` | PUT, DELETE | Admin | Update/soft-delete potential |
| `/api/potentials/import` | POST | Admin | Import potentials from Excel |
| `/api/potentials/export` | GET | Public | Export potentials to Excel |
| `/api/potentials/bulk-delete` | POST | Admin | Soft-delete potentials by IDs |
| `/api/associations` | GET, POST | GET public, POST admin | List/create associations |
| `/api/associations/[id]` | PUT, DELETE | Admin | Update/soft-delete association |
| `/api/associations/import` | POST | Admin | Import associations from Excel |
| `/api/associations/export` | GET | Public | Export associations to Excel |
| `/api/associations/bulk-delete` | POST | Admin | Soft-delete associations by IDs |
| `/api/graduate-committee` | GET, POST | GET public, POST admin | List/create committees |
| `/api/graduate-committee/[id]` | PUT, DELETE | Admin | Update/soft-delete committee |
| `/api/graduate-committee/import` | POST | Admin | Import committees from Excel |
| `/api/graduate-committee/export` | GET | Public | Export committees to Excel |
| `/api/graduate-committee/bulk-delete` | POST | Admin | Soft-delete committees by IDs |
| `/api/model-representatives` | GET, POST | GET public, POST admin | List/create model reps |
| `/api/model-representatives/[id]` | PUT, DELETE | Admin | Update/soft-delete model rep |
| `/api/model-representatives/import` | POST | Admin | Import model reps from Excel |
| `/api/model-representatives/export` | GET | Public | Export model reps to Excel |
| `/api/model-representatives/bulk-delete` | POST | Admin | Soft-delete model reps by IDs |
| `/api/alumni-agency` | GET, POST | GET public, POST admin | List/create alumni-agency (Thailand + abroad) records |
| `/api/alumni-agency/[id]` | PUT, DELETE | Admin | Update/soft-delete alumni-agency record |
| `/api/alumni-agency/import` | POST | Admin | Import alumni-agency records from Excel |
| `/api/alumni-agency/export` | GET | Public | Export alumni-agency records to Excel |
| `/api/alumni-agency/bulk-delete` | POST | Admin | Soft-delete alumni-agency records by IDs |
| `/api/users` | GET, POST | Admin | List/create user accounts |
| `/api/users/[id]` | GET, PUT, DELETE | Admin | Read/update/delete user account |
| `/api/upload` | POST | Admin | Upload image (PNG/JPG, max 5 MB) |
| `/api/logs` | GET | Admin | Activity logs (supports `?source=alumni` filter) |
