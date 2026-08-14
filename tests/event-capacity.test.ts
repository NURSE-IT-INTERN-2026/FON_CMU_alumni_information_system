import { describe, expect, it } from "vitest";
import { rsvpSeats, fitsCapacity } from "@/lib/event-capacity";

describe("event-capacity", () => {
  it("rsvpSeats = 1 alum + guests (clamped to >= 0)", () => {
    expect(rsvpSeats(0)).toBe(1);
    expect(rsvpSeats(3)).toBe(4);
    expect(rsvpSeats(-2)).toBe(1);
  });

  it("null capacity = unlimited (always fits)", () => {
    expect(fitsCapacity(1_000_000, 5, null)).toBe(true);
  });

  it("fitsCapacity treats exactly-full as OK, over-cap as full", () => {
    expect(fitsCapacity(0, 2, 2)).toBe(true); // 0 + 2 == capacity → fits
    expect(fitsCapacity(1, 2, 2)).toBe(false); // 1 + 2 > capacity → full
    expect(fitsCapacity(1, 1, 2)).toBe(true); // 1 + 1 == capacity → fits
    expect(fitsCapacity(2, 1, 2)).toBe(false); // 2 + 1 > capacity → full
  });
});
