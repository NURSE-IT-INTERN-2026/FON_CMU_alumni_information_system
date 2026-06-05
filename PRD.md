# Product Requirements Document (PRD)
# Alumni Information System — Faculty of Nursing, Chiang Mai University (FON CMU)

**Date:** 2026-05-29
**Author:** Lead Supervisor, Faculty of Nursing CMU
**Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL

---

## 1. Overview

A web-based alumni information system for the Faculty of Nursing, Chiang Mai University. The system serves two audiences:

1. **Administrators** (superadmin, admin, executive) — manage and view alumni data through the admin dashboard.
2. **Alumni** — log in to view and edit their own profile information through the alumni portal.

---

## 2. Users & Roles

### 2.1 Admin Roles

| Role | Description |
|------|-------------|
| **Superadmin** | Full CRUD on all data and user account management. |
| **Admin** | Full CRUD on all data. Can import/export Excel. |
| **Executive** | Read-only access — can view and search data but cannot add, edit, or delete anything. |

> Only CMU accounts that have been added to the system by a superadmin or admin may log in to the admin dashboard.

### 2.2 Alumni Role

| Role | Description |
|------|-------------|
| **Alumni** | Can log in to view and edit their own profile data only. No access to admin pages or other alumni's data. |

- Alumni do not need to be pre-registered by an admin. They authenticate themselves directly.
- Alumni can only view and edit the `Alumni` record linked to them. They cannot access other entities (awards, associations, etc.) or other alumni's records.

---

## 3. Functional Requirements

### 3.1 Authentication

The system supports two separate login flows:

#### 3.1.1 Admin Login

- Login at `/login` using CMU account (OAuth/CMU SSO) only.
- Access is granted only if the CMU account has been pre-registered by a superadmin or admin.
- Session-based authentication with HTTP-only cookies; sessions expire after 7 days.
- Auth enforced at the API level — write endpoints require a valid admin/superadmin session.

#### 3.1.2 Alumni Login

- Login at `/alumni/login` — the login page presents **two login methods** side by side:
  1. **CMU OAuth** — login using the alumni's CMU account via the standard CMU SSO flow.
  2. **Thai National ID + Birthday Password** — login using the alumni's Thai national ID number (13 digits) as the username, and their birthday in Buddhist calendar format as the password.
     - Password format: `DDMMYYYY` (8 digits), where the year is Buddhist calendar (e.g., `01122504` = day 01, month 12, year 2504).
     - The system matches the provided national ID and birthday against the `Alumni` record's `citizenId` and `birthDate` fields.
- **Faculty restriction:** Only alumni from the **Faculty of Nursing, Chiang Mai University** are allowed to authenticate. If the CMU OAuth response indicates the user is not affiliated with the Faculty of Nursing, login is denied with a message:
  > "บัญชีของท่านไม่ได้สังกัดคณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่ กรุณาติดต่อผู้ดูแลระบบ"
  >
  > _(Your account is not affiliated with the Faculty of Nursing, Chiang Mai University. Please contact the administrator.)_
- On successful authentication, the system looks up the `Alumni` record linked to the logged-in identity (matched by `studentId` or `citizenId`).
- If no matching `Alumni` record is found, the alumni is shown a message indicating their data is not yet in the system and they should contact the faculty.
- Alumni sessions use the same HTTP-only cookie mechanism with 7-day expiry, but carry an `ALUMNI` role to distinguish them from admin sessions.

#### 3.1.3 Alumni Profile Page (Default Landing)

- Route: `/alumni/profile`
- This is the **default page** alumni see immediately after logging in — their personal dashboard.
- The page loads the alumni's own `Alumni` record and displays it.
- **First-time login behaviour:** If the alumni's data already exists in the system (i.e., an `Alumni` record was previously imported or created by an admin), a **modal popup** appears on first login notifying the alumni:
  > "พบข้อมูลของท่านในระบบแล้ว กรุณาตรวจสอบและแก้ไขข้อมูลตามต้องการ"
  >
  > _(Your data already exists in the system. Please review and edit as you see fit.)_
- **Admin-edit notification:** If an admin has edited the alumni's profile since the alumni's last login (tracked via `adminEditedAt` field), a **modal popup** appears on the next login:
  > "ผู้ดูแลระบบได้แก้ไขข้อมูลของท่าน กรุณาตรวจสอบความถูกต้อง หากไม่ถูกต้องกรุณาติดต่อผู้ดูแลระบบ"
  >
  > _(An administrator has edited your profile. Please verify the changes for accuracy. If anything is incorrect, please contact the administrator.)_
