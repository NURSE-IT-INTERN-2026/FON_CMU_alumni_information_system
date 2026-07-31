import { describe, it, expect } from "vitest";
import { sanitizeNewsBody } from "@/lib/news-sanitize";

// Regression test for security #6: the news-body `style` attribute is
// constrained to an editor-minimal allowlist (color / background-color /
// text-align) so CSS-injection (UI redressing, url() exfiltration) is blocked,
// while the Tiptap editor's own output still renders.
describe("sanitizeNewsBody (security #6 — inline-style allowlist)", () => {
  it("preserves editor-emitted styles (color + text-align)", () => {
    const out = sanitizeNewsBody(
      `<p style="text-align:center">hi</p><span style="color:#ff0000">red</span>`,
    );
    expect(out).toContain("text-align");
    expect(out).toContain("#ff0000");
    expect(out).toContain(">hi<");
    expect(out).toContain(">red<");
  });

  it("strips CSS-injection properties (position/z-index/opacity/transform/top/left), keeps text", () => {
    const out = sanitizeNewsBody(
      `<div style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;opacity:0;transform:translateX(100px)">overlay</div>`,
    );
    expect(out).toContain("overlay");
    for (const prop of [
      "position",
      "z-index",
      "opacity",
      "transform",
      "fixed",
    ]) {
      expect(out).not.toContain(prop);
    }
  });

  it("strips url()-based exfiltration (background-image)", () => {
    const out = sanitizeNewsBody(
      `<p style="background-image:url(https://evil.example/x.png)">x</p>`,
    );
    expect(out).toContain(">x<");
    expect(out).not.toContain("evil.example");
    expect(out).not.toContain("background-image");
    expect(out).not.toContain("url(");
  });

  it("strips legacy font-size but keeps allowlisted color on the same node", () => {
    const out = sanitizeNewsBody(
      `<span style="font-size:32px;color:#000000">big</span>`,
    );
    expect(out).toContain("big");
    expect(out).not.toContain("font-size");
    expect(out).toContain("#000000");
  });

  it("strips non-allowlisted color values (named colors)", () => {
    const out = sanitizeNewsBody(`<span style="color:red">r</span>`);
    expect(out).toContain(">r<");
    expect(out).not.toContain("color");
    expect(out).not.toContain("red");
  });

  it("keeps <mark> (highlight) and still drops <script>", () => {
    const out = sanitizeNewsBody(
      `<mark>hl</mark><script>alert(1)</script><p>ok</p>`,
    );
    expect(out.toLowerCase()).toContain("<mark");
    expect(out).toContain("hl");
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out).toContain("<p>ok</p>");
  });
});
