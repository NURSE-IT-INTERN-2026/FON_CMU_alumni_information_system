# Product Requirements Document (PRD)
# Alumni Information System — Faculty of Nursing, Chiang Mai University (FON CMU)

**Date:** 2026-05-20
**Author:** Lead Supervisor, Faculty of Nursing CMU
**Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL

---

## 1. Overview

A web-based alumni information system for the Faculty of Nursing, Chiang Mai University. The primary purpose is to let authorized administrators manage alumni records at scale — importing and exporting Excel spreadsheets, viewing/filtering/sorting alumni data in tables, and performing CRUD operations. The system also serves as a public-facing portal showcasing alumni news, statistics, awards, and other highlights.

---

## 2. Users & Roles

| Role | Description |
|------|-------------|
| **Admin** | Full CRUD on all data (alumni, news, awards, associations, committees, potentials, model representatives, abroad alumni, users). Can import/export Excel. Authorized personnel and faculty executives only. |
| **Public (unauthenticated)** | Can view public pages: main page, alumni count graph, awards, potentials, association/club info, graduate committee, model representatives, abroad alumni listings, and individual news articles. Cannot create, edit, or delete any data. |

---

## 3. Functional Requirements

### 3.1 Authentication & Login Page

- Login page at `/login` restricted to authorized personnel and faculty executives.
- Credentials validated against the `AdminUser` table in the database.
- Session-based authentication using tokens stored in the `Session` table, with HTTP-only cookies.
- Sessions expire after 7 days.
- Passwords hashed with bcrypt.
- Admin management (see 3.13) controls who has access.
- Auth is enforced at the API level — write endpoints check for a valid session.

### 3.2 Main Page (Public)

- Route: `/`
- Display featured news or activities about alumni.
- Each news card shows: title, cover image, publish date.
- Clicking a card navigates to the full news article page (`/news/[id]`).
- Only news marked as "published" are shown.

### 3.3 News Page (Public + Admin)

- Route: `/news`
- Public: displays a searchable, paginated list of published news articles.
- Admin (when logged in): can create, edit, and delete news articles directly on this page.
- **WYSIWYG editor** built with native `contentEditable` (not a third-party library):
  - Toolbar: bold, italic, underline, strikethrough, ordered/unordered lists, text alignment (left/center/right/justify), insert link.
  - Image upload via paste or button: stored in `public/uploads/` with UUID filenames.
  - Image constraints: **1 file per upload**, **5 MB max**, **PNG and JPG only**.
- Fields: title, body (rich text HTML), cover image, publish status (draft/published), publish date.
- Validation: reject files over 5 MB or with non-PNG/JPG extensions before upload.
- Unique constraint on news title.

### 3.4 News Detail Page (Public)

- Route: `/news/[id]`
- Displays the full news article: title, cover image, formatted body (HTML), and publish date.
- Only accessible for published news — draft articles return 404.
- Date displayed in Thai Buddhist calendar format (e.g., "20 พฤษภาคม 2569").

### 3.5 Alumni Count Page (Public)

