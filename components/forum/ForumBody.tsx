"use client";

import { renderForumBody } from "@/lib/forum-render";

/**
 * Renders a forum body (plain text) as safe HTML. renderForumBody escapes
 * FIRST, then linkifies http(s) URLs, then converts newlines — so user text
 * can never inject markup. Safe to use with dangerouslySetInnerHTML here.
 */
export default function ForumBody({ text }: { text: string }) {
  return (
    <div
      className="forum-body text-sm leading-relaxed text-[var(--foreground)]"
      dangerouslySetInnerHTML={{ __html: renderForumBody(text) }}
    />
  );
}
