import { describe, it, expect } from "vitest";
import type { LogAction, LogResource } from "@/lib/log-types";
import {
  FIELD_LABELS,
  LOG_ACTION_LABELS,
  LOG_ACTION_COLORS,
  LOG_RESOURCE_LABELS,
  LEGACY_RESOURCE_LABELS,
  ACTOR_ROLE_LABELS,
  ACTOR_ROLE_COLORS,
  actionLabel,
  resourceLabel,
  formatValue,
  detailRows,
  describeActivityLog,
} from "@/lib/log-detail";

const LOG_ACTIONS: LogAction[] = [
  "CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT", "BULK_DELETE",
  "SIGNUP", "LOGIN", "EMAIL_VERIFY_REQUEST", "EMAIL_VERIFY",
  "PASSWORD_RESET_REQUEST", "PASSWORD_RESET_COMPLETE", "APPROVE", "REJECT",
  "REAPPLY", "VERIFY_IDENTITY", "RESTORE", "SUSPEND", "HARD_DELETE", "LINK",
  "OPT_IN", "OPT_OUT", "REPORT", "RESOLVE", "DISMISS",
];

const LOG_RESOURCES: LogResource[] = [
  "alumni", "award", "association", "graduate_committee", "potential",
  "model_representative", "alumni_agency", "news", "user", "alumni_profile",
  "alumni_auth", "cmu_alumni", "education", "forum_topic", "forum_reply",
  "community", "content_report", "community_event", "event_rsvp", "feed_post",
  "feed_comment", "community_profile", "community_group", "group_membership",
  "job_posting", "event_photo", "announcement",
];

/** Every details key any logActivity/logImport writer has emitted (audit
 *  2026-09). A key must either get a Thai label or be hidden — never render
 *  as its raw English/camelCase self. */
const WRITTEN_DETAIL_KEYS = [
  // labeled identity / education / entity fields
  "studentId", "name", "prefix", "firstName", "lastName", "englishName",
  "email", "contactEmail", "phones", "phone", "homeAddress", "degreeLevel",
  "graduationYear", "major", "cohort", "generation", "awardName", "awardType",
  "year", "link", "imageUrl", "description", "associationName", "position",
  "recordedYear", "career", "termYear", "workplace", "country", "province",
  "title", "status", "pinnedAt", "pinned", "unpinned", "role", "remarks",
  "notes", "reason", "alumniName",
  // labeled community context + summaries
  "topicTitle", "postSnippet", "eventTitle", "groupTitle", "guestCount",
  "slug", "moderation", "resourceType", "updatedFields", "count", "search",
  "mode", "range", "merged", "dedupe", "bulk", "linkedCount", "homeMigrated",
  "entity",
  // import counts
  "fileName", "attempted", "created", "updated", "failed", "imported",
  // meta (hidden)
  "source", "sections", "sectionChanges", "changes", "action", "method",
  "errors", "errorsTruncated", "totalErrors", "op", "topicId", "postId",
  "eventId", "groupId", "reportId", "resourceId", "alumniId", "ids",
  "homeMigratedFrom", "perEntity",
];

/** A raw key is ASCII with no Thai characters — used to detect leaks. */
function hasThai(s: string): boolean {
  return /[\u0E00-\u0E7F]/.test(s);
}

