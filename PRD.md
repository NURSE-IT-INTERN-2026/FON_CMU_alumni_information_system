# Product Requirements Document (PRD)
# Alumni Information System — Faculty of Nursing, Chiang Mai University (FON CMU)

**Date:** 2026-05-29
**Author:** Lead Supervisor, Faculty of Nursing CMU
**Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL

---

## 1. Overview

A web-based alumni information system for the Faculty of Nursing, Chiang Mai University. The primary purpose is for superadmin and admin roles to manage alumni data, and for executives to view that data.

---

## 2. Users & Roles

| Role | Description |
|------|-------------|
| **Superadmin** | Full CRUD on all data and user account management. |
| **Admin** | Full CRUD on all data. Can import/export Excel. |
| **Executive** | Read-only access — can view and search data but cannot add, edit, or delete anything. |

> Only CMU accounts that have been added to the system by a superadmin or admin may log in.

---

## 3. Functional Requirements

### 3.1 Authentication

- Login at `/login` using CMU account (OAuth/CMU SSO) only.
- Access is granted only if the CMU account has been pre-registered by a superadmin or admin.
- Session-based authentication with HTTP-only cookies; sessions expire after 7 days.
- Auth enforced at the API level — write endpoints require a valid admin/superadmin session.

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
- Fields: name, CMU email, role (superadmin/admin/executive), status (active/inactive).
- Only superadmin/admin can add, edit, or deactivate user accounts.
- A CMU account must exist in this list to be granted login access.

---

## 4. Access Control Summary

| Feature | Superadmin | Admin | Executive |
|---------|-----------|-------|-----------|
| View all pages | ✓ | ✓ | ✓ |
| Search data | ✓ | ✓ | ✓ |
| Export `.xlsx` | ✓ | ✓ | ✓ |
| Create / Edit / Delete records | ✓ | ✓ | ✗ |
| Import `.xlsx` | ✓ | ✓ | ✗ |
| Manage user accounts | ✓ | ✓ | ✗ |

---

## 5. Data Model

### Enums

| Enum | Values |
|------|--------|
| **DegreeLevel** | DOCTORAL, MASTER, BACHELOR, NURSING_ASSISTANT |
| **AwardType** | INTERNATIONAL, NATIONAL, LOCAL |
| **NewsStatus** | DRAFT, PUBLISHED |
| **UserRole** | SUPERADMIN, ADMIN, EXECUTIVE |

### Alumni
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String | Unique |
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
| userId | String | FK → AdminUser.id (cascade delete) |
| token | String | Unique |
| expiresAt | DateTime | |
| createdAt | DateTime | |

---

## 6. Non-Functional Requirements

- **Language:** Thai primary — all UI labels, column headers, validation messages, and enum display values use Thai.
- **Calendar:** Buddhist calendar years (e.g., 2568, not 2025).
- **Responsive:** Desktop, tablet, and mobile.
- **Performance:** Tables and Excel import/export should handle up to 10,000 records without noticeable lag.
- **Security:** HTTP-only session cookies. Input sanitization on all forms. CMU OAuth for authentication.
- **File storage:** Uploaded images stored locally in `public/uploads/` with UUID filenames. 5 MB max, PNG/JPG only, enforced at client and server.

---

## 7. Out of Scope (Post-MVP)

- Alumni self-service portal.
- Email notifications.
- Multi-language support (English).
- Advanced analytics dashboard.
- API for external integrations.

---

## 8. Page Route Summary

| Route | Auth Required | Description |
|-------|--------------|-------------|
| `/login` | Public | CMU OAuth login |
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
| `/settings/users` | Superadmin/Admin | User account management |

---

## 9. API Route Summary

All API routes are under `/api/`.

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/api/auth/login` | POST | Public | Initiate CMU OAuth login |
| `/api/auth/callback` | GET | Public | OAuth callback |
| `/api/auth/logout` | POST | Authenticated | Logout |
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