- Route: `/alumni-count`
- Bar chart displaying alumni counts.
- **X-axis:** Cohort/generation (e.g., ปริญญาตรี รุ่นที่ 1, 2, 3…).
- **Y-axis:** Number of alumni.
- **Grouped by degree level:**
  - ปริญญาเอก (Doctoral)
  - ปริญญาโท (Master's)
  - ปริญญาตรี (Bachelor's)
  - หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล (Nursing Assistant Certificate)
- Data sourced from the alumni database via API.
- Responsive and readable on mobile.

### 3.6 Awards Page (Public + Admin)

- Route: `/awards`
- **Table list** with columns: recipient name, award name, award type, year, description.
- **Searchable** by recipient name or award name.
- **Filterable** by award type (dropdown: all / international / national / local).
- **Sortable** by column headers (ascending/descending).
- **Paginated.**
- Admin: in-page creation form, inline editing, and deletion.
- Excel import and export.

### 3.7 Data Input & Alumni Management

- Alumni CRUD is accessible from every public-facing entity page (awards, associations, etc.) via in-page forms.
- Dedicated creation page at `/new-alumni` for adding a new alumni record along with all related records (awards, associations, committees, potentials, model representatives, abroad alumni) in a single form.
- **Table view** displaying all alumni with columns: prefix, name, student ID, degree level, cohort, province, email, phone, current workplace, country, etc.
- **Sorting:** click column headers to sort ascending/descending.
- **Filtering:** filter by degree level, etc.
- **Searching:** full-text search across name, student ID, workplace.
- **Pagination:** server-side pagination for large datasets.
- **Excel Import:**
  - Upload an `.xlsx` file.
  - System parses rows and bulk-inserts into the database.
  - Show a summary: how many rows imported, how many skipped (with reasons).
- **Excel Export:**
  - Export the current filtered/sorted view to `.xlsx`.
  - Column headers in Thai matching the display table.

### 3.8 Potentials Page (Public + Admin)

- Route: `/potentials`
- Display a list of alumni identified as having notable potential.
- Each entry shows: name, career, position, recorded year.
- Searchable and paginated.
- Admin: in-page creation form, inline editing, and deletion.
- Excel import and export.

### 3.9 Association / Club Page (Public + Admin)

- Route: `/associations`
- Display information about alumni associations and clubs.
- Show: association/club name, member full name, position, recorded year.
- Searchable and paginated.
- Admin: in-page creation form, inline editing, and deletion.
- Excel import and export.

### 3.10 Graduate Committee Page (Public + Admin)

- Route: `/graduate-committee`
- Display the list of graduate committee members.
- Show: name, cohort, position, term year, remarks.
- Searchable and paginated.
- Admin: in-page creation form, inline editing, and deletion.
- Excel import and export.

### 3.11 Model Representative Page (Public + Admin)

- Route: `/model-representatives`
- Display alumni selected as model representatives.
- Show: name, cohort, generation.
- Searchable and paginated.
- Admin: in-page creation form, inline editing, and deletion.
- Excel import and export.

### 3.12 Abroad Alumni Page (Public + Admin)

- Route: `/abroad-alumni`
- Display alumni currently residing or working abroad.
- Show: name, address, country, university.
- **Filterable** by country.
- Searchable and paginated.
- Admin: in-page creation form, inline editing, and deletion.
- Excel import and export.

### 3.13 Admin User Management

- Admin user CRUD via `/api/users` endpoints (no dedicated UI page yet).
- Fields: name, email, password (hashed), role (admin/superadmin), status (active/inactive).
- Only authenticated admins can create new admin accounts.
- Password change functionality via update endpoint.
- Last login timestamp tracked.

---

## 4. Data Model

### Enums

| Enum | Values |
|------|--------|
| **DegreeLevel** | DOCTORAL, MASTER, BACHELOR, NURSING_ASSISTANT |
| **AwardType** | INTERNATIONAL, NATIONAL, LOCAL |
| **NewsStatus** | DRAFT, PUBLISHED |

### Alumni
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String | Unique, student ID |
| prefix | String | Name prefix (นางสาว, นาง, นาย, ดร., อื่นๆ) |
| firstName | String | First name |
| maidenLastName | String | Maiden family name |
| newLastName | String? | New family name after marriage |
| cohort | String? | Graduation cohort/generation |
| degreeLevel | DegreeLevel | Degree level |
| province | String? | Home province |
| email | String? | |
| phone | String? | |
| currentWorkplace | String? | |
| country | String? | For abroad alumni |
| isPotential | Boolean | Flag for potentials page |
| isModelRepresentative | Boolean | Flag for model rep page |
| photoUrl | String? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Award
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String | FK → Alumni.studentId (cascade delete) |
| awardName | String | |
| awardType | AwardType | |
| year | Int | |
| description | String? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| Unique | `[studentId, awardName, year]` | |

### Association
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String | FK → Alumni.studentId (cascade delete) |
| fullName | String | |
| associationName | String | |
| position | String | |
| recordedYear | Int | |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| Unique | `[studentId, associationName, position, recordedYear]` | |

### GraduateCommittee
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| termYear | Int | |
| studentId | String | FK → Alumni.studentId (cascade delete) |
| fullName | String | |
| cohort | String | |
| position | String | |
| remarks | String? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| Unique | `[studentId, termYear, position]` | |

### Potential
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String | FK → Alumni.studentId (cascade delete) |
| fullName | String | |
| career | String | |
| position | String | |
| recordedYear | Int | |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| Unique | `[studentId, recordedYear]` | |

### ModelRepresentative
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String | FK → Alumni.studentId (cascade delete) |
| name | String | |
| cohort | String | |
| generation | Int | |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| Unique | `[studentId, cohort, generation]` | |

### AbroadAlumni
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| studentId | String | FK → Alumni.studentId (cascade delete) |
| name | String | |
| address | String? | |
| country | String | |
| university | String? | |
| order | Int | Display ordering |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| Unique | `[studentId, order]` | |

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
| email | String | Unique |
| passwordHash | String | bcrypt |
| role | String | admin, superadmin |
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

## 5. Non-Functional Requirements

- **Localization:** Thai language primary; all UI labels, column headers, and validation messages in Thai.
- **Responsive:** Works on desktop, tablet, and mobile.
- **Performance:** Alumni table with Excel import/export should handle up to 10,000 records without noticeable lag.
- **Security:** Passwords hashed with bcrypt. HTTP-only session cookies. Input sanitization on all forms.
- **File storage:** Uploaded images stored locally in `public/uploads/` with UUID filenames. File size (5 MB max) and type (PNG/JPG only) enforced at both client and server level.

---

## 6. Out of Scope (Post-MVP)

- Alumni self-service portal (alumni logging in to update their own info).
- Email notifications.
- Multi-language support (English).
- Advanced analytics dashboard.
- API for external integrations.
- Dedicated admin UI page for user management (currently API-only).

---

## 7. Page Route Summary

| Route | Auth | Description |
|-------|------|-------------|
| `/login` | Public | Login page |
| `/` | Public | Main page with featured news cards |
| `/news` | Public + Admin | News list; admin can create/edit/delete with WYSIWYG editor |
| `/news/[id]` | Public | Full news article (published only) |
| `/new-alumni` | Public + Admin | Create alumni with all related records in one form |
| `/alumni-count` | Public | Alumni count bar chart by degree level |
| `/awards` | Public + Admin | Awards table with search, filter, sort, import/export |
| `/potentials` | Public + Admin | Notable alumni list with search, import/export |
| `/associations` | Public + Admin | Association/club positions with search, import/export |
| `/graduate-committee` | Public + Admin | Graduate committee members with search, import/export |
| `/model-representatives` | Public + Admin | Model representatives with search, import/export |
| `/abroad-alumni` | Public + Admin | Alumni abroad with search, country filter, import/export |

## 8. API Route Summary

All API routes are under `/api/`.

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/api/auth/login` | POST | Public | Login |
| `/api/auth/logout` | POST | Public | Logout |
| `/api/alumni` | GET, POST | GET public, POST admin | List/create alumni |
| `/api/alumni/[id]` | GET, PUT, DELETE | GET public, PUT/DELETE admin | Read/update/delete alumni |
| `/api/alumni/create-with-related` | POST | Admin | Create alumni with all related records |
| `/api/alumni/import` | POST | Admin | Import alumni from Excel |
| `/api/alumni/export` | GET | Public | Export alumni to Excel |
| `/api/alumni-count` | GET | Public | Alumni count stats grouped by degree level |
| `/api/news` | GET, POST | GET public, POST admin | List/create news |
| `/api/news/[id]` | GET, PUT, DELETE | GET public, PUT/DELETE admin | Read/update/delete news |
| `/api/awards` | GET, POST | GET public, POST admin | List/create awards |
| `/api/awards/[id]` | PUT, DELETE | Admin | Update/delete awards |
| `/api/awards/import` | POST | Admin | Import awards from Excel |
| `/api/awards/export` | GET | Public | Export awards to Excel |
| `/api/associations` | GET, POST | GET public, POST admin | List/create associations |
| `/api/associations/[id]` | PUT, DELETE | Admin | Update/delete associations |
| `/api/associations/import` | POST | Admin | Import associations from Excel |
| `/api/associations/export` | GET | Public | Export associations to Excel |
| `/api/graduate-committee` | GET, POST | GET public, POST admin | List/create committees |
| `/api/graduate-committee/[id]` | PUT, DELETE | Admin | Update/delete committees |
| `/api/graduate-committee/import` | POST | Admin | Import committees from Excel |
| `/api/graduate-committee/export` | GET | Public | Export committees to Excel |
| `/api/potentials` | GET, POST | GET public, POST admin | List/create potentials |
| `/api/potentials/[id]` | PUT, DELETE | Admin | Update/delete potentials |
| `/api/potentials/import` | POST | Admin | Import potentials from Excel |
| `/api/potentials/export` | GET | Public | Export potentials to Excel |
| `/api/model-representatives` | GET, POST | GET public, POST admin | List/create model reps |
| `/api/model-representatives/[id]` | PUT, DELETE | Admin | Update/delete model reps |
| `/api/model-representatives/import` | POST | Admin | Import model reps from Excel |
| `/api/model-representatives/export` | GET | Public | Export model reps to Excel |
| `/api/abroad-alumni` | GET, POST | GET public, POST admin | List/create abroad alumni |
| `/api/abroad-alumni/[id]` | PUT, DELETE | Admin | Update/delete abroad alumni |
| `/api/abroad-alumni/import` | POST | Admin | Import abroad alumni from Excel |
| `/api/abroad-alumni/export` | GET | Public | Export abroad alumni to Excel |
| `/api/users` | GET, POST | Admin | List/create admin users |
| `/api/users/[id]` | GET, PUT, DELETE | Admin | Read/update/delete admin users |
| `/api/upload` | POST | Admin | Upload image (PNG/JPG, max 5 MB) |
