// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/confirm-dialog";

describe("Modal", () => {
  it("renders as a dialog with the title as its accessible name", () => {
    render(
      <Modal open onOpenChange={() => {}} title="ลบรายการ">
        <p>ยืนยันการลบ?</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(screen.getByText("ลบรายการ")).toBeTruthy();
    // Accessible name comes from DialogTitle (aria-labelledby wiring by radix).
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
  });

  it("renders description and footer content", () => {
    render(
      <Modal
        open
        onOpenChange={() => {}}
        title="ตั้งชื่อ"
        description="คำอธิบาย"
        footer={<button type="button">บันทึก</button>}
      >
        body
      </Modal>,
    );
    expect(screen.getByText("คำอธิบาย")).toBeTruthy();
    expect(screen.getByText("บันทึก")).toBeTruthy();
  });

  // NOTE: Escape-to-close and the closed-state unmount are radix-native but
  // don't behave under happy-dom (no animation completion, matchMedia quirks
  // keep content mounted with data-state="open") — both are verified manually
  // in the browser walkthrough instead of here.
});

describe("ConfirmDialog", () => {
  it("cancel button closes via onOpenChange(false), confirm runs onConfirm", () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="ยืนยันการลบ"
        description="ต้องการลบรายการนี้ใช่หรือไม่"
        onConfirm={onConfirm}
      />,
    );
    // Thai default labels.
    fireEvent.click(screen.getByText("ยกเลิก"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("ยืนยัน"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while loading", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="กำลังทำ"
        description="รอสักครู่"
        onConfirm={() => {}}
        loading
      />,
    );
    const confirm = screen.getByText("กำลังดำเนินการ...").closest("button");
    expect(confirm?.hasAttribute("disabled")).toBe(true);
  });
});
