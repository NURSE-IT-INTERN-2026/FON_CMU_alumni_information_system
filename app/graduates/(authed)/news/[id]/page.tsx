import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { assetUrl } from "@/lib/asset-url";
import { sanitizeNewsBody } from "@/lib/news-sanitize";

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

export default async function AlumniNewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const news = await prisma.news.findUnique({
    where: { id },
  });

  if (!news || news.status !== "PUBLISHED") {
    notFound();
  }

  // Show the update date only when the article was actually edited after it was
  // first created (Prisma sets updatedAt === createdAt on create).
  const edited = news.updatedAt.getTime() > news.createdAt.getTime();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/graduates/news"
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
            {[
              news.publishedAt ? formatThaiDate(new Date(news.publishedAt)) : null,
              edited
                ? `แก้ไขล่าสุด ${formatThaiDate(new Date(news.updatedAt))}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
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
            __html: sanitizeNewsBody(news.body),
          }}
        />
      </article>
    </div>
  );
}