- The modals can be dismissed, and the alumni is then shown their profile in **view mode**.

#### 3.1.4 Alumni Profile Edit Form

- The profile page has two modes: **view mode** and **edit mode**.
- In **edit mode**, the alumni can fill in or modify all editable fields of their `Alumni` record through a form (same form used for initial fill and subsequent edits).
- Fields available for alumni to edit: prefix, firstName, maidenLastName, newLastName, cohort, degreeLevel, province, email, phone, currentWorkplace, country.
- Fields **not** editable by alumni: `studentId` (read-only), `citizenId` (read-only), `birthDate` (read-only).
- Submitting the form saves the changes and switches the page back to **view mode**, displaying the updated information.
- The alumni can switch back to edit mode at any time by clicking an "แก้ไข" (Edit) button.

#### 3.1.5 Alumni Activity Logging

- All changes made by alumni to their own profile are logged in the `ActivityLog` table.
- Log entries from alumni actions include the alumni's identity (name, studentId) and a description of what was changed.
- For superadmins/admins: the activity log viewer (`/settings/logs`) includes a **filter option** to show **only alumni activities**, allowing administrators to review all changes made by alumni to their own profiles.

### 3.2 Main Page

- Route: `/`
- Displays news cards about alumni.
- Each card shows: title, cover image, publish date.
- Clicking a card navigates to the full news article at `/news/[id]`.
- Only published news is shown.

### 3.3 Alumni Count Page

- Route: `/alumni-count`
- **Line graph** with:
  - X-axis: cohort (รุ่นที่)
  - Y-axis: count of alumni
  - Grouped by degree level
- Below the graph: grouped count cards summarising totals per degree level.
- Degree levels:
  - ปริญญาเอก
  - ปริญญาโท
  - ปริญญาตรี
  - หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล
- Export to `.xlsx`.
- Superadmin/Admin: can import `.xlsx` to update data.

### 3.4 Awards Page

- Route: `/awards`
- **Doughnut graph** of award counts grouped by award type.
- Below the graph: a table with columns:
  - ลำดับ, ชื่อ-สกุล, ชื่อรางวัล, ประเภท, ปีที่ได้รับ, รายละเอียด
- Searchable, sortable, paginated.
- Export to `.xlsx`.
- Superadmin/Admin: can CRUD records and import `.xlsx`.
- Award types: รางวัลระดับนานาชาติ, รางวัลระดับชาติ, รางวัลระดับท้องถิ่น

### 3.5 Potentials Page

- Route: `/potentials`
- Table of potential alumni with columns:
  - ลำดับ, รหัสนักศึกษา, ชื่อ-สกุล, อาชีพ, ตำแหน่ง, ปีที่บันทึก
- Searchable, paginated.
- Export to `.xlsx`.
- Superadmin/Admin: can CRUD records and import `.xlsx`.

### 3.6 Association / Club Page

- Route: `/associations`
- Table of alumni in associations/clubs with columns:
  - ลำดับ, รหัสนักศึกษา, ชื่อ-สกุล, ชื่อสมาคม/ชมรม, ตำแหน่ง, ปีที่บันทึก
- Searchable, paginated.
- Export to `.xlsx`.
- Superadmin/Admin: can CRUD records and import `.xlsx`.

### 3.7 Graduate Committee Page

- Route: `/graduate-committee`
- Table of graduate committee alumni with columns:
  - ลำดับ, ปีพ.ศ., รหัสนักศึกษา, ชื่อ-สกุล, รุ่นที่, ตำแหน่ง, หมายเหตุ
- Searchable, paginated.
- Export to `.xlsx`.
- Superadmin/Admin: can CRUD records and import `.xlsx`.

### 3.8 Model Representatives Page

- Route: `/model-representatives`
- Tables of model representative alumni **grouped by representative's name**.
- Each group table contains columns:
  - รุ่นที่, รหัสนักศึกษา, ชื่อ-สกุล
- Export to `.xlsx`.
- Superadmin/Admin: can CRUD records and import `.xlsx`.

### 3.9 Abroad Alumni Page

- Route: `/abroad-alumni`
- Tables of abroad alumni **grouped by country**.
- Each group table contains columns:
  - ลำดับ, รุ่น, ชื่อ-สกุล, ชื่ออังกฤษ, สถานที่ทำงาน, หมายเหตุ
