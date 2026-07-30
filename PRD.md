# Product Requirements Document (PRD)
# Alumni Information System — Faculty of Nursing, Chiang Mai University (FON CMU)

**Date:** 2026-05-29 (revised 2026-07-30)
**Author:** Lead Supervisor, Faculty of Nursing CMU
**Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL

> This document describes the system **as built**. It is kept in sync with the shipped product; the authoritative field-level schema is `prisma/schema.prisma`. A log of decisions that diverged from the original 2026-05-29 spec is in **§10 (Changes from the original spec)**.

---

## 1. Overview

A web-based alumni information system for the Faculty of Nursing, Chiang Mai University (FON CMU), built and maintained by the faculty's lead supervisor. It serves two audiences:

1. **Staff** (administrators) — manage alumni data through an admin workspace: filterable/sortable tables, full CRUD, Excel import/export, and a dashboard overview.
2. **Graduates** (alumni) — sign up, log in, and maintain their own profile and education records, and read news published by the faculty.

**Primary goal:** let staff display alumni data in tables that can be filtered, sorted, searched, exported, and edited (including Excel import/export), and to give each graduate a self-service account over their own record.

Two capabilities that have grown beyond the original MVP scope are now core to the product:

- **Alumni account self-service lifecycle** — graduates sign themselves up and verify email ownership, then a staff member approves the account before it can log in (§3.1.2–3.1.3).
- **CMU Registrar materialization** — the faculty's graduate universe is pulled from the CMU Registrar into a local cache on demand; the all-alumni table, dashboard counts, and facets are all built on that cache (§3.19).

> **Access policy:** there is **no public/anonymous browsing**. The system serves only the two audiences above. Every content page and data API requires an authenticated session (staff or graduate). Only the login page, sign-up, password-reset, and the authentication API endpoints are reachable without a session; an anonymous visitor sees only the login page.

---

## 2. Users & Roles

### 2.1 Staff Roles

| Role | Description |
|------|-------------|
| **Superadmin** | Full CRUD on all data; user-account management; confirms/restores/hard-deletes soft-deleted records; the only role that can delete an alumni *account* (keeping the data record) or bulk-delete logs. |
| **Admin** | Full CRUD on all data; can import/export Excel; approves/rejects/suspends alumni accounts; manages alumni email. |
| **Executive** (ผู้บริหาร) | **Read-only everywhere.** Can view, search, filter, sort, and **export** data, but cannot create/edit/delete/import/bulk-delete. Excluded from System Logs, Account Management, and CMU sync. |

> Staff authenticate via **CMU OAuth** (Microsoft Entra ID, PKCE). During development/testing, email–password login is used instead for convenience.

### 2.2 Alumni Role

| Role | Description |
|------|-------------|
| **Alumni** | Logs in with email + password. Self-registers by signing up (§3.1.2); the account is **not** usable until the graduate verifies email ownership **and** a staff member approves it. An approved alumni can view and edit only their own profile and education records. No access to admin pages or other alumni's data. |

- An alumni record does **not** need to pre-exist for someone to sign up. The graduate enters their identity at sign-up; the system captures a verification snapshot for the staff reviewer, who decides whether to approve (§3.1.3).
- An alumni can only ever view and edit the `Alumni` record linked to their account.

---

## 3. Functional Requirements

### 3.1 Authentication & Login

The login page has **two sections — Staff and Alumni** — toggled by a pair of tabs. The page auto-switches to the Alumni tab when an alumni-specific link or error brings the user there.

#### 3.1.1 Staff Login

- Staff use **CMU OAuth** to log in (email–password in testing mode).
- Access is granted only if the CMU account has been pre-registered by a superadmin/admin.
- Session-based authentication with HTTP-only cookies (`fon-cmu-session`); sessions expire after **7 days**.
- Write endpoints require a valid staff (admin/superadmin) session (`checkWritePermission`); the executive role is refused writes.

#### 3.1.2 Alumni Sign-up (two-gate)

Sign-up has **two sequential gates**: (1) email-ownership verification, then (2) staff approval. There is **no automatic approval and no auto-login** on sign-up.

- The sign-up form collects: รหัสนักศึกษา, ปีที่จบ (พ.ศ.), **ระดับการศึกษา** (select), ชื่อ / สกุล (ขณะศึกษา), วันเกิด (`ววปปปป` พ.ศ.), and the email + password the graduate will log in with.
- Submitting creates an **UNVERIFIED** account and emails a verification link (best-effort; a send failure is logged, not fatal). No session is created and the graduate is **not** logged in.
- A **verification snapshot** is stored with the account — a field-by-field comparison of the submitted data against the CMU Registrar record (with a local-database fallback when CMU has no record). This drives the staff review modal later.
- Clicking the verification link flips the account to **PENDING** and it enters the staff approval queue.
- The graduate may **resend** the verification email while still UNVERIFIED.

#### 3.1.3 Alumni Account Lifecycle & Staff Approval

Account statuses (enum `AccountStatus`): **UNVERIFIED → PENDING → ACTIVE** (usable) or **REJECTED**. Only **ACTIVE** accounts may log in; the login endpoint returns a structured 403 for UNVERIFIED (offer resend), PENDING (no action offered), and REJECTED (offer re-apply).

- **Approve** (PENDING/REJECTED → ACTIVE): creates the deferred `Education`/primary-degree records, sends an approval email.
- **Reject** (→ REJECTED): **requires a reason**; sends a rejection email containing the reason and a re-apply link. Re-approvable.
- **Re-verify** (staff action): re-fetches the CMU record and refreshes the verification snapshot.
- **Re-apply** (graduate action, REJECTED → PENDING): the graduate re-proves identity with email + password (email was already verified, so no re-verification); a corrected application re-enters the queue.
- **Forgot / reset password**: a 1-hour token is emailed to ACTIVE or REJECTED (non-suspended) accounts; resetting invalidates prior tokens and forces re-login.
- **Suspend**: toggles suspension and kills the account's active sessions.
- **Delete account** (superadmin only): nulls the login credentials but **keeps the data record** (`studentId`/name/education untouched) so the graduate can sign up again to re-test the signup email.

