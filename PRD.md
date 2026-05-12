# Product Requirements Document (PRD)
# Alumni Information System — Faculty of Nursing, Chiang Mai University (FON CMU)

**Date:** 2026-05-12
**Author:** Lead Supervisor, Faculty of Nursing CMU
**Stack:** Next.js (App Router), TypeScript, Tailwind CSS, Prisma, PostgreSQL

---

## 1. Overview

A web-based alumni information system for the Faculty of Nursing, Chiang Mai University. The primary purpose is to let authorized administrators manage alumni records at scale — importing and exporting Excel spreadsheets, viewing/filtering/sorting alumni data in tables, and performing CRUD operations. The system also serves as a public-facing portal showcasing alumni news, statistics, awards, and other highlights.

---

## 2. Users & Roles

| Role | Description |
|------|-------------|
| **Admin** | Full CRUD on alumni data, user management, content management (news, awards, etc.). Authorized personnel and faculty executives only. |
| **Public (unauthenticated)** | Can view public pages: main page, alumni count graph, awards, potentials, association/club info, graduate committee, model representatives, and abroad alumni listings. Cannot edit or access the data input page. |

---

## 3. Functional Requirements

### 3.1 Authentication & Login Page

- Login page at `/login` restricted to authorized personnel and faculty executives.
- Credentials validated against the admin user table in the database.
- Session-based authentication (secure HTTP-only cookies).
- Redirect unauthenticated users trying to access admin routes back to `/login`.
- Admin management page (see 3.12) controls who has access.

### 3.2 Main Page (Public)

- Route: `/`
- Display featured news or activities about alumni.
- Each news card shows: title, summary, cover image, publish date.
- Clicking a card navigates to the full news article page.
- Only news marked as "published" are shown.

### 3.3 Alumni News Form (Admin)

- Route: `/admin/news/new` and `/admin/news/[id]/edit`
- In-app rich-text (word processor) editor for writing news articles.
- Image upload: **1 file max per news post**, **5 MB max**, **PNG and JPG only**.
- Fields: title, body (rich text), cover image, publish status (draft/published), publish date.
- Validation: reject files over 5 MB or with non-PNG/JPG extensions before upload.
- List view at `/admin/news` with search and pagination.

### 3.4 Alumni Count Page (Public)

