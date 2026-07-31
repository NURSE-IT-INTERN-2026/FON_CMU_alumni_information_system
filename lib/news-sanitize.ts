import sanitizeHtml from "sanitize-html";
import { prefixUploadsInHtml } from "@/lib/asset-url";

// Anchored value regexes for the only inline-style properties the Tiptap news
// editor emits: `color` on <span>, `background-color` on <mark> (colored
// highlight round-trip), `text-align` on p/h1-3. No url()-taking property
// (background-image / list-style-image / cursor / …) is allowlisted, so CSS-
// based data exfiltration is impossible; color values can't carry url(). Every
// other CSS property (font-size, position, z-index, opacity, transform, …) is
// stripped — text content always survives.
const COLOR_VALUE = [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\(\s*[0-9.,%\s]+\)$/i];

/**
 * The shared sanitize-html policy for news bodies: tag/attribute/iframe-host
 * allowlist + a tight inline-style property allowlist (`allowedStyles`). Used by
 * BOTH the write path (`sanitizeNewsBodyForStorage`) and the render path
 * (`sanitizeNewsBody`) so a body is sanitized at storage AND again at render
 * (defense-in-depth; sanitize-html is idempotent under these allowlists).
 *
 * Note: `style` is intentionally kept in `allowedAttributes` — sanitize-html
 * only runs `allowedStyles` on tags whose `style` attribute is allowed, so
 * removing `style` would silently strip the editor's own color/align. The
 * security comes from the per-property regexes above, not from dropping `style`.
 */
const NEWS_SANITIZE_OPTIONS = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    "img",
    "figure",
    "figcaption",
    "iframe",
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ["src", "alt", "width", "height", "class", "style"],
    iframe: ["src", "width", "height", "frameborder", "allowfullscreen"],
    "*": ["class", "style"],
  },
  allowedStyles: {
    "*": {
      color: COLOR_VALUE,
      "background-color": COLOR_VALUE,
      "text-align": [/^(left|right|center|justify)$/],
    },
  },
  allowedIframeHostnames: ["www.youtube.com", "player.vimeo.com"],
};

/**
 * Sanitize a news body for STORAGE (write path). Same policy as the render
 * path, but WITHOUT `prefixUploadsInHtml` — storage stays basePath-relative
 * (`/uploads/x.png`), and the render layer (`sanitizeNewsBody`) re-prefixes on
 * read. The editor already emits basePath-relative srcs, so this keeps storage
 * correct. Used by POST/PUT `/api/news`.
 */
export function sanitizeNewsBodyForStorage(body: string): string {
  return sanitizeHtml(body, NEWS_SANITIZE_OPTIONS);
}

/**
 * Sanitize a news body for RENDER: same policy as storage, then prefix upload
 * srcs with basePath so they resolve in the browser. Single source for BOTH the
 * staff (`app/news/[id]`) and alumni (`app/graduates/(authed)/news/[id]`)
 * detail pages so the two render paths can't drift.
 */
export function sanitizeNewsBody(body: string): string {
  return prefixUploadsInHtml(sanitizeHtml(body, NEWS_SANITIZE_OPTIONS));
}
