"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import { CharacterCount } from "@tiptap/extension-character-count";
import { Image } from "@tiptap/extension-image";
import { prefixUploadsInHtml, stripUploadsInHtml } from "@/lib/asset-url";
import { RichTextToolbar } from "@/components/news/RichTextToolbar";

// "Clean modern set" extension schema. TextStyleKit gives TextStyle + Color
// (we disable fontSize/fontFamily/lineHeight/backgroundColor — px font-size is
// intentionally dropped, which also makes legacy font-size spans degrade on
// re-edit). Image is registered read-only (no insert button) so existing inline
// images survive editing. StarterKit bundles Bold/Italic/Underline/Strike/Link/
// Heading/Lists/History.
//
// Exported so tests can exercise the exact schema headlessly (parse/serialize)
// without spinning up the React editor.
export const RICH_TEXT_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true },
  }),
  TextStyleKit.configure({
    fontSize: false,
    fontFamily: false,
    lineHeight: false,
    backgroundColor: false,
  }),
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  CharacterCount,
  Image.configure({ inline: false, allowBase64: false }),
];

export interface RichTextEditorProps {
  /**
   * Initial HTML (basePath-relative, as stored in the DB). Read ONCE at mount.
   * To load a different document (e.g. switching the news item being edited),
   * the parent must remount this component via React `key` — we deliberately
   * never re-feed `value` into the editor post-mount, so in-progress typing is
   * never clobbered.
   */
  value: string;
  /** Fired on every edit with basePath-relative HTML (ready for storage). */
  onChange: (html: string) => void;
  id?: string;
  ariaLabel?: string;
  error?: string;
  minH?: string;
}

export function RichTextEditor({
  value,
  onChange,
  id,
  ariaLabel,
  error,
  minH = "min-h-[240px]",
}: RichTextEditorProps) {
  // Stable ref so the one-time onUpdate closure always calls the latest handler.
  // Written in an effect rather than during render (the React Compiler lint
  // forbids ref writes during render); useRef(onChange) seeds the first value.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // editorProps.attributes must be Record<string, string>; id/ariaLabel are
  // optional, so add them only when provided.
  const attributes: Record<string, string> = {
    class: `${minH} rounded-b-lg border p-6 sm:p-8 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] prose prose-sm sm:prose !max-w-none ${
      error ? "border-red-400" : "border-gray-300"
    }`,
  };
  if (id) attributes.id = id;
  if (ariaLabel) attributes["aria-label"] = ariaLabel;

  const editor = useEditor({
    // SSR/App-Router safety — the admin page server-renders this client shell,
    // so create the ProseMirror view on the client only (no hydration mismatch).
    immediatelyRender: false,
    extensions: RICH_TEXT_EXTENSIONS,
    content: prefixUploadsInHtml(value || ""),
    editorProps: { attributes },
    onUpdate: ({ editor }) => {
      // Persist the storage form (basePath-relative) — the inverse of the load
      // prefixUploadsInHtml above. Storage never bakes in the deployment basePath.
      onChangeRef.current(stripUploadsInHtml(editor.getHTML()));
    },
  });

  // Live char/word count from the CharacterCount storage — replaces the page's
  // old watch("body") + stripHtml useMemo (and its React-Compiler lint disable).
  const [stats, setStats] = useState({ chars: 0, words: 0 });
  useEffect(() => {
    if (!editor) return;
    const read = () => {
      const cc = editor.storage.characterCount;
      if (cc) setStats({ chars: cc.characters(), words: cc.words() });
    };
    read();
    editor.on("update", read);
    return () => {
      editor.off("update", read);
    };
  }, [editor]);

  return (
    <div>
      {editor && <RichTextToolbar editor={editor} />}
      <EditorContent editor={editor} />
      <div className="mt-1 text-right text-xs text-gray-400">
        ตัวอักษร: {stats.chars} &nbsp;|&nbsp; คำ: {stats.words}
      </div>
    </div>
  );
}

export default RichTextEditor;
