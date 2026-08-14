/**
 * Pure mentorship request state-transition rules (client-safe). The action
 * route applies these via `checkTransition` so the rules stay single-sourced
 * and unit-testable.
 */
export type MentorshipAction = "accept" | "decline" | "cancel";
export type MentorshipStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";

export interface TransitionCheck {
  ok: boolean;
  error?: string;
}

/** Who may do what: accept/decline = mentor; cancel = mentee (PENDING only). */
export function checkTransition(
  status: MentorshipStatus,
  action: MentorshipAction,
  viewerIsMentor: boolean,
  viewerIsMentee: boolean,
): TransitionCheck {
  if (action === "cancel") {
    if (!viewerIsMentee) return { ok: false, error: "เฉพาะผู้ส่งคำขอเท่านั้นที่ยกเลิกได้" };
    if (status !== "PENDING") return { ok: false, error: "ยกเลิกได้เฉพาะคำขอที่ยังรอคำตอบ" };
    return { ok: true };
  }
  if (!viewerIsMentor) return { ok: false, error: "เฉพาะพี่เลี้ยงเท่านั้นที่ดำเนินการได้" };
  if (status !== "PENDING") return { ok: false, error: "คำขอนี้ได้รับการตอบกลับแล้ว" };
  return { ok: true };
}

/** Resulting status for a valid action (assumes checkTransition passed). */
export function transitionResult(action: MentorshipAction): MentorshipStatus {
  return action === "accept" ? "ACCEPTED" : action === "decline" ? "DECLINED" : "CANCELLED";
}