- Export to `.xlsx`.
- Superadmin/Admin: can CRUD records and import `.xlsx`.

### 3.10 News Page

- Route: `/news`
- Displays news cards; clicking a card shows full detail at `/news/[id]`.
- **WYSIWYG editor** for creating and updating news (unlike all other pages which use normal forms).
  - Toolbar: bold, italic, underline, strikethrough, ordered/unordered lists, text alignment, insert link.
  - Image upload via paste or button; stored in `public/uploads/` with UUID filenames.
  - Image constraints: 1 file per upload, 5 MB max, PNG and JPG only.
- Fields: title, body (rich-text HTML), cover image, publish status (draft/published), publish date.
- Export to `.xlsx`.
- Superadmin/Admin: can CRUD news articles.

### 3.11 User Account Management

- Exclusive page for superadmin/admin to manage app user accounts.
- The page is divided into **two tabs**:
  1. **Admin/Executive Accounts** — manage system user accounts (existing functionality).
  2. **Alumni Accounts** — list of all alumni who have authenticated (logged in) at least once.
- **Alumni Accounts tab:**
  - Displays a table of alumni with columns: ลำดับ, รหัสนักศึกษา, ชื่อ-สกุล, รุ่นที่, ระดับปริญญา, อีเมล, เบอร์โทรศัพท์, เข้าสู่ระบบล่าสุด (last login).
  - Searchable and paginated.
  - Superadmin/Admin can **click on an alumni row** to view the full alumni profile detail page at `/settings/alumni/[id]`.
  - From the alumni detail page, admins can **edit** the alumni's profile information using the same form fields available to the alumni themselves (plus `citizenId`, `birthDate` which are editable only by admins, not by alumni).
  - When an admin saves changes to an alumni profile, the `adminEditedAt` timestamp is updated, which triggers the admin-edit notification modal on the alumni's next login (see §3.1.3).
- Fields for admin/exec accounts: name, CMU email, role (superadmin/admin/executive), status (active/inactive).
- Only superadmin/admin can add, edit, or deactivate user accounts.
- A CMU account must exist in this list to be granted login access.

---

## 4. Access Control Summary

### 4.1 Admin Access

| Feature | Superadmin | Admin | Executive |
|---------|-----------|-------|-----------|
| View all pages | ✓ | ✓ | ✓ |
| Search data | ✓ | ✓ | ✓ |
| Export `.xlsx` | ✓ | ✓ | ✓ |
| Create / Edit / Delete records | ✓ | ✓ | ✗ |
| Import `.xlsx` | ✓ | ✓ | ✗ |
| Manage user accounts | ✓ | ✓ | ✗ |
| View/edit alumni profiles (from account management) | ✓ | ✓ | ✗ |
| View alumni activity logs | ✓ | ✓ | ✓ |
| Filter logs to alumni-only | ✓ | ✓ | ✓ |

### 4.2 Alumni Access

| Feature | Alumni |
|---------|--------|
| View own profile | ✓ |
| Edit own profile | ✓ |
| View other alumni's data | ✗ |
| Access admin pages | ✗ |
| Import / Export | ✗ |
| Manage user accounts | ✗ |

---

## 5. Data Model

### Enums

| Enum | Values |
|------|--------|
| **DegreeLevel** | DOCTORAL, MASTER, BACHELOR, NURSING_ASSISTANT |
| **AwardType** | INTERNATIONAL, NATIONAL, LOCAL |
| **NewsStatus** | DRAFT, PUBLISHED |
| **UserRole** | SUPERADMIN, ADMIN, EXECUTIVE |
| **SessionType** | ADMIN, ALUMNI |

