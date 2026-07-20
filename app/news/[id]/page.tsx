import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import sanitizeHtml from "sanitize-html";
import prisma from "@/lib/prisma";
import { assetUrl, prefixUploadsInHtml } from "@/lib/asset-url";
import { getSession } from "@/lib/auth";

function formatThaiDate(date: Date): string {
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // No public/anonymous browsing (PRD §1/§3.12): the staff news detail page is
  // staff-only — alumni read news at /graduates/news/[id]. getSession() returns
  // only ADMIN sessions; redirect unauthenticated/expired visitors to login
  // (proxy.ts already cookie-gates this route, this is defense-in-depth). Staff
  // can preview any status (DRAFT/DISCONTINUED cards render instead of 404ing).
  const adminSession = await getSession();
  if (!adminSession) {
    redirect("/login");
  }

  const news = await prisma.news.findUnique({
    where: { id },
  });

  if (!news) {
    notFound();
  }

  // The read-only "executive" role sees news the way alumni do — published
  // only. Admins/superadmins still preview DRAFT/DISCONTINUED here.
  if (adminSession.user.role === "executive" && news!.status !== "PUBLISHED") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/management/news"
        className="mb-6 inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-light)]"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
          />
        </svg>
        กลับไปหน้าข่าวสาร
      </Link>

      <article className="overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="px-6 pt-6 sm:px-8 sm:pt-8">
          <h1 className="mb-3 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
            {news.title}
          </h1>
          <p className="mb-6 text-sm text-[var(--muted)]">
            {news.publishedAt ? formatThaiDate(new Date(news.publishedAt)) : ""}
          </p>
        </div>

        {news.coverImageUrl && (
          <div className="px-6 sm:px-8">
            <img
              src={assetUrl(news.coverImageUrl)}
              alt={news.title}
              className="w-full rounded-lg"
            />
          </div>
        )}

        <div
          className="prose prose-sm sm:prose !max-w-none px-6 py-6 sm:px-8 sm:py-8"
          dangerouslySetInnerHTML={{
            __html: prefixUploadsInHtml(sanitizeHtml(news.body, {
              allowedTags: sanitizeHtml.defaults.allowedTags.concat([
                "img", "figure", "figcaption", "iframe",
              ]),
              allowedAttributes: {
                ...sanitizeHtml.defaults.allowedAttributes,
                img: ["src", "alt", "width", "height", "class", "style"],
                iframe: ["src", "width", "height", "frameborder", "allowfullscreen"],
                "*": ["class", "style"],
              },
              allowedIframeHostnames: ["www.youtube.com", "player.vimeo.com"],
            })),
          }}
        />
      </article>
    </div>
  );
}
