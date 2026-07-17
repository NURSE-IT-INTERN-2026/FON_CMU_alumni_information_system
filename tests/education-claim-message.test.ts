import { describe, it, expect } from "vitest";
import { claimedByOtherMessage } from "../lib/education-identity";

describe("claimedByOtherMessage", () => {
  it("alumni variant tells the user the studentId is claimed and to contact admin", () => {
    const msg = claimedByOtherMessage({ forAdmin: false });
    expect(msg).toContain("ศิษย์เก่าท่านอื่น");
    expect(msg).toContain("กรุณาติดต่อผู้ดูแลระบบ");
  });

  it("admin variant names the owning alumni so they can resolve it", () => {
    const msg = claimedByOtherMessage({
      forAdmin: true,
      ownerName: "นางสาวสมหญิง ใจดี",
    });
    expect(msg).toContain("นางสาวสมหญิง ใจดี");
    // admin resolves it themselves — no "contact admin" wording
    expect(msg).not.toContain("กรุณาติดต่อผู้ดูแลระบบ");
  });

  it("admin variant falls back to a generic owner when the name is missing", () => {
    const msg = claimedByOtherMessage({ forAdmin: true });
    expect(msg).toContain("ท่านอื่น");
  });
});