- Route: `/alumni-count`
- Bar chart (or similar graph) displaying alumni counts.
- **X-axis:** Initial year of enrollment (e.g., 2540, 2541, …).
- **Y-axis:** Number of alumni.
- **Grouped/stacked by degree level:**
  - ปริญญาเอก (Doctoral)
  - ปริญญาโท (Master's)
  - ปริญญาตรี (Bachelor's)
  - หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล (Nursing Assistant Certificate)
- Data sourced from the alumni database.
- Should be responsive and readable on mobile.

### 3.5 Awards Page (Public)

- Route: `/awards`
- **Circle/Pie chart** sectioned by award type:
  - รางวัลระดับนานาชาติ (International)
  - รางวัลระดับชาติ (National)
  - รางวัลระดับท้องถิ่น (Local)
- **Award table list** below the chart:
  - Columns: recipient name, award name, award type, year, description.
  - **Sortable** by any column.
  - **Searchable** by recipient name or award name.
  - **Filterable** by award type (dropdown: all / international / national / local).
  - Paginated.

### 3.6 Data Input Page (Admin)

- Route: `/admin/alumni`
- **Primary admin interface for alumni records.**
- **Table view** displaying all alumni with columns: name, student ID, degree level, initial year, graduation year, email, phone, current workplace, etc.
- **Sorting:** click column headers to sort ascending/descending.
- **Filtering:** filter by degree level, initial year range, graduation year range, etc.
- **Searching:** full-text search across name, student ID, workplace.
- **Pagination:** server-side pagination for large datasets.
- **CRUD actions:**
  - **Create:** form to add a single alumni record.
  - **Read:** click a row to view full details.
  - **Update:** edit form for an existing record.
  - **Delete:** confirm dialog before deletion.
- **Excel Import:**
  - Upload an `.xlsx` file.
  - System parses rows and bulk-inserts into the database.
  - Show a summary: how many rows imported, how many skipped (with reasons, e.g., duplicate student ID, missing required fields).
- **Excel Export:**
  - Export the current filtered/sorted view to `.xlsx`.
  - Or export all records.
  - Column headers in Thai matching the display table.

### 3.7 Potentials Page (Public)

- Route: `/potentials`
- Display a list of alumni identified as having notable potential.
- Each entry shows: name, degree, graduation year, area of expertise/potential, photo (if available).
- Searchable and paginated.

### 3.8 Association / Club Page (Public)

- Route: `/associations`
- Display information about alumni associations and clubs.
- Show positions held by alumni within associations/clubs (e.g., president, secretary, committee member).
- Display: association/club name, member name, position, term/year.
- Searchable and paginated.

### 3.9 Graduate Committee Page (Public)

- Route: `/graduate-committee`
- Display the list of graduate committee members.
- Show: name, role/position in committee, term, degree level associated.
- Searchable.

### 3.10 Model Representative Page (Public)

- Route: `/model-representatives`
- Display alumni selected as model representatives.
- Show: name, photo, year selected, degree, achievement summary.
- Searchable and paginated.

### 3.11 Abroad Alumni Page (Public)

- Route: `/abroad-alumni`
- Display alumni currently residing or working abroad.
- Show: name, degree, graduation year, country, current role/institution.
- Filterable by country/region.
- Searchable and paginated.

### 3.12 Admin Management Page (Admin)

- Route: `/admin/users`
- CRUD for admin user accounts.
- Fields: name, email, password (hashed), role, status (active/inactive).
- Only existing admins can create new admin accounts.
- Password change functionality.
- Activity log (optional for MVP): last login timestamp.

---

## 4. Data Model (Summary)

### Alumni
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| studentId | String | Unique, student ID |
| firstName | String | |
| lastName | String | |
| degreeLevel | Enum | ปริญญาเอก, ปริญญาโท, ปริญญาตรี, หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล |
| initialYear | Int | Buddhist calendar year of enrollment |
| graduationYear | Int | Buddhist calendar year of graduation |
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
| id | UUID | Primary key |
| alumniId | UUID | FK → Alumni |
| awardName | String | |
| awardType | Enum | รางวัลระดับนานาชาติ, รางวัลระดับชาติ, รางวัลระดับท้องถิ่น |
| year | Int | |
| description | String? | |

### AssociationMember
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| alumniId | UUID | FK → Alumni |
| associationName | String | |
| position | String | |
| termYear | Int | |

### GraduateCommittee
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| alumniId | UUID | FK → Alumni |
| role | String | |
| termYear | Int | |
| degreeLevel | Enum | |

### News
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| title | String | |
| body | String | Rich text (HTML or Markdown) |
| coverImageUrl | String? | |
| status | Enum | draft, published |
| publishedAt | DateTime? | |

### AdminUser
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | String | |
| email | String | Unique |
| passwordHash | String | |
| role | String | admin, superadmin |
| isActive | Boolean | |
| lastLoginAt | DateTime? | |

---

## 5. Non-Functional Requirements

- **Localization:** Thai language primary; UI labels, column headers, and validation messages in Thai.
- **Responsive:** Must work on desktop and tablet; mobile is a secondary target.
- **Performance:** Alumni table with Excel import/export should handle up to 10,000 records without noticeable lag.
- **Security:** Passwords hashed with bcrypt. HTTP-only session cookies. CSRF protection. Input sanitization on all forms.
- **File storage:** Uploaded images stored locally (public directory) or configured cloud storage. File size and type enforced at both client and server level.

---

## 6. Out of Scope (Post-MVP)

- Alumni self-service portal (alumni logging in to update their own info).
- Email notifications.
- Multi-language support (English).
- Advanced analytics dashboard.
- API for external integrations.

---

## 7. Page Route Summary

| Route | Auth | Description |
|-------|------|-------------|
| `/login` | Public | Login page |
| `/` | Public | Main page with featured news |
| `/news/[id]` | Public | Full news article |
| `/alumni-count` | Public | Alumni count graph |
| `/awards` | Public | Awards chart + table |
| `/potentials` | Public | Notable alumni list |
| `/associations` | Public | Association/club positions |
| `/graduate-committee` | Public | Graduate committee members |
| `/model-representatives` | Public | Model representatives |
| `/abroad-alumni` | Public | Alumni abroad |
| `/admin/alumni` | Admin | Alumni CRUD + Excel import/export |
| `/admin/news` | Admin | News management list |
| `/admin/news/new` | Admin | Create news |
| `/admin/news/[id]/edit` | Admin | Edit news |
| `/admin/users` | Admin | Admin user management |
