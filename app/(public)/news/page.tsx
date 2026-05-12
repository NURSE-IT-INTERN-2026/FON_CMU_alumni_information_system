import Link from "next/link";
import prisma from "@/lib/prisma";

const PAGE_SIZE = 9;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

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

export default async function NewsListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));

  const [news, total] = await Promise.all([
    prisma.news.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.news.count({ where: { status: "PUBLISHED" } }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-center text-2xl font-bold text-[var(--primary)] sm:text-3xl">
        ข่าวสารและกิจกรรม
      </h1>

      {news.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm">
          <svg
            className="mx-auto mb-4 h-12 w-12 text-[var(--muted)]"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            />
          </svg>
          <p className="text-[var(--muted)]">ยังไม่มีข่าวสาร</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {news.map((item) => {
            const summary = stripHtml(item.body).slice(0, 150);
            return (
              <Link
                key={item.id}
                href={`/news/${item.id}`}
                className="group overflow-hidden rounded-lg bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="aspect-video w-full overflow-hidden bg-gray-100">
                  {item.coverImageUrl ? (
                    <img
                      src={item.coverImageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[var(--primary)]/5">
                      <svg
                        className="h-12 w-12 text-[var(--primary)]/30"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="mb-2 line-clamp-2 text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                    {item.title}
                  </h3>
                  <p className="mb-2 text-xs text-[var(--muted)]">
                    {item.publishedAt
                      ? formatThaiDate(new Date(item.publishedAt))
                      : ""}
                  </p>
                  {summary && (
                    <p className="line-clamp-3 text-sm text-[var(--muted)]">
                      {summary}
                      {stripHtml(item.body).length > 150 ? "..." : ""}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          <Link
            href={page > 1 ? `/news?page=${page - 1}` : "#"}
            aria-disabled={page === 1}
            className={`rounded-md border border-[var(--border)] px-3 py-1.5 text-sm ${
              page === 1
                ? "pointer-events-none opacity-50"
                : "hover:bg-gray-50"
            }`}
          >
            ก่อนหน้า
          </Link>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/news?page=${p}`}
              className={`rounded-md px-3 py-1.5 text-sm ${
                p === page
                  ? "bg-[var(--primary)] text-white"
                  : "border border-[var(--border)] hover:bg-gray-50"
              }`}
            >
              {p}
            </Link>
          ))}
          <Link
            href={page < totalPages ? `/news?page=${page + 1}` : "#"}
            aria-disabled={page === totalPages}
            className={`rounded-md border border-[var(--border)] px-3 py-1.5 text-sm ${
              page === totalPages
                ? "pointer-events-none opacity-50"
                : "hover:bg-gray-50"
            }`}
          >
            ถัดไป
          </Link>
        </div>
      )}
    </div>
  );
}
