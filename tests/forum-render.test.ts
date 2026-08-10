import { describe, expect, it } from "vitest";
import { renderForumBody } from "@/lib/forum-render";

describe("renderForumBody — escape, linkify, <br>", () => {
  it("escapes HTML so script tags can never execute", () => {
    const out = renderForumBody("<script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("escapes img onerror payloads into inert text (no raw < tag)", () => {
    const out = renderForumBody('<img src=x onerror="alert(1)">');
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
    // The whole thing is inert element-content text — no raw `<` survives.
    expect(out).not.toContain("<");
  });

  it("neutralizes attribute-breakout via escaped quotes (no raw \")", () => {
    // A crafted payload that would try to close an attribute — the `"` is
    // escaped to &quot; first, so no attribute injection is possible.
    const out = renderForumBody('x" onmouseover="alert(1)');
    expect(out).toContain("&quot;");
    expect(out).not.toContain('"');
  });

  it("does NOT linkify javascript: URLs (no // → not matched)", () => {
    const out = renderForumBody("javascript:alert(1)");
    expect(out).not.toContain("<a ");
    expect(out).toContain("javascript:alert(1)");
  });

  it("linkifies http(s) URLs with rel/target hardening", () => {
    const out = renderForumBody("see https://cmu.ac.th/path?q=1#x for info");
    expect(out).toContain('href="https://cmu.ac.th/path?q=1#x"');
    expect(out).toContain('rel="nofollow noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });

  it("converts newlines to <br />", () => {
    expect(renderForumBody("line1\nline2")).toBe("line1<br />line2");
    expect(renderForumBody("a\r\nb")).toBe("a<br />b");
  });

  it("preserves Thai text and ampersands safely", () => {
    const out = renderForumBody("สวัสดีค่ะ Tom & Jerry");
    expect(out).toContain("สวัสดีค่ะ");
    expect(out).toContain("&amp;");
    expect(out).not.toContain("&amp;amp;"); // no double-escape
  });

  it("escapes BEFORE linkifying so markup can't sneak into an href", () => {
    // The `>` inside becomes &gt; and terminates nothing; the URL match stops
    // at whitespace. No raw `<` survives into output.
    const out = renderForumBody("https://ok.th/<b>x");
    expect(out).not.toMatch(/<b>/);
  });
});
