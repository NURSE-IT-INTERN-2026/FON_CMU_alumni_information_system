import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Named identity-select fragments — the leak surfaces for alumni identity in
 * the community features. There are exactly TWO:
 *
 * 1. SELECT_ALUMNI_PUBLIC_IDENTITY — the forum/feed/report fragment (below).
 * 2. SELECT_ALUMNI_DIRECTORY_IDENTITY — the directory-only fragment (V2) that
 *    additionally exposes the self-published CommunityProfile.
 *
 * Every forum/feed/report read selects the author through fragment 1, so
 * `Alumni` contact fields (email, contactEmail, phones, homeAddress,
 * citizenId, birthDate) can NEVER be selected — and therefore never leak to
 * other alumni or even to staff via the forum API. Staff who need the full
 * record follow a link to /management/alumni/[id] instead.
 *
 * Client-safe: only a `Prisma.AlumniSelect` type is imported (erased at build).
 * Never import `@/lib/prisma` here — that would pull the DB driver into client
 * bundles. "Standard (with photo)": prefix + name + cohort + degree + photo.
 */
export const SELECT_ALUMNI_PUBLIC_IDENTITY = {
  id: true,
  prefix: true,
  firstName: true,
  lastName: true,
  cohort: true,
  degreeLevel: true,
  photoUrl: true,
} as const satisfies Prisma.AlumniSelect;

export type AlumniPublicIdentity = {
  id: string;
  prefix: string;
  firstName: string;
  lastName: string;
  cohort: string | null;
  degreeLevel: string;
  photoUrl: string | null;
};

/**
 * The DIRECTORY leak surface — a deliberately wider fragment used ONLY by
 * `/api/directory*` (community V2). It adds `graduationYear` and the opted-in
 * alumni's SELF-PUBLISHED `CommunityProfile` (workplace, location, bio, and
 * contact links the owner chose to publish). It must NEVER appear in
 * forum/feed/report queries — those stay on SELECT_ALUMNI_PUBLIC_IDENTITY.
 * `Alumni`-level contact fields (email/contactEmail/phones/homeAddress/
 * citizenId/birthDate) are as unreachable here as in the narrow fragment;
 * `communityProfile.contactEmail` is the owner-published column, not the
 * private `Alumni.contactEmail`. Pinned by tests/forum-identity.test.ts.
 */
export const SELECT_ALUMNI_DIRECTORY_IDENTITY = {
  ...SELECT_ALUMNI_PUBLIC_IDENTITY,
  graduationYear: true,
  communityProfile: {
    select: {
      photoUrl: true,
      currentWorkplace: true,
      currentPosition: true,
      province: true,
      country: true,
      bio: true,
      contactEmail: true,
      facebookUrl: true,
      lineId: true,
      linkedinUrl: true,
      otherLink: true,
    },
  },
} as const satisfies Prisma.AlumniSelect;

/** Nullable parts of the CommunityProfile columns selected above. */
export type CommunityProfilePublic = {
  photoUrl: string | null;
  currentWorkplace: string | null;
  currentPosition: string | null;
  province: string | null;
  country: string | null;
  bio: string | null;
  contactEmail: string | null;
  facebookUrl: string | null;
  lineId: string | null;
  linkedinUrl: string | null;
  otherLink: string | null;
};

export type AlumniDirectoryIdentity = AlumniPublicIdentity & {
  graduationYear: number | null;
  communityProfile: CommunityProfilePublic | null;
};

/**
 * Display string for an alumni's public identity — "คำนำหน้า ชื่อ นามสกุล".
 * Client-safe (pure).
 */
export function formatAlumniPublicName(a: AlumniPublicIdentity): string {
  return `${a.prefix}${a.firstName} ${a.lastName}`.trim();
}
