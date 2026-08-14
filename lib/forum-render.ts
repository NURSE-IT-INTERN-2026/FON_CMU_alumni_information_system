/**
 * Plain-text → safe HTML for forum bodies. Client-safe (pure).
 *
 * Order is load-bearing: (1) HTML-escape FIRST so user text can never inject
 * tags; (2) linkify http(s) URLs on the escaped text — the href is the same
 * escaped URL, so no attribute breakout is possible; (3) newlines → <br>.
 *
 * Only `http`/`https` schemes are linkified. A bare `javascript:…` (no `//`)
 * is never matched and stays as inert escaped text. No `sanitize-html`, no
 * Tiptap — bodies are stored raw and rendered through this single helper.
 */
export function renderForumBody(text: string): string {
  // 1) HTML-escape. Backtick-free (no template literals) to avoid surprises.
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  // 2) Linkify http(s):// URLs on the escaped text. The match ends at the
  //    first whitespace or char that can't appear in a bare URL post-escape.
  //    `&quot;`/`&lt;`/`&gt;` already introduced by escaping act as natural
  //    terminators (a `>` in the original became `&gt;`), so injected markup
  //    can't sneak inside an href.
  const linkified = escaped.replace(
    /https?:\/\/[^\s<>"']+/g,
    (url) =>
      `<a href="${url}" rel="nofollow noopener noreferrer" target="_blank">${url}</a>`,
  );

  // 3) Newlines → <br /> (after escaping so the \n survives the escape pass).
  return linkified.replace(/\r?\n/g, "<br />");
}
