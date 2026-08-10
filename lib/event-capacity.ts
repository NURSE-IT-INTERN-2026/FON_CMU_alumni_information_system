/**
 * Pure capacity math for community-event RSVP. Client-safe (no Prisma) so it can
 * run on both server + client and be unit-tested.
 *
 * `capacity` = the event's max TOTAL headcount (attending alumni + their
 * guests). An ATTENDING alum with `guestCount` guests occupies `1 + guestCount`
 * seats. `null` capacity = unlimited.
 */
export function rsvpSeats(guestCount: number): number {
  return 1 + Math.max(0, Math.floor(guestCount));
}

/**
 * Would `seats` new seats on top of `otherHeadcount` (everyone already
 * attending EXCEPT this alum) fit under `capacity`? The route computes
 * `otherHeadcount` = total headcount − this alum's current attending seats
 * (0 if they aren't currently attending), so an RSVP update isn't double-counted.
 */
export function fitsCapacity(
  otherHeadcount: number,
  seats: number,
  capacity: number | null,
): boolean {
  if (capacity == null) return true;
  return otherHeadcount + seats <= capacity;
}