#### 3.1.4 First Login & Terms of Service

- On **first entry** to the alumni portal (before `tosAcceptedAt` is set), the layout redirects to a **Terms of Service (TOS)** page. The graduate must **accept** to continue; the only other choice is to **log out**.
- After accepting (and on subsequent logins), the alumni lands on **`/graduates/news`** (the news page), not the profile. The profile is reached from the sidebar.

#### 3.1.5 Alumni Profile

- The profile has **view** and **edit** modes. View order is three sections plus up to six related sections (empty sections are hidden):
  1. **ข้อมูลส่วนตัว** — คำนำหน้า, ชื่อ, นามสกุล, วันเกิด (`วว/ดด/ปปปป` พ.ศ.)
  2. **ประวัติการศึกษา** — one card per FON degree (§3.22), with the **primary (highest) degree badged**; each card offers a "ดึงจากทะเบียน" CMU lookup when adding/editing.
  3. **ข้อมูลติดต่อ** — อีเมล (เข้าสู่ระบบ), อีเมลติดต่อ, เบอร์โทรศัพท์, ที่อยู่ปัจจุบัน (`homeAddress`)
  4. Related sections (when non-empty): รางวัล, สมาคม/ชมรม, กรรมการบัณฑิต, ศักยภาพ, ผู้แทนรุ่น, ข้อมูลการทำงานศิษย์เก่า.
- **Editable** by the alumni: prefix, firstName, lastName, cohort, degreeLevel, email (login), contactEmail, phones, homeAddress, and the related sections (including alumni-agency abroad fields) and education records.
- **Read-only**: `studentId`, `citizenId`, `birthDate` (shown in a "cannot edit" block).
- **First-time data-found modal**: if the alumni's record already existed, a modal on first visit prompts them to review the auto-filled data ("พบข้อมูลของท่านในระบบแล้ว กรุณาตรวจสอบและแก้ไขข้อมูลตามต้องการ").
- **Admin-edit notification modal**: if a staff member edited the profile since the alumni's last login (tracked via `adminEditedAt`), a modal appears on next visit ("ผู้ดูแลระบบได้แก้ไขข้อมูลของท่าน …").
- **Self-delete**: the alumni may delete their own record from a danger-zone action (logs out to the login page).
- All alumni edits are written to the activity log.

### 3.2 Dashboard (แผงควบคุม)

- Route: **`/management/dashboard`** (also reached from `/` and `/management`, which redirect here).
- A summarized overview, top-to-bottom:
  1. **CMU-not-synced banner** — when the registrar cache is empty, an amber banner notes that counts reflect only locally-recorded alumni and links to the CMU sync page (§3.19).
  2. **Pending-accounts banner** — pills for รออนุมัติ / ใช้งาน / ปฏิเสธ counts, linking to the account-management page filtered to pending.
  3. **Alumni-count card** — total alumni count + **5 degree-level mini-cards** + a **line chart** (X-axis = **ปีที่จบ / graduation year**, Y-axis = count; one line per degree level, in the standard order).
  4. **Awards card** — total + 3 award-type mini-cards (ระดับท้องถิ่น / ระดับชาติ / ระดับนานาชาติ).
  5. **Five count cards** — ศักยภาพ, สมาคม/ชมรม, กรรมการบัณฑิต, ผู้แทนรุ่น, ข้อมูลการทำงานศิษย์เก่า.
  6. **Latest news** — the 3 most recent published news.
- **Counting invariant:** each **person** is counted **once**, under their **highest** degree, by merging CMU Registrar records with local records. Dashboard counts, the all-alumni table totals, and the filter facets therefore reconcile.

### 3.3 All-alumni Page (ข้อมูลนักศึกษาเก่า)