describe("log label completeness", () => {
  it("labels every LogAction", () => {
    for (const a of LOG_ACTIONS) {
      expect(hasThai(LOG_ACTION_LABELS[a]), `action ${a} lacks a Thai label`).toBe(true);
      expect(actionLabel(a)).toBe(LOG_ACTION_LABELS[a]);
    }
  });

  it("labels every LogResource", () => {
    for (const r of LOG_RESOURCES) {
      expect(hasThai(LOG_RESOURCE_LABELS[r]), `resource ${r} lacks a Thai label`).toBe(true);
      expect(resourceLabel(r)).toBe(LOG_RESOURCE_LABELS[r]);
    }
  });

  it("has a color for exactly the labeled actions", () => {
    expect(Object.keys(LOG_ACTION_COLORS).sort()).toEqual(Object.keys(LOG_ACTION_LABELS).sort());
  });

  it("keeps legacy resource aliases and falls back to raw only for unknowns", () => {
    expect(resourceLabel("abroad_alumni")).toBe(LEGACY_RESOURCE_LABELS.abroad_alumni);
    expect(hasThai(resourceLabel("abroad_alumni"))).toBe(true);
    expect(actionLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
    expect(resourceLabel("something_new")).toBe("something_new");
  });
});

describe("actor role highlighting", () => {
  it("labels and colors every admin role distinctly", () => {
    for (const role of ["superadmin", "admin", "executive"]) {
      expect(hasThai(ACTOR_ROLE_LABELS[role]), `role ${role} lacks a Thai label`).toBe(true);
      expect(ACTOR_ROLE_COLORS[role], `role ${role} lacks a badge color`).toBeTruthy();
    }
    // Distinct colors so the highlight actually distinguishes roles.
    const colors = ["superadmin", "admin", "executive"].map((r) => ACTOR_ROLE_COLORS[r]);
    expect(new Set(colors).size).toBe(3);
  });
});

describe("details-key registry — no raw key ever renders", () => {
  it("gives every written key a Thai label or hides it", () => {
    for (const key of WRITTEN_DETAIL_KEYS) {
      const rows = detailRows({ [key]: "marker-value" });
      for (const row of rows) {
        expect(
          row.label !== key && hasThai(row.label),
          `details key "${key}" would render raw (got "${row.label}")`,
        ).toBe(true);
      }
    }
  });

  it("hides uuid/machine keys entirely", () => {
    const rows = detailRows({
      topicId: "uuid-1",
      postId: "uuid-2",
      eventId: "uuid-3",
      groupId: "uuid-4",
      resourceId: "uuid-5",
      ids: ["a", "b"],
      topicTitle: "วิธีลงทะเบียนพยาบาลผู้ช่วย",
    });
    expect(rows).toEqual([
      { label: FIELD_LABELS.topicTitle, value: "วิธีลงทะเบียนพยาบาลผู้ช่วย" },
    ]);
  });
});

describe("formatValue — machine values render Thai", () => {
  it("translates the merged status tokens (news + RSVP)", () => {
    expect(formatValue("status", "DRAFT")).toBe("ร่าง");
    expect(formatValue("status", "PUBLISHED")).toBe("เผยแพร่");
    expect(formatValue("status", "DISCONTINUED")).toBe("ยุติเผยแพร่");
    expect(formatValue("status", "ATTENDING")).toBe("เข้าร่วม");
    expect(formatValue("status", "DECLINED")).toBe("ไม่เข้าร่วม");
  });

  it("translates report resourceType tokens", () => {
    expect(formatValue("resourceType", "FORUM_TOPIC")).toBe("กระทู้");
    expect(formatValue("resourceType", "EVENT")).toBe("กิจกรรม");
    expect(formatValue("resourceType", "JOB_POSTING")).toBe("ประกาศงาน");
    expect(formatValue("resourceType", "EVENT_PHOTO")).toBe("รูปภาพกิจกรรม");
  });

  it("translates export modes, bulk ops, and trash entity slugs", () => {
    expect(formatValue("mode", "filtered")).toBe("ตามเงื่อนไขที่กรอง");
    expect(formatValue("mode", "selected")).toBe("รายการที่เลือก");
    expect(formatValue("bulk", "pin")).toBe("ปักหมุด");
    expect(formatValue("bulk", "publish")).toBe("เผยแพร่");
    expect(formatValue("entity", "graduate-committee")).toBe("กรรมการบัณฑิต");
    expect(formatValue("entity", "community-group")).toBe("กลุ่มศิษย์เก่า");
  });

  it("renders `pinned` as a count when numeric, a state when boolean", () => {
    expect(formatValue("pinned", 3)).toBe("3 รายการ");
    expect(formatValue("pinned", 0)).toBe("0 รายการ");
    expect(formatValue("pinned", true)).toBe("ปักหมุด");
    expect(formatValue("pinned", false)).toBe("ไม่ได้ปักหมุด");
  });

  it("joins updatedFields into a Thai list", () => {
    expect(formatValue("updatedFields", ["bio", "lineId"])).toBe("แนะนำตัว, LINE ID");
    expect(formatValue("updatedFields", ["photoUrl", "unknownField"])).toBe("รูปโปรไฟล์, unknownField");
  });

  it("renders the export row range as one sentence", () => {
    expect(formatValue("range", { start: 1, end: 50, total: 120 })).toBe("แถว 1–50 จาก 120 แถว");
    expect(formatValue("range", { start: 1 })).toBe("—");
  });
});

describe("describeActivityLog — Thai surface sentences", () => {
  it("never concatenates a raw resource or action string", () => {
    const samples: { action: LogAction; resource: LogResource }[] = [
      { action: "CREATE", resource: "forum_topic" },
      { action: "CREATE", resource: "feed_comment" },
      { action: "DELETE", resource: "group_membership" },
      { action: "EXPORT", resource: "announcement" },
      { action: "BULK_DELETE", resource: "award" },
      { action: "REPORT", resource: "forum_reply" },
      { action: "OPT_OUT", resource: "community" },
    ];
    for (const s of samples) {
      const line = describeActivityLog(s);
      expect(hasThai(line), `${s.action}/${s.resource} → "${line}"`).toBe(true);
      // No raw enum token should survive into the sentence.
      expect(line).not.toMatch(/[A-Z_]{3,}/);
    }
  });

  it("reads naturally for the standalone actions", () => {
    expect(describeActivityLog({ action: "LOGIN", resource: "user" })).toBe("เข้าสู่ระบบ");
    expect(describeActivityLog({ action: "OPT_IN", resource: "community" })).toBe("สมัครเข้าร่วม");
    expect(describeActivityLog({ action: "RESOLVE", resource: "content_report" })).toBe("ดำเนินการรายงาน");
    expect(describeActivityLog({ action: "REPORT", resource: "forum_topic" })).toBe("รายงานกระทู้");
    expect(describeActivityLog({ action: "CREATE", resource: "forum_topic" })).toBe("เพิ่มกระทู้");
  });

  it("appends the linked count for LINK logs", () => {
    expect(
      describeActivityLog({ action: "LINK", resource: "alumni", details: { linkedCount: 4 } }),
    ).toBe("เชื่อมโยงรายการที่ค้างอยู่ 4 รายการ");
  });
});