### Alumni
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String | Unique |
| citizenId | String? | Thai national ID (13 digits). Used for alumni ID-password login. Unique if provided. |
| birthDate | String? | Birthday in Buddhist calendar format `DDMMYYYY` (e.g., `01122504`). Used as password for alumni ID-password login. |
| prefix | String | นางสาว, นาง, นาย, ดร., อื่นๆ |
| firstName | String | |
| maidenLastName | String | |
| newLastName | String? | After marriage |
| cohort | String? | รุ่นที่ |
| degreeLevel | DegreeLevel | |
| province | String? | |
| email | String? | |
| phone | String? | |
| currentWorkplace | String? | |
| country | String? | |
| hasLoggedIn | Boolean | Default `false`. Set to `true` after first alumni login. Used to trigger the "data already exists" modal. |
| adminEditedAt | DateTime? | Timestamp of the last edit made by an admin. When set, triggers a notification modal on the alumni's next login. Cleared after the alumni views it. |
| lastLoginAt | DateTime? | Timestamp of the alumni's most recent login. |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Award
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String? | FK → Alumni.studentId |
| recipientName | String | ชื่อ-สกุล |
| awardName | String | |
| awardType | AwardType | |
| year | Int | Buddhist year (พ.ศ.) |
| description | String? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Association
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String | FK → Alumni.studentId |
| fullName | String | |
| associationName | String | |
| position | String | |
| recordedYear | Int | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### GraduateCommittee
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| termYear | Int | ปีพ.ศ. |
| studentId | String | FK → Alumni.studentId |
| fullName | String | |
| cohort | String | รุ่นที่ |
| position | String | |
| remarks | String? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Potential
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String | FK → Alumni.studentId |
| fullName | String | |
| career | String | อาชีพ |
| position | String | ตำแหน่ง |
| recordedYear | Int | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### ModelRepresentative
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String | FK → Alumni.studentId |
| name | String | ชื่อตัวแทน (group key) |
| fullName | String | ชื่อ-สกุลศิษย์เก่า |
| cohort | String | รุ่นที่ |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### AbroadAlumni
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String | FK → Alumni.studentId |
| cohort | String | รุ่น |
| fullName | String | ชื่อ-สกุล |
| fullNameEn | String? | ชื่ออังกฤษ |
| workplace | String? | สถานที่ทำงาน |
| country | String | Group key |
| remarks | String? | |
| order | Int | Display ordering within group |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### News
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| title | String | Unique |
| body | String | Rich text (HTML) |
| coverImageUrl | String? | |
| status | NewsStatus | DRAFT or PUBLISHED |
| publishedAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### AdminUser
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| name | String | |
| email | String | Unique (CMU email) |
| role | UserRole | SUPERADMIN, ADMIN, EXECUTIVE |
| isActive | Boolean | |
| lastLoginAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Session
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| userId | String | FK → AdminUser.id (cascade delete). Null for alumni sessions. |
| alumniId | String? | FK → Alumni.id. Set when session type is ALUMNI. |
| token | String | Unique |
| sessionType | SessionType | `ADMIN` or `ALUMNI` — distinguishes admin sessions from alumni sessions. |
| expiresAt | DateTime | |
| createdAt | DateTime | |

---

## 6. Non-Functional Requirements

- **Language:** Thai primary — all UI labels, column headers, validation messages, and enum display values use Thai.
- **Calendar:** Buddhist calendar years (e.g., 2568, not 2025).
- **Responsive:** Desktop, tablet, and mobile.
- **Performance:** Tables and Excel import/export should handle up to 10,000 records without noticeable lag.
- **Security:** HTTP-only session cookies. Input sanitization on all forms. CMU OAuth for authentication. Alumni ID-password login uses rate limiting to prevent brute-force attacks on citizenId/birthDate combinations.
- **File storage:** Uploaded images stored locally in `public/uploads/` with UUID filenames. 5 MB max, PNG/JPG only, enforced at client and server.

---

## 7. Out of Scope (Post-MVP)

- Email notifications.
- Multi-language support (English).
- Advanced analytics dashboard.
- API for external integrations.
- Alumni registration (creating a new Alumni record from scratch — alumni can only edit existing records).

---

## 8. Page Route Summary

### 8.1 Admin Routes

| Route | Auth Required | Description |
|-------|--------------|-------------|
| `/login` | Public | CMU OAuth login for admin/superadmin/executive |
| `/` | Public | Main page with news cards |
| `/news` | Public | News list |
| `/news/[id]` | Public | Full news article (published only) |
| `/alumni-count` | Public | Line graph + count cards by degree level |
| `/awards` | Public | Circle graph + awards table |
| `/potentials` | Public | Potentials table |
| `/associations` | Public | Associations/clubs table |
| `/graduate-committee` | Public | Graduate committee table |
| `/model-representatives` | Public | Model reps tables grouped by name |
| `/abroad-alumni` | Public | Abroad alumni tables grouped by country |
| `/settings/users` | Superadmin/Admin | User account management (admin/exec accounts + alumni accounts tabs) |
| `/settings/alumni/[id]` | Superadmin/Admin | View/edit individual alumni profile (linked from alumni accounts tab) |
| `/settings/logs` | Superadmin/Admin/Executive | Activity logs (filterable by alumni activity) |

