// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import RichTextEditor, { RICH_TEXT_EXTENSIONS } from "@/components/news/RichTextEditor";

// @testing-library/react auto-cleanup relies on global afterEach; this repo runs
// vitest with globals:false, so register cleanup explicitly.
afterEach(() => cleanup());

describe("RichTextEditor", () => {
  it("mounts a Tiptap editor (ProseMirror surface) for an empty document", async () => {
    const { container } = render(<RichTextEditor value="" onChange={vi.fn()} ariaLabel="เนื้อหา" />);
    // immediatelyRender:false → the editor is created in an effect after first paint.
    await waitFor(() => {
      expect(container.querySelector(".ProseMirror")).not.toBeNull();
    });
    expect(container.querySelector(".ProseMirror")!.getAttribute("contenteditable")).toBe("true");
  });

  it("preserves text content from legacy font-size/table HTML and drops the dropped features", async () => {
    // Legacy markup an old body might contain: a px font-size span, a table, a
    // colored span, a highlight (<mark>), and a centered paragraph.
    const legacy =
      '<p>intro</p>' +
      '<p><span style="font-size:32px">big</span></p>' +
      '<p><span style="color:#ff0000">red</span></p>' +
      '<p><mark>hl</mark></p>' +
      '<p style="text-align:center">centered</p>' +
      '<table><tbody><tr><td>cell text</td></tr></tbody></table>';

    const { container } = render(<RichTextEditor value={legacy} onChange={vi.fn()} />);
    const pm = await waitFor(() => {
      const el = container.querySelector(".ProseMirror");
      if (!el) throw new Error("editor not mounted");
      return el;
    });

    const text = pm.textContent ?? "";
    // Text content survives in every case (ProseMirror descends into unknown
    // wrappers like <font>/<table> rather than dropping their text).
    expect(text).toContain("intro");
    expect(text).toContain("big");
    expect(text).toContain("red");
    expect(text).toContain("hl");
    expect(text).toContain("centered");
    expect(text).toContain("cell text");

    const html = pm.innerHTML;
    // Font-size (px) is a dropped feature → must NOT survive in the editor.
    expect(html).not.toContain("font-size");
    // Color and alignment are kept features → should survive.
    expect(html).toContain("#ff0000");
    expect(html).toContain("text-align");
    // Highlight renders as <mark> → survives.
    expect(html.toLowerCase()).toContain("<mark");
  });

  it("fires onUpdate with serialized HTML when content changes (the onChange mechanism)", () => {
    const calls: string[] = [];
    const editor = new Editor({
      extensions: RICH_TEXT_EXTENSIONS,
      content: "",
      element: document.createElement("div"),
      onUpdate: ({ editor }) => calls.push(editor.getHTML()),
    });
    editor.commands.setContent("<p>hello world</p>");
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]).toContain("hello world");
    editor.destroy();
  });
});
