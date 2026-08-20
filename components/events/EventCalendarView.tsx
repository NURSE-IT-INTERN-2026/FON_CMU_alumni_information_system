"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bangkokParts } from "@/lib/event-format";
import {
  THAI_DAY_NAMES_SHORT,
  buildMonthGrid,
  bucketEventsByDay,
  thaiMonthYearLabel,
  type MonthCursor,
} from "@/lib/event-calendar";

export interface CalendarEvent {
  id: string;
  title: string;
  startAt: string;
}

const MAX_CHIPS = 2;

function cellKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * Month-grid calendar for the alumni events page. Hand-rolled 7-column table
 * (NOT react-day-picker — event chips are Links, and DayPicker renders days
 * as buttons, which can't nest interactive elements). Days are Gregorian UTC
 * grid dates; event bucketing keys are Bangkok wall-clock days.
 */
export default function EventCalendarView({
  events,
  cursor,
  isPending,
  onPrev,
  onNext,
  onToday,
}: {
  events: CalendarEvent[];
  cursor: MonthCursor;
  isPending: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const buckets = useMemo(() => bucketEventsByDay(events), [events]);
  const weeks = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const today = bangkokParts(new Date());
  const monthTotal = events.length;

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm sm:p-6">
      {/* Month navigation */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onPrev}
          aria-label="เดือนก่อนหน้า"
        >
          <ChevronLeftIcon />
        </Button>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-[var(--primary)]">
            {thaiMonthYearLabel(cursor)}
          </h2>
          <p className="text-xs text-[var(--muted)]">
            {isPending ? "กำลังโหลด…" : `${monthTotal} กิจกรรมในเดือนนี้`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onToday}>
            วันนี้
          </Button>
          <Button variant="outline" size="icon-sm" onClick={onNext} aria-label="เดือนถัดไป">
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-center">
          <caption className="sr-only">ปฏิทินกิจกรรม {thaiMonthYearLabel(cursor)}</caption>
          <thead>
            <tr>
              {THAI_DAY_NAMES_SHORT.map((d) => (
                <th key={d} scope="col" className="pb-2 text-xs font-medium text-[var(--muted)]">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi} className="border-t border-[var(--border)]">
                {week.map((cell) => {
                  const dayEvents = buckets.get(cellKey(cell.date)) ?? [];
                  const hidden = cell.inMonth ? dayEvents.length - MAX_CHIPS : 0;
                  const isToday =
                    cell.inMonth &&
                    cell.date.getUTCFullYear() === today.year &&
                    cell.date.getUTCMonth() === today.month &&
                    cell.date.getUTCDate() === today.day;
                  return (
                    <td
                      key={cellKey(cell.date)}
                      className={`min-h-[72px] p-1 align-top sm:min-h-24 ${
                        cell.inMonth ? "" : "bg-gray-50/60"
                      }`}
                    >
                      <div className="flex h-full flex-col gap-1">
                        <span
                          className={`text-xs ${
                            isToday
                              ? "mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)] font-bold text-white"
                              : cell.inMonth
                                ? "text-[var(--foreground)]"
                                : "text-[var(--muted)]/50"
                          }`}
                        >
                          {cell.date.getUTCDate()}
                        </span>
                        {cell.inMonth &&
                          dayEvents.slice(0, MAX_CHIPS).map((e) => (
                            <Link
                              key={e.id}
                              href={`/graduates/events/${e.id}`}
                              className="block truncate rounded bg-[var(--primary)]/10 px-1 py-0.5 text-[10px] leading-tight text-[var(--primary)] hover:bg-[var(--primary)]/20"
                              title={e.title}
                            >
                              {e.title}
                            </Link>
                          ))}
                        {cell.inMonth && hidden > 0 && (
                          <span className="px-1 text-[10px] text-[var(--muted)]">
                            +อีก {hidden}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {!isPending && monthTotal === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-sm text-[var(--muted)]">
                  ไม่มีกิจกรรมในเดือนนี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
