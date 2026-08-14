import { describe, expect, it } from "vitest";
import { canUploadEventPhoto, canDeleteEventPhoto } from "@/lib/event-photo-gate";
import { eventPhotoCreateSchema } from "@/lib/validations/event-photo";
import { announcementCreateSchema } from "@/lib/validations/announcement";

describe("canUploadEventPhoto — permission matrix", () => {
  const attendees = ["a-1", "a-2"];

  it("staff can always upload", () => {
    expect(canUploadEventPhoto({ isStaff: true, attendingAlumniIds: attendees, organizerAlumniId: null })).toBe(true);
  });

  it("an ATTENDING alum can upload", () => {
    expect(canUploadEventPhoto({ isStaff: false, alumniId: "a-1", attendingAlumniIds: attendees, organizerAlumniId: null })).toBe(true);
  });

  it("the alumni organizer can upload even without an RSVP", () => {
    expect(canUploadEventPhoto({ isStaff: false, alumniId: "org", attendingAlumniIds: [], organizerAlumniId: "org" })).toBe(true);
  });

  it("a non-attendee alum cannot upload", () => {
    expect(canUploadEventPhoto({ isStaff: false, alumniId: "a-9", attendingAlumniIds: attendees, organizerAlumniId: null })).toBe(false);
  });

  it("an anonymous (no alumni identity) non-staff cannot upload", () => {
    expect(canUploadEventPhoto({ isStaff: false, attendingAlumniIds: attendees, organizerAlumniId: null })).toBe(false);
  });
});

describe("canDeleteEventPhoto — uploader or staff", () => {
  it("uploader can delete (even though they may have opted out — identity is enough)", () => {
    expect(canDeleteEventPhoto({ isStaff: false, alumniId: "u", uploaderAlumniId: "u" })).toBe(true);
  });
  it("non-uploader cannot delete", () => {
    expect(canDeleteEventPhoto({ isStaff: false, alumniId: "x", uploaderAlumniId: "u" })).toBe(false);
  });
  it("staff can delete anyone's photo; orphaned uploads (null uploader) are staff-only", () => {
    expect(canDeleteEventPhoto({ isStaff: true, uploaderAlumniId: "u" })).toBe(true);
    expect(canDeleteEventPhoto({ isStaff: false, alumniId: "u", uploaderAlumniId: null })).toBe(false);
  });
});

describe("event photo + announcement zod schemas", () => {
  it("eventPhotoCreateSchema requires imageUrl, caps caption at 200", () => {
    expect(eventPhotoCreateSchema.safeParse({ imageUrl: "/uploads/x.png" }).success).toBe(true);
    expect(eventPhotoCreateSchema.safeParse({ caption: "x" }).success).toBe(false);
    expect(eventPhotoCreateSchema.safeParse({ imageUrl: "/uploads/x.png", caption: "y".repeat(201) }).success).toBe(false);
  });

  it("announcementCreateSchema requires title+body, caps lengths", () => {
    expect(announcementCreateSchema.safeParse({ title: "ประกาศ", body: "เนื้อหา" }).success).toBe(true);
    expect(announcementCreateSchema.safeParse({ title: "ประกาศ" }).success).toBe(false);
    expect(announcementCreateSchema.safeParse({ title: "x".repeat(201), body: "y" }).success).toBe(false);
    expect(
      announcementCreateSchema.safeParse({ title: "x", body: "y", pinned: true, expiresAt: "2026-12-31T23:59" }).success,
    ).toBe(true);
  });
});
