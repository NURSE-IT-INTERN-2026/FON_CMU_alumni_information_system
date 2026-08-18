// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import FormField from "@/components/form/FormField";

describe("FormField label/aria association", () => {
  it("associates the label with a single element child (htmlFor ↔ id)", () => {
    render(
      <FormField label="ชื่อ" required>
        <input type="text" />
      </FormField>,
    );
    const input = screen.getByLabelText(/ชื่อ/) as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    const label = document.querySelector("label");
    expect(label?.getAttribute("for")).toBe(input.id);
    expect(input.id).toBeTruthy();
  });

  it("wires the error message via aria-describedby + aria-invalid + role=alert", () => {
    render(
      <FormField label="อีเมล" error="รูปแบบอีเมลไม่ถูกต้อง">
        <input type="email" />
      </FormField>,
    );
    const input = screen.getByLabelText("อีเมล") as HTMLInputElement;
    const errorId = input.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)?.textContent).toBe("รูปแบบอีเมลไม่ถูกต้อง");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("never clobbers an explicit id on the child (label points at it)", () => {
    render(
      <FormField label="นามสกุล">
        <input id="last-name" type="text" />
      </FormField>,
    );
    const input = screen.getByLabelText("นามสกุล");
    expect(input.id).toBe("last-name");
  });

  it("merges an existing aria-describedby with the error id", () => {
    render(
      <FormField label="เบอร์โทร" error="กรอกเบอร์โทร">
        <input type="tel" aria-describedby="phone-hint" />
      </FormField>,
    );
    const describedBy = (screen.getByLabelText("เบอร์โทร") as HTMLInputElement).getAttribute("aria-describedby");
    expect(describedBy).toContain("phone-hint");
    expect(describedBy).not.toBe("phone-hint");
  });

  it("no aria-invalid when there is no error", () => {
    render(
      <FormField label="คำนำหน้า">
        <input type="text" />
      </FormField>,
    );
    expect((screen.getByLabelText("คำนำหน้า") as HTMLInputElement).getAttribute("aria-invalid")).toBeNull();
  });

  it("falls back gracefully for multiple children (no association, still renders)", () => {
    const { container } = render(
      <FormField label="ที่อยู่">
        <input type="text" />
        <p className="text-xs">คำแนะนำ: กรอกบ้านเลขที่</p>
      </FormField>,
    );
    // Multiple children → no htmlFor (label not associated) but both render.
    expect(container.querySelector("label")?.getAttribute("for")).toBeNull();
    expect(container.querySelector("input")?.getAttribute("aria-invalid")).toBeNull();
    expect(container.querySelector("input")).toBeTruthy();
    expect(container.querySelector("p")?.textContent).toContain("บ้านเลขที่");
  });
});
