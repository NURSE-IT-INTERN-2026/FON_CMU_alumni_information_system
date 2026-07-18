"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Toolbar button styling — carried over verbatim from the old bespoke editor so the
// authoring surface looks identical. With Tiptap we no longer need the old
// onMouseDown={e => e.preventDefault()} focus-juggling: every command chains
// `.focus()`, which restores ProseMirror's own selection.
function btnClass(active: boolean): string {
  return `rounded p-1.5 ${active ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "text-gray-600"} hover:bg-gray-200`;
}

const Divider = () => <span className="mx-1 h-5 w-px bg-gray-300" />;

interface ToolbarButtonProps {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}

function ToolbarButton({ title, active = false, onClick, children, ariaLabel }: ToolbarButtonProps) {
  return (
    <button type="button" title={title} aria-label={ariaLabel ?? title} aria-pressed={active} onClick={onClick} className={btnClass(active)}>
      {children}
    </button>
  );
}

// Inline link editor (replaces the old window.prompt). Seeds the input with the
// active link href so existing links can be edited. Empty submit removes the link.
function LinkButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const [wasOpen, setWasOpen] = useState(false);
  // Seed the input with the active link's href when the popover opens — done by
  // adjusting state during render (the repo's "adjust state when a prop changes"
  // pattern, e.g. SearchInput) rather than in an effect, which the React Compiler
  // lint forbids.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setHref((editor.getAttributes("link").href as string) ?? "");
  }

  const apply = () => {
    const url = href.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" title="แทรกลิงก์" aria-label="แทรกลิงก์" aria-pressed={editor.isActive("link")} className={btnClass(editor.isActive("link"))}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <form
          onSubmit={(e) => { e.preventDefault(); apply(); }}
          className="flex flex-col gap-2"
        >
          <label className="text-xs font-medium text-gray-600">ที่อยู่ลิงก์ (URL)</label>
          <input
            type="url"
            value={href}
            autoFocus
            placeholder="https://..."
            onChange={(e) => setHref(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
          />
          <div className="flex items-center justify-between gap-2">
            {editor.isActive("link") ? (
              <button
                type="button"
                onClick={() => { editor.chain().focus().unsetLink().run(); setOpen(false); }}
                className="text-xs text-red-600 hover:underline"
              >
                ลบลิงก์
              </button>
            ) : <span />}
            <button type="submit" className="rounded-md bg-[var(--primary)] px-3 py-1 text-sm font-medium text-white hover:opacity-90">
              ตกลง
            </button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function RichTextToolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      h1: editor.isActive("heading", { level: 1 }),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      bullet: editor.isActive("bulletList"),
      ordered: editor.isActive("orderedList"),
      alignLeft: editor.isActive({ textAlign: "left" }),
      alignCenter: editor.isActive({ textAlign: "center" }),
      alignRight: editor.isActive({ textAlign: "right" }),
      alignJustify: editor.isActive({ textAlign: "justify" }),
      highlight: editor.isActive("highlight"),
    }),
  });

  // useEditorState returns null only while the editor is null; we render the
  // toolbar only with a live editor, so `s` is defined here.
  if (!s) return null;

  return (
    <div className="flex flex-wrap items-center gap-px rounded-t-lg border border-b-0 border-gray-300 bg-gray-50 px-1.5 py-1">
      {/* Inline marks */}
      <ToolbarButton title="ตัวหนา" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /></svg>
      </ToolbarButton>
      <ToolbarButton title="ตัวเอียง" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></svg>
      </ToolbarButton>
      <ToolbarButton title="ขีดเส้นใต้" active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" /><line x1="4" y1="21" x2="20" y2="21" /></svg>
      </ToolbarButton>
      <ToolbarButton title="ขีดทับ" active={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M16 4H9a3 3 0 0 0-3 3 3 3 0 0 0 3 3h6" /><line x1="4" y1="12" x2="20" y2="12" /><path d="M15 12a3 3 0 1 1 0 6H8" /></svg>
      </ToolbarButton>

      <Divider />

      {/* Headings (H1–H3 only — we disabled H4–H6 in StarterKit) */}
      <ToolbarButton title="หัวข้อ 1" active={s.h1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <span className="px-0.5 text-xs font-bold">H1</span>
      </ToolbarButton>
      <ToolbarButton title="หัวข้อ 2" active={s.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <span className="px-0.5 text-xs font-bold">H2</span>
      </ToolbarButton>
      <ToolbarButton title="หัวข้อ 3" active={s.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <span className="px-0.5 text-xs font-bold">H3</span>
      </ToolbarButton>

      <Divider />

      {/* Lists */}
      <ToolbarButton title="รายการแบบ bullet" active={s.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" /></svg>
      </ToolbarButton>
      <ToolbarButton title="รายการแบบลำดับเลข" active={s.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><text x="3" y="8" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">1</text><text x="3" y="14" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">2</text><text x="3" y="20" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">3</text></svg>
      </ToolbarButton>

      <Divider />

      {/* Alignment */}
      <ToolbarButton title="ชิดซ้าย" active={s.alignLeft} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></svg>
      </ToolbarButton>
      <ToolbarButton title="กึ่งกลาง" active={s.alignCenter} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
      </ToolbarButton>
      <ToolbarButton title="ชิดขวา" active={s.alignRight} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" /></svg>
      </ToolbarButton>
      <ToolbarButton title="เต็มแนว" active={s.alignJustify} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
      </ToolbarButton>

      <Divider />

      {/* Text color (native color picker) */}
      <label title="สีตัวอักษร" className="relative flex cursor-pointer items-center rounded p-1.5 text-gray-600 hover:bg-gray-200">
        <span className="text-xs font-bold">A</span>
        <input
          type="color"
          defaultValue="#000000"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
      </label>
      {/* Highlight (single default color toggle) */}
      <ToolbarButton title="สีพื้นหลังข้อความ" active={s.highlight} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>
      </ToolbarButton>

      <Divider />

      {/* Link (inline popover) */}
      <LinkButton editor={editor} />

      <Divider />

      {/* History + clear formatting */}
      <ToolbarButton title="เลิกทำ" onClick={() => editor.chain().focus().undo().run()}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
      </ToolbarButton>
      <ToolbarButton title="ทำซ้ำ" onClick={() => editor.chain().focus().redo().run()}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
      </ToolbarButton>
      <ToolbarButton title="ล้างรูปแบบ" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16l9-9 8 8-4 4" /><path d="M6 11l4 4" /><line x1="17" y1="4" x2="21" y2="8" /></svg>
      </ToolbarButton>
    </div>
  );
}

export default RichTextToolbar;