### 8.2 Alumni Routes

| Route | Auth Required | Description |
|-------|--------------|-------------|
| `/alumni/login` | Public | Alumni login page (CMU OAuth + Thai ID/password) |
| `/alumni/profile` | Alumni | Alumni profile view/edit (default landing after login) |

---

## 9. API Route Summary

All API routes are under `/api/`.

### 9.1 Auth Routes

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/api/auth/login` | POST | Public | Initiate CMU OAuth login (admin) |
| `/api/auth/callback` | GET | Public | OAuth callback (admin) |
| `/api/auth/logout` | POST | Authenticated | Logout |
| `/api/alumni-auth/login` | POST | Public | Alumni login via CMU OAuth (returns alumni session) |
| `/api/alumni-auth/login-id` | POST | Public | Alumni login via Thai national ID + birthday password |
| `/api/alumni-auth/callback` | GET | Public | OAuth callback for alumni CMU login |
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
| `/api/alumni-accounts/[id]` | GET, PUT | Admin | View/update an alumni's profile (admins can edit `citizenId`, `birthDate` too; sets `adminEditedAt` on save) |

### 9.4 Data Entity Routes (Admin)

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/api/alumni` | GET, POST | GET public, POST admin | List/create alumni |
| `/api/alumni/[id]` | GET, PUT, DELETE | GET public, PUT/DELETE admin | Read/update/delete alumni |
| `/api/alumni/import` | POST | Admin | Import alumni from Excel |
| `/api/alumni/export` | GET | Public | Export alumni to Excel |
| `/api/alumni-count` | GET | Public | Alumni count grouped by degree level |
| `/api/news` | GET, POST | GET public, POST admin | List/create news |
| `/api/news/[id]` | GET, PUT, DELETE | GET public, PUT/DELETE admin | Read/update/delete news |
| `/api/awards` | GET, POST | GET public, POST admin | List/create awards |
| `/api/awards/[id]` | PUT, DELETE | Admin | Update/delete award |
| `/api/awards/import` | POST | Admin | Import awards from Excel |
| `/api/awards/export` | GET | Public | Export awards to Excel |
| `/api/potentials` | GET, POST | GET public, POST admin | List/create potentials |
| `/api/potentials/[id]` | PUT, DELETE | Admin | Update/delete potential |
| `/api/potentials/import` | POST | Admin | Import potentials from Excel |
| `/api/potentials/export` | GET | Public | Export potentials to Excel |
| `/api/associations` | GET, POST | GET public, POST admin | List/create associations |
| `/api/associations/[id]` | PUT, DELETE | Admin | Update/delete association |
| `/api/associations/import` | POST | Admin | Import associations from Excel |
| `/api/associations/export` | GET | Public | Export associations to Excel |
| `/api/graduate-committee` | GET, POST | GET public, POST admin | List/create committees |
| `/api/graduate-committee/[id]` | PUT, DELETE | Admin | Update/delete committee |
| `/api/graduate-committee/import` | POST | Admin | Import committees from Excel |
| `/api/graduate-committee/export` | GET | Public | Export committees to Excel |
| `/api/model-representatives` | GET, POST | GET public, POST admin | List/create model reps |
| `/api/model-representatives/[id]` | PUT, DELETE | Admin | Update/delete model rep |
| `/api/model-representatives/import` | POST | Admin | Import model reps from Excel |
| `/api/model-representatives/export` | GET | Public | Export model reps to Excel |
| `/api/abroad-alumni` | GET, POST | GET public, POST admin | List/create abroad alumni |
| `/api/abroad-alumni/[id]` | PUT, DELETE | Admin | Update/delete abroad alumni |
| `/api/abroad-alumni/import` | POST | Admin | Import abroad alumni from Excel |
| `/api/abroad-alumni/export` | GET | Public | Export abroad alumni to Excel |
| `/api/users` | GET, POST | Admin | List/create user accounts |
| `/api/users/[id]` | GET, PUT, DELETE | Admin | Read/update/delete user account |
| `/api/upload` | POST | Admin | Upload image (PNG/JPG, max 5 MB) |
| `/api/logs` | GET | Admin | Activity logs (supports `?source=alumni` filter for alumni-only activities) |
