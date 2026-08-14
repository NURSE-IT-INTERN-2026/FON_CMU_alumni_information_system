/**
 * Pure permission matrix for event-photo album writes (community V2).
 * A photo may be uploaded by: an ATTENDING alum, the alumni organizer, or
 * staff. Extracted so it's unit-testable independent of the DB reads.
 */
export function canUploadEventPhoto(viewer: {
  isStaff: boolean;
  alumniId?: string;
  attendingAlumniIds: string[];
  organizerAlumniId: string | null;
}): boolean {
  if (viewer.isStaff) return true;
  if (!viewer.alumniId) return false;
  if (viewer.organizerAlumniId === viewer.alumniId) return true;
  return viewer.attendingAlumniIds.includes(viewer.alumniId);
}

/** Deletion: the uploader (even post-opt-out) or staff moderation. */
export function canDeleteEventPhoto(viewer: {
  isStaff: boolean;
  alumniId?: string;
  uploaderAlumniId: string | null;
}): boolean {
  if (viewer.isStaff) return true;
  if (!viewer.alumniId || !viewer.uploaderAlumniId) return false;
  return viewer.alumniId === viewer.uploaderAlumniId;
}