- Route: **`/management/all-alumni`** (the dashboard's graph lives on the dashboard, not here).
- Table columns (order): ลำดับ · รหัสนักศึกษา · รุ่น · คำนำหน้า · ชื่อ · นามสกุล · ระดับการศึกษา · สาขาวิชา · ปีสำเร็จการศึกษา · วันเกิด · อีเมลติดต่อ · เบอร์โทร · ที่อยู่ปัจจุบัน · หมายเหตุ · (จัดการ, write-only).
- **Filters:** ระดับการศึกษา, สาขาวิชา, ปีที่สำเร็จการศึกษา. Plus a search box (submit on Enter) and a **dedupe toggle**: แสดงวุฒิสูงสุด (one row per person, highest degree) ↔ แสดงทุกวุฒิ (one row per degree).
- **Row click** opens that alumni's profile view (§3.18). Rows whose only source is the CMU cache are edited/deleted by creating a local override (the studentId is locked on those rows).
- **Create** opens the full-form at `/management/new-alumni`. **Import / range-export / bulk-select** as in §3.11.

### 3.4 Awards Page (รางวัล)

- Route: **`/management/awards`**. Three cards show counts per award type [ระดับท้องถิ่น, ระดับชาติ, ระดับนานาชาติ].
- Table columns: รหัสนักศึกษา, สาขาวิชา, คำนำหน้า, ชื่อ, นามสกุล, ชื่อรางวัล, ประเภท, ลิงค์, รูปภาพ, รายละเอียด.
- **Image upload:** PNG/JPG only, max **5 MB** (§3.23). **Filters:** สาขาวิชา, ประเภท.

### 3.5 Potentials Page (ศักยภาพ)

- Route: **`/management/potentials`**.
- Table columns: รหัสนักศึกษา, สาขาวิชา, คำนำหน้า, ชื่อ, นามสกุล, อาชีพ, ตำแหน่ง, ปีที่บันทึก, หมายเหตุ.
- **Filters:** สาขาวิชา, อาชีพ, ตำแหน่ง, ปีที่บันทึก.

### 3.6 Association / Club Page (สมาคม/ชมรม)

- Route: **`/management/associations`**.
- Table columns: รหัสนักศึกษา, สาขาวิชา, คำนำหน้า, ชื่อ, นามสกุล, ชื่อสมาคม/ชมรม, ตำแหน่ง, ปีที่บันทึก, หมายเหตุ.
- **Filters:** ชื่อสมาคม/ชมรม, ตำแหน่ง, ปีที่บันทึก, สาขาวิชา.

### 3.7 Graduate Committee Page (กรรมการบัณฑิต)

- Route: **`/management/graduate-committee`**.
- Table columns: ปีพ.ศ., รุ่นที่, รหัสนักศึกษา, สาขาวิชา, คำนำหน้า, ชื่อ, นามสกุล, ตำแหน่ง, หมายเหตุ.
- **Filters:** ปีพ.ศ., รุ่นที่, ตำแหน่ง, สาขาวิชา.

### 3.8 Model Representative Page (ผู้แทนรุ่น)

- Route: **`/management/model-representatives`**.
- Table columns: เครือข่าย, รุ่นที่, รหัสนักศึกษา, สาขาวิชา, คำนำหน้า, ชื่อ, นามสกุล, หมายเหตุ.
- **Filters:** เครือข่าย, รุ่นที่, สาขาวิชา.
- **Field mapping (differs from sibling entities):** เครือข่าย → `cohort`, รุ่นที่ → `generation`, สาขา → `major`. The เครือข่าย is one of 5 fixed networks: ปริญญาพยาบาล, ผู้ช่วยพยาบาล, อนุปริญญาพยาบาล, ปริญญาโท, ปริญญาเอก.

#### 3.4–3.8 shared behavior

- Each related row carries a `studentId` foreign key to an alumni. When an import references a studentId that has no alumni yet, the id is parked in `pendingStudentId` and the row shows an amber **รอเชื่อมโยง** badge; it is **auto-linked** to the alumni once that alumni becomes canonical (created/approved/primary-degree changed). A toggle filters to unlinked rows only.
- In create/edit forms, entering รหัสนักศึกษา / ชื่อ / นามสกุล triggers an auto-fill dropdown that links the row to an alumni.

### 3.9 Alumni-Agency Page (ข้อมูลการทำงานศิษย์เก่า)

- Route: **`/management/alumni-agency`**.
- A **Thailand / Abroad toggle** over a **single model** (`AlumniAgency`) split by `country`: a Thailand-valued country → in-country tab; everything else → abroad tab. (The in-country tab is **not** the `alumni` table.)
- Both tabs have full CRUD + import/export + selection. Shared columns: รหัสนักศึกษา, รุ่น, สาขาวิชา, คำนำหน้า, ชื่อ-นามสกุล, ชื่ออังกฤษ, สถานที่ทำงาน, ตำแหน่ง, ที่อยู่บ้าน, หมายเหตุ. **Abroad** also shows **ประเทศ**; **Thailand** shows **จังหวัด** (required, chosen from the 77 provinces).
- **จังหวัด** is required for in-country rows and hidden for abroad; **ประเทศ** is shown for abroad and defaulted/hidden for in-country; **ตำแหน่ง** is optional on both.
- **Filters:** สถานที่ทำงาน (both), ประเทศ (abroad only).
- **`homeAddress` (ที่อยู่บ้าน) is unified** with `Alumni.homeAddress` (ที่อยู่ปัจจุบัน): the alumni's home address is the single source of truth; all of a person's linked agency rows reflect it. Editing either side shows on the all-alumni table, the alumni-agency table, and the profile.
- Unlinked rows show the รอเชื่อมโยง badge as in §3.4–3.8.

### 3.10 Filters (Behavior)

- **Non-number filters** (สาขาวิชา, อาชีพ, ตำแหน่ง, ชื่อสมาคม/ชมรม, เครือข่าย, etc.): a single scrollable panel listing **all** values, ordered by **record count descending** (ties broken alphabetically, Thai collation). The panel has its own search box to narrow the list. (Not a top-5 list, not paginated.) Each value shows a count badge.
- **Number/year filters** (ปีที่บันทึก, ปีที่สำเร็จการศึกษา, ปีพ.ศ., etc.): values listed **descending**; no count badge.
- Alumni facets merge CMU Registrar data with local records.

### 3.11 Table CRUD & Selection

Each admin data table is a **single CRUD-always-on surface** (there is no separate "management mode" toggle). Write affordances are gated on the staff role — the executive role sees them hidden and is refused by the server.

- Available actions: **add** a record, **edit** a record, **delete** (soft delete), **import** Excel, **export** Excel (with an optional row range), and **bulk-delete** by selection.
- **Add a record** opens a modal form. On the all-alumni page this is a **full-form** (at `/management/new-alumni`) that can also add related data for the other pages in one save. On the other pages, entering รหัสนักศึกษา/ชื่อ/นามสกุล triggers the alumni auto-fill/link dropdown.
- **Delete is a soft delete** — the record is marked deleted and logged for a superadmin to confirm. The superadmin can **restore** or **hard-delete** (with extra confirmation) from the Trash Bin (§3.15). *(Exception: deleting news sets its status to ยุติการเผยแพร่ and is not trash-recoverable.)*
- **Selection is opt-in and checkbox-free:** a "เลือก" button enters select mode (clicking rows toggles selection with an orange highlight and pauses row navigation); "เสร็จสิ้น" exits and clears. Selection is **global across pages** (it accumulates as the user pages around).

### 3.12 News Page (ข่าวสาร)

- Route: **`/management/news`**. Viewable by **logged-in staff and alumni** (alumni see it read-only at `/graduates/news`, §3.17); not accessible anonymously.
- Displays published news cards, newest first. Clicking a card opens the detail at `/news/[id]`. **9 cards per page.**
- **3 statuses:** ฉบับร่าง (draft), เผยแพร่ (published), ยุติการเผยแพร่ (discontinued). The create/edit form offers only ฉบับร่าง/เผยแพร่; ยุติการเผยแพร่ is reached via the dedicated ยุติ action (and "delete" means setting this status — there is no hard delete and it is not trash-recoverable).
- **Pinned news ("ประชาสัมพันธ์สำคัญ"):** a pinned item appears in a top-of-page section on both the staff and alumni news pages. Admins pin/unpin per published card and via bulk-pin (which toggles each selected published item). Only **published** news can be pinned; discontinuing clears the pin.
- **Bulk actions:** bulk-publish, bulk-pin (toggle), bulk-delete (→ discontinued). Selection on the news page is **status-locked** (one status at a time); pin/unpin keeps the selection, while publish/discontinue clears it.
- **News form / body editor:** a **Tiptap** WYSIWYG editor (bold/italic/underline/strike, H1–H3, bullet/numbered lists, 4-way alignment, link, text color, highlight, undo/redo, clear-formatting; live character/word count). A **cover/thumbnail image** is uploadable (drag-drop / click / paste, with crop+resize). There is **no inline in-news image upload** (legacy inline images in old bodies still render).
- Each image upload: PNG/JPG only, max **5 MB** (§3.23).

### 3.13 Pagination

- Each data table displays a **maximum of 10 records per page**.
- *Exceptions:* news cards = 9 per page (§3.12); the system-logs table = 20 per page.

### 3.14 Sorting

- Every sortable column header can be clicked to sort by that field, toggling ascending/descending.

### 3.15 Settings

Reached via the settings navigation:

- **ข้อมูลส่วนตัว** (`/management/settings/profile`) — the logged-in staff member's name, email/CMU account, and role.
- **จัดการผู้ใช้งาน** (`/management/settings/users`, admin+superadmin) — two tabs:
  - **บัญชีผู้ดูแลระบบ** (staff accounts): columns ชื่อ-นามสกุล, วันที่เพิ่ม, ตำแหน่ง. Create/edit (firstName/lastName/email/role). **Suspend** is superadmin-only.
  - **บัญชีศิษย์เก่า** (alumni accounts): columns รหัสนักศึกษา, ชื่อ-สกุล, รุ่นที่, ระดับปริญญา, สถานะ, อีเมล, เบอร์โทรศัพท์, เข้าสู่ระบบล่าสุด. Statuses shown are **PENDING / ACTIVE / REJECTED** (UNVERIFIED is excluded — it's a transient pre-verification state). Per-row actions: a **review modal** (the verification snapshot comparison + prior rejection history; **approve / reject [requires a reason] / re-verify**), **change email**, **suspend**, and (superadmin-only) **delete account** (keeps the data record, §3.1.3). Searching, a status filter, and pagination are provided; a pending-count banner deep-links from the dashboard.
- **บันทึกกิจกรรม** (`/management/settings/logs`, admin+superadmin) — System Logs (§3.16).
- **การดึงข้อมูล** (`/management/settings/cmu-sync`, admin+superadmin) — CMU Registrar sync (§3.19).
- **รายการที่ถูกลบ** (`/management/settings/trash`, superadmin only) — Trash Bin: review/restore/hard-delete soft-deleted records (§3.11).

> Alumni profile data is edited at **`/management/alumni/[id]`** (§3.18), reached by clicking an ACTIVE alumni row — there is no longer a separate `/settings/alumni/[id]` page.

### 3.16 System Logs

- Logs every action in a table: ชื่อ นามสกุล, ตำแหน่ง (role), กิจกรรม, รายละเอียด. 20 rows per page.
- **กิจกรรม (activity) types:** เพิ่ม (CREATE), แก้ไข (UPDATE), ลบ (DELETE), ลบหลายรายการ (BULK_DELETE), นำเข้า (IMPORT), ส่งออก (EXPORT), กู้คืน (RESTORE), ลบถาวร (HARD_DELETE), สมัครสมาชิก (SIGNUP), อนุมัติ (APPROVE), ปฏิเสธ (REJECT), ยื่นคำขอใหม่ (REAPPLY), ยืนยันตัวตน (VERIFY_IDENTITY), ขอรีเซ็ตรหัสผ่าน (PASSWORD_RESET_REQUEST), รีเซ็ตรหัสผ่าน (PASSWORD_RESET_COMPLETE), ยืนยันอีเมล (EMAIL_VERIFY), ส่งอีเมลยืนยัน (EMAIL_VERIFY_REQUEST), เชื่อมโยงรายการที่ค้างอยู่ (LINK), ระงับ (SUSPEND).
- **รายละเอียด (details):** an eye icon opens a modal explaining the change (field-level old/new values; for imports, a searchable per-record list of created/updated/failed rows).
- **Update indicators (orange values):** when a record's data is updated, each admin alumni-data page reflects it. If a change affects every page (e.g. first/last name), it shows on **every** page. The updated value renders in **orange and is clickable**; clicking opens the per-field **update history** (old → new, who, when). Indicators cover both staff edits (`alumni`) and alumni self-edits (`alumni_profile`).
- Supports filtering to alumni-only activities. Superadmin-only: bulk **hard-delete** of log entries (which is deliberately not itself logged).

### 3.17 Alumni News Page

- Alumni view published news created by staff (same card display as the staff news page, plus the pinned "ประชาสัมพันธ์สำคัญ" section), but cannot create, edit, pin, or delete news. Reached at `/graduates/news` and `/graduates/news/[id]`.

### 3.18 Admin Alumni Profile View

- Route: **`/management/alumni/[id]`** — the param accepts the alumni UUID **or** `studentId`.
- **Entry:** reached by clicking any row in the all-alumni table and every alumni-related table. Clicks on an edit/delete button, an orange value, a checkbox, or a link/image inside a row do not navigate.
- **Layout** mirrors the alumni-portal profile (§3.1.5): ข้อมูลส่วนตัว / ประวัติการศึกษา / ข้อมูลติดต่อ + the 6 related sections.
- **Orange edit-history indicators:** fields changed by staff (`resourceType: alumni`) **or** by the alumni themselves (`resourceType: alumni_profile`) render orange; clicking opens the per-field history (old → new, who, when).
- **Edit mode** (roles with write permission): edits core fields + **5 related sections** (awards, associations, graduate-committee, potentials, model-representatives) via the full-form save; **ข้อมูลการทำงานศิษย์เก่า is view-only here**. Saving sets `adminEditedAt` (which triggers the alumni-side admin-edit modal).
- **ประวัติการเปลี่ยนแปลง toggle:** switches the page to a merged change timeline — field-change history (alumni core + this alumni's related rows) ∪ activity-log events; newest first.

### 3.19 CMU Registrar Materialization & Sync

- The FON graduate universe is **materialized locally** (the `cmu_graduates` table — one row per registrar degree record, keyed by `studentId`) and **refreshed on demand** by staff from **การดึงข้อมูล** (`/management/settings/cmu-sync`). This local cache is the source for the all-alumni table, the dashboard person counts, the filter facets, and identity checks.
- The sync page **auto-compares** the local cache vs the live registrar on load (counts + new/removed samples), offers a **ดึงข้อมูล** button to upsert the full remote set, and shows two read-only comparison tables: ข้อมูลในระบบ (local cache) vs ข้อมูลล่าสุดจากทะเบียน (live, with cache-missing rows badged ใหม่).
- Until the first sync, the dashboard shows an amber "ยังไม่ได้ดึงข้อมูล CMU" banner and counts degrade to local-only.

### 3.20 Alumni-Activity Analytics

- Route: **`/management/alumni-activity`** (nav label สถิติการเข้าใช้). Read-only engagement stats.
- **3 KPI cards:** บัญชีศิษย์เก่าทั้งหมด (with active/pending/rejected pills), ศิษย์เก่าที่ใช้งานเดือนนี้ (distinct alumni who logged in this month), การเข้าสู่ระบบเดือนนี้ (login events this month).
- **2 trailing-12-month line charts** (one line per degree level): จำนวนศิษย์เก่าที่ใช้งานต่อเดือน, and จำนวนการเข้าสู่ระบบต่อเดือน (X-axis = Thai month + Buddhist-era year).
- **Engagement recency:** logged-in within 7 days, within 30 days, and suspended count.

### 3.21 Email Notifications

- The system emails graduates for: signup verification, password reset, and signup approved/rejected (the rejection email includes the reason and a re-apply link).
- Mail is sent through the **CMU Email API** (a two-step OAuth token flow → send). Bodies are **plain text with raw URLs** (the relay treats `message` as text, so HTML/tags render literally — no styled buttons). Sends are best-effort: a delivery failure is logged, not surfaced as an error to the user.

### 3.22 Education & Primary Degree

- An alumni's FON degrees are stored one row per degree (`Education`: studentId, degreeLevel, graduationYear, major, cohort, and the name at study time).
- The **primary degree** is the **highest** level (auto-derived, never set by hand) and is mirrored as a denormalized snapshot on the `Alumni` record; the 6 related tables and the all-alumni table join on it. Adding/editing/deleting any degree re-derives the primary.
- A new degree is validated for identity (its CMU birthday must match the alumni's) and must not already belong to another alumni; a CMU lookup pre-fills and warns before save.

### 3.23 Image Upload

- A single upload endpoint accepts one image at a time: **PNG/JPG only** (validated by file signature, not the reported type), **max 5 MB**, stored under `public/uploads/` with a generated filename. Requires a write-permission staff session. Used by the news cover image and the awards image fields.

---

## 4. Access Control Summary

### 4.1 Staff Access

| Feature | Superadmin | Admin | Executive |
|---------|-----------|-------|-----------|
| View all pages | ✓ | ✓ | ✓ |
| Search / filter / sort | ✓ | ✓ | ✓ |
| Export `.xlsx` | ✓ | ✓ | ✓ |
| Create / Edit / Delete (soft delete) | ✓ | ✓ | ✗ |
| Import `.xlsx` / Bulk-delete | ✓ | ✓ | ✗ |
| Approve / reject / suspend alumni accounts | ✓ | ✓ | ✗ |
| Delete an alumni *account* (keep data) | ✓ | ✗ | ✗ |
| Confirm/restore/hard-delete soft-deleted records (Trash) | ✓ | ✗ | ✗ |
| Manage staff accounts; suspend staff | ✓ | ✗ | ✗ |
| Bulk hard-delete logs | ✓ | ✗ | ✗ |
| Access System Logs / Account Mgmt / CMU sync | ✓ | ✓ | ✗ |
| View alumni activity logs / filter to alumni-only | ✓ | ✓ | ✓ |

### 4.2 Alumni Access

| Feature | Alumni |
|---------|--------|
| Sign up (verify email, then await staff approval) | ✓ |
| View / edit own profile + education | ✓ |
| Re-apply after rejection; forgot/reset password | ✓ |
| View other alumni's data | ✗ |
| Access staff pages | ✗ |
| Import / Export | ✗ |
| Manage accounts | ✗ |

---

## 5. Data Model

> Entity-level overview with key fields and relationships. The authoritative, exhaustive column list (types, nullability, indices) is `prisma/schema.prisma`.

### Enums

| Enum | Values |
|------|--------|
| **DegreeLevel** | NURSING_ASSISTANT (หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล), ASSOCIATE (อนุปริญญา), BACHELOR (ปริญญาตรี), MASTER (ปริญญาโท), DOCTORAL (ปริญญาเอก) |
| **AwardType** | LOCAL (ระดับท้องถิ่น), NATIONAL (ระดับชาติ), INTERNATIONAL (ระดับนานาชาติ) |
| **NewsStatus** | DRAFT (ฉบับร่าง), PUBLISHED (เผยแพร่), DISCONTINUED (ยุติการเผยแพร่) |
| **AccountStatus** | UNVERIFIED, PENDING, ACTIVE, REJECTED (alumni account lifecycle, §3.1.3) |
| **SessionType** | ADMIN, ALUMNI |
| **ActorType** | ADMIN, ALUMNI, SYSTEM |

### Alumni
Identity + login account for a graduate.
- **Identity:** `studentId` (unique), `citizenId`?, `birthDate`?, `prefix`/`firstName`/`lastName`.
- **Contact:** `email` (login identity, unique) **vs** `contactEmail` (contact, distinct); `phones` (list); `homeAddress` (unified contact address, §3.9).
- **Account lifecycle:** `passwordHash`?, `accountStatus`, `signupVerification` (JSON snapshot), `emailVerifiedAt`?, `rejectionReason`?/`rejectedAt`?, `suspendedAt`?, `tosAcceptedAt`?, `hasLoggedIn`, `lastLoginAt`?, `adminEditedAt`?.
- **Primary-degree snapshot** (highest, auto-derived, §3.22): `degreeLevel`, `graduationYear`, `major`, `cohort`, `primaryEducationId` → `Education`.
- **Relationships:** 1:N `Education`, `Award`, `Association`, `GraduateCommittee`, `Potential`, `ModelRepresentative`, `AlumniAgency`; soft-delete via `deletedAt`.
- *Note: workplace / country / province are **not** on `Alumni` — they live on `AlumniAgency` (§3.9, §10).*

### Education
One row per FON degree an alumni earned (`studentId` unique; one row per `(alumni, degreeLevel)`): `degreeLevel`, `graduationYear`, `major`, `cohort`, and `firstName`/`lastName` at study time. Drives the primary-degree snapshot.

### Award · Association · GraduateCommittee · Potential · ModelRepresentative
Person-name entities with split `prefix`/`firstName`/`lastName`. Each carries a **nullable** `studentId` FK to an alumni **plus** a `pendingStudentId` for unlinked rows (รอเชื่อมโยง, §3.4–3.8), and is soft-deletable. Natural-key uniqueness per entity (e.g. award name + year; association name + position + year). **ModelRepresentative** stores เครือข่าย in `cohort` and รุ่นที่ in `generation` (§3.8).

### AlumniAgency
Domestic + abroad work info (was `AbroadAlumni`). Split `prefix`/`firstName`/`lastName` (nullable) + `englishName`, `workplace`, `country`, `province` (in-country only), `position` (optional), `homeAddress` (unified with Alumni), `notes`, `order`. Nullable `studentId` FK + `pendingStudentId`. Thailand/Abroad are this one model split by `country` (§3.9).

### News
`title`, `body` (rich-text HTML), `coverImageUrl`?, `status`, `publishedAt`?, **`pinnedAt`?** (non-null ⇒ pinned into ประชาสัมพันธ์สำคัญ). *(There is no in-news `images` array — cover image only.)*

### CmuGraduate
Materialized CMU Registrar record (`studentId` unique): core identity (name/birthday/level/major/grad year) plus optional enrichment (sex, cmuit account, English name, grad date); `birthday` stored raw and normalized at read.

### AdminUser
Staff account: `firstName`/`lastName`, `email` (unique, CMU email), `passwordHash` (testing mode), `role` (superadmin/admin/executive), `isActive`.

### Session
Browser session: `token` (unique), `sessionType` (ADMIN/ALUMNI), `expiresAt`, linked to `AdminUser` (staff) and/or `Alumni` (alumni).

### ActivityLog
Audit entry: `actorType`, `userId`?/`userEmail`?/`userRole`?, `alumniId`?/`alumniName`?, `action`, `resource`/`resourceId`, `reason`?, `details` (JSON). Append-only; linked 1:N to `FieldChangeHistory`.

### FieldChangeHistory
Per-field old/new change rows (`resourceType`/`resourceId`/`field`/`oldValue`/`newValue`, actor, `reason`?, linked to an `ActivityLog`). Drives the orange update indicators (§3.16).

### PasswordReset · EmailVerification
Token tables (one row per token) for the password-reset and signup email-verification flows: `alumniId`, unique `token`, `used`, `expiresAt`.

---

## 6. Non-Functional Requirements

- **Language:** Thai primary — all UI labels, column headers, validation messages, and enum display values use Thai.
- **Calendar:** Buddhist calendar years (e.g., 2569, not 2026).
- **Responsive:** desktop, tablet, and mobile.
- **Performance:** tables and Excel import/export handle tens of thousands of records (the CMU universe is ~20k persons); read-heavy summary endpoints are short-TTL-cached.
- **Security:** HTTP-only session cookies; input validation on all forms; HTML sanitization for news bodies; CMU OAuth for staff auth (email–password in testing); rate limiting on signup, login, and password-reset endpoints; no public/anonymous access.
- **File storage:** uploaded images stored locally in `public/uploads/` with generated filenames; PNG/JPG only (signature-checked), max 5 MB, enforced at client and server; news uses a cover image only (§3.23).

---

## 7. Out of Scope (Post-MVP)

- Multi-language support (English).
- Alumni-to-alumni socializing features beyond profile self-service (a long-term goal; current MVP scope is profile + education self-service and news).
- A public/external API for third-party integrations.

*(Email notifications and an alumni-activity analytics view were previously listed here; both are now shipped — §3.20, §3.21.)*

---

## 8. Page Route Summary

> The app is deployed under **`basePath: /alumni`** — every path below is therefore served at `/alumni<route>` (e.g. `/alumni/management/dashboard`). Anonymous visitors see only `/login`; all other pages require a staff or alumni session.

### 8.1 Staff Routes

| Route | Auth | Description |
|-------|------|-------------|
| `/login` | Public | Login page (Staff/Alumni toggle). Staff use CMU OAuth (email–password in testing) |
| `/` | — | Redirects to `/management/dashboard` |
| `/management/dashboard` | Staff | Dashboard — cards, line graph, latest news (§3.2) |
| `/management/alumni-activity` | Staff | Alumni engagement analytics (§3.20) |
| `/management/all-alumni` | Staff | All-alumni table (§3.3) |
| `/management/new-alumni` | Staff (write) | Full-form alumni creation (§3.3) |
| `/management/alumni/[id]` | Staff (write to edit) | Alumni profile view — orange indicators, edit mode, ประวัติการเปลี่ยนแปลง toggle (§3.18) |
| `/management/awards` | Staff | Awards (§3.4) |
| `/management/potentials` | Staff | Potentials (§3.5) |
| `/management/associations` | Staff | Associations/clubs (§3.6) |
| `/management/graduate-committee` | Staff | Graduate committee (§3.7) |
| `/management/model-representatives` | Staff | Model representatives (§3.8) |
| `/management/alumni-agency` | Staff | Thailand/Abroad agency (§3.9) |
| `/management/news` | Staff | News cards (§3.12) |
| `/news/[id]` | Staff session | Full news article (staff see all statuses) |
| `/management/settings/profile` | Staff | My account |
| `/management/settings/users` | Admin/Superadmin | Account management — staff + alumni accounts (§3.15) |
| `/management/settings/logs` | Admin/Superadmin | System logs (§3.16) |
| `/management/settings/cmu-sync` | Admin/Superadmin | CMU Registrar sync (§3.19) |
| `/management/settings/trash` | Superadmin | Trash bin (§3.15) |

### 8.2 Alumni Routes

| Route | Auth | Description |
|-------|------|-------------|
| `/login` (Alumni tab) | Public | Alumni login (email + password) + sign-up |
| `/graduates/signup` | Public | Sign-up (§3.1.2) |
| `/graduates/verify-email` | Public | Email-verification landing |
| `/graduates/forgot-password` · `/graduates/reset-password` | Public | Password reset |
| `/graduates/reapply` | Alumni (rejected) | Re-apply after rejection (§3.1.3) |
| `/graduates/tos` | First-time alumni | Terms of Service — accept to continue, or logout (§3.1.4) |
| `/graduates/news` · `/graduates/news/[id]` | Alumni | Published news, read-only (default landing) (§3.17) |
| `/graduates/profile` | Alumni | Self profile view/edit (§3.1.5) |

---

## 9. API Route Summary

All endpoints are under `/api/` (served at `/alumni/api/...`). Every data endpoint requires a session and returns 401 to anonymous callers.

### 9.1 Auth

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/api/auth/login` | POST | Public | Staff login (CMU OAuth; email–password in testing) |
| `/api/auth/cmu-login` | POST | Public | Initiate CMU OAuth login |
| `/api/auth/callback` | GET | Public | OAuth callback |
| `/api/auth/logout` | POST | Authenticated | Staff logout |
| `/api/auth/cleanup` | GET | Secret (`CLEANUP_SECRET`) | Cron session cleanup |

### 9.2 Alumni Auth

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/api/alumni-auth/signup` | POST | Public | Sign-up → UNVERIFIED + verification email (§3.1.2) |
| `/api/alumni-auth/verify-email` | POST | Public | Verify email → PENDING |
| `/api/alumni-auth/verify-email/resend` | POST | Public | Resend verification email |
| `/api/alumni-auth/login-email` | POST | Public | Alumni login (email + password); 403 for non-ACTIVE |
| `/api/alumni-auth/logout` | POST | Public | Alumni logout |
| `/api/alumni-auth/accept-tos` | POST | Alumni | Accept TOS |
| `/api/alumni-auth/forgot-password` | POST | Public | Issue password-reset token |
| `/api/alumni-auth/reset-password` | POST | Public | Reset password with token |
| `/api/alumni-auth/reapply` · `/reapply/prepare` | POST | Alumni | Re-apply after rejection (§3.1.3) |

### 9.3 Alumni Account Management (staff)

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/api/alumni-accounts/[id]` | GET, PUT | Admin | View; change email |
| `/api/alumni-accounts/[id]/approve` | POST | Admin | PENDING/REJECTED → ACTIVE |
| `/api/alumni-accounts/[id]/reject` | POST | Admin | → REJECTED (requires `{ reason }`) |
| `/api/alumni-accounts/[id]/suspend` | POST | Admin | Toggle suspension + kill sessions |
| `/api/alumni-accounts/[id]/reverify` | POST | Admin | Refresh the verification snapshot |
| `/api/alumni-accounts/[id]/delete` | POST | Superadmin | Delete account, keep data record |

### 9.4 Alumni Self-Service

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/api/alumni-profile` | GET, PUT, DELETE | Alumni | Own profile (view/edit/self-delete) |
| `/api/alumni-profile/educations` | GET, POST | Alumni | Own education records |

### 9.5 Alumni (staff) + Education

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/api/alumni` | GET, POST | Admin | List/create alumni |
| `/api/alumni/[id]` | GET, PUT, DELETE | Admin | Read/update/soft-delete (id = UUID or studentId) |
| `/api/alumni/create-with-related` | POST | Admin | Full-form create (alumni + related) |
| `/api/alumni/update-with-related/[id]` | PUT | Admin | Full-form update (alumni + related) |
| `/api/alumni/import` · `/export` · `/bulk-delete` | POST/GET/POST | Admin | Import / merged-CMU+local export / soft-delete by IDs |
| `/api/alumni/[id]/activity` | GET | Admin | Merged change timeline (§3.18) |
| `/api/alumni/[id]/educations` | GET, POST | Admin | List/add an alumni's education |
| `/api/educations/[id]` | GET, PUT, DELETE | Admin or owning alumni | One education record (re-derives primary) |

### 9.6 Data Entities (staff) — Awards · Potentials · Associations · Graduate-Committee · Model-Representatives · Alumni-Agency

Each follows the standard pattern: `/` (GET list / POST create), `/[id]` (GET/PUT/DELETE), `/import` (POST Excel), `/export` (GET Excel), `/bulk-delete` (POST by IDs). DELETE is a **soft delete**, recoverable superadmin-only via `/api/trash/restore` (+ `/api/trash/hard-delete`). `alumni-agency` GET/export accept `?region=thailand|abroad` and `?unlinked=true`.

### 9.7 CMU Registrar

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/api/cmu-alumni` | GET | Admin | List/search the local cache |
| `/api/cmu-alumni/lookup` | GET | Admin | Single-record auto-fill preview (same-person/already-claimed warnings) |
| `/api/cmu-alumni/live` | GET | Staff | Live registrar list (for the sync compare table) |
| `/api/cmu-alumni/sync` | GET, POST | Admin (or `CMU_SYNC_SECRET`) | GET = compare; POST = materialize the full remote set (§3.19) |

### 9.8 News

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/api/news` | GET, POST | Admin | List/create (GET excludes pinned by default; `?pinned=true` for pinned only) |
| `/api/news/[id]` | GET, PUT, DELETE | Admin | DELETE → DISCONTINUED |
| `/api/news/[id]/pin` | POST | Admin | Pin/unpin toggle (published only) |
| `/api/news/bulk-publish` · `/bulk-pin` · `/bulk-delete` | POST | Admin | Bulk status actions (§3.12) |

### 9.9 Users, Upload, Logs, Aggregates

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/api/users` · `/api/users/[id]` | GET,POST / GET,PUT,DELETE | Admin/Superadmin | Staff account management |
| `/api/upload` | POST | Admin (write) | Image upload (§3.23) |
| `/api/logs` | GET | Admin | Activity logs (`?source=alumni`) |
| `/api/logs/bulk-delete` | POST | Superadmin | Hard-delete log entries |
| `/api/dashboard` | GET | Staff | Dashboard aggregate |
| `/api/alumni-count` | GET | Staff | Degree-level counts (dashboard graph + cards) |
| `/api/alumni-activity` | GET | Staff | Engagement analytics (§3.20) |
| `/api/filter-facets` | GET | Staff | Facet values for filters (§3.10) |
| `/api/field-changes` | GET | Staff | Per-field change history (orange indicators) |

---

## 10. Changes from the Original Spec

This appendix records decisions that diverge from the original 2026-05-29 spec, for traceability. The body above describes only the current (as-built) behavior.

- **Alumni sign-up** — was "auto-approve and log in if data matches a record"; now a **two-gate flow** (email-ownership verification, then staff approval), with no auto-login. *Why:* staff gatekeeping of who enters the system; the verification snapshot gives the reviewer the evidence to decide.
- **Edit "Reason" field** (the แก้ไช/อัพเดท selector) — **removed**. *Why:* it added friction with little audit value; the per-field change history and activity log already capture every edit.
- **"Management mode" toggle** — **removed**; tables are CRUD-always-on, gated by role. *Why:* with a genuine read-only role (executive), the toggle only hid affordances from users who were allowed to use them.
- **News inline images (max 4)** — **removed**; only a cover/thumbnail remains. *Why:* the editor migrated to Tiptap and inline upload was dropped (legacy inline images still render).
- **News body editor** — bespoke `execCommand` editor → **Tiptap v3** rich text.
- **Alumni profile landing** — was "lands on profile"; now lands on **news** (`/graduates/news`).
- **`/settings/alumni/[id]`** page — **deleted**; alumni profile editing is at **`/management/alumni/[id]`**.
- **`AbroadAlumni` model** → **`AlumniAgency`**; Thailand and Abroad are now one model split by `country` (the in-country tab is not the `alumni` table).
- **Alumni workplace fields** (`currentWorkplace`/`country`/`province`) — **removed from `Alumni`**; workplace/country/province live on `AlumniAgency`. `homeAddress` is unified as the single contact address (one home address per person, reflected across all surfaces).
- **CMU Registrar data** — was fetched live on every load; now **materialized locally** (`cmu_graduates`) with an admin sync page.
- **Unlinked related rows** (`pendingStudentId`) + **auto-link at canonicalization** — introduced so imports can reference alumni not yet in the system without creating stub records.
- **Pinned news** ("ประชาสัมพันธ์สำคัญ") — introduced.
- **Email notifications** and **alumni-activity analytics** — previously "post-MVP"; **now shipped** (§3.20, §3.21).
