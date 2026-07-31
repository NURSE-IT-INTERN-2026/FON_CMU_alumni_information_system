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
 * Single source of truth for rendering a news body. Sanitizes the stored HTML
 * (tag/attribute/iframe-host allowlist + a tight inline-style property
 * allowlist via `allowedStyles`) and prefixes upload srcs with basePath. Used
 * by BOTH the staff (`app/news/[id]`) and alumni (`app/graduates/(authed)/news/[id]`)
 * detail pages so the two render paths can't drift.
 *
 * Note: `style` is intentionally kept in `allowedAttributes` — sanitize-html
 * only runs `allowedStyles` on tags whose `style` attribute is allowed, so
 * removing `style` would silently strip the editor's own color/align. The
 * security comes from the per-property regexes above, not from dropping `style`.
 */
export function sanitizeNewsBody(body: string): string {
  return prefixUploadsInHtml(
    sanitizeHtml(body, {
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
    }),
  );
}
