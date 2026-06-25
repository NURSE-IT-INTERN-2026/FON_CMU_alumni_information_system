import { BASE_PATH } from "@/lib/constants";

/**
 * Resolve a stored/uploaded asset path to a browser-loadable URL.
 *
 * The app is deployed under basePath "/alumni" (lib/constants.BASE_PATH), so
 * files under public/ are served at `${BASE_PATH}/...` — e.g.
 * public/uploads/x.png resolves at "/alumni/uploads/x.png". The upload route
 * (and the DB) store paths basePath-RELATIVE ("/uploads/x.png"); a raw
 * `<img src="/uploads/x.png">` therefore 404s. This prepends BASE_PATH so the
 * path resolves in the browser.
 *
 * External (http(s)://, protocol-relative //, data:, mailto:) and
 * already-prefixed paths are returned unchanged, so this is safe to wrap around
 * any image src.
 */
export function assetUrl(path: string | null | undefined): string {
  if (!path) return "";
  const p = path.trim();
  if (!p) return "";
  if (/^(https?:)?\/\//i.test(p) || p.startsWith("data:") || p.startsWith("mailto:")) return p;
  if (p.startsWith(`${BASE_PATH}/`) || p === BASE_PATH) return p;
  return `${BASE_PATH}${p.startsWith("/") ? p : `/${p}`}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Prefix BASE_PATH onto every relative uploads image src inside an HTML string.
 * Used for rich-text news bodies both when rendering (dangerouslySetInnerHTML)
 * and when loading them into the contentEditable editor, so the images resolve
 * under basePath. External srcs (https://, //, etc.) are left untouched and
 * already-prefixed srcs are not re-prefixed (idempotent).
 */
export function prefixUploadsInHtml(html: string): string {
  if (!html) return html;
  return html.replace(/(src\s*=\s*["'])(\/uploads\/)/gi, `$1${BASE_PATH}$2`);
}

/**
 * Inverse of prefixUploadsInHtml: strip the BASE_PATH prefix from uploads srcs.
 * Used when persisting the editor's working HTML back to the (basePath-relative)
 * stored form, so the DB never bakes in the deployment basePath.
 */
export function stripUploadsInHtml(html: string): string {
  if (!html) return html;
  const re = new RegExp(`(src\\s*=\\s*["'])${escapeRegExp(BASE_PATH)}(/uploads/)`, "gi");
  return html.replace(re, `$1$2`);
}
