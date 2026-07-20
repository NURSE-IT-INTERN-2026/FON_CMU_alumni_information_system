"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The standard "ส่งออก Excel" button, with a popover for optional start/end row range.
 *
 * Clicking the button opens a small popover with two number inputs (1-based):
 * "แถวเริ่มต้น" / "แถวสุดท้าย". Leaving both blank exports everything (today's default);
 * filling them exports only that slice. The server clamps the values regardless
 * (see `resolveRowRange` in `lib/excel-export.ts`).
 *
 * `buildHref` receives the parsed 1-based start/end (null = unspecified) and returns the
 * full export URL — same `window.location.href` native-download flow the pages used inline.
 */
type Props = {
  buildHref: (startRow: number | null, endRow: number | null) => string;
  className?: string;
};

const TRIGGER_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors";

export function ExportRangeButton({ buildHref, className }: Props) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const download = () => {
    const parse = (v: string): number | null => {
      const t = v.trim();
      if (t === "") return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : null;
    };
    window.location.href = buildHref(parse(start), parse(end));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(TRIGGER_CLASS, className)}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          ส่งออก Excel
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <p className="text-sm font-medium text-foreground">ส่งออกบางส่วน</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">
            แถวเริ่มต้น
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder="1"
              className="mt-1"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            แถวสุดท้าย
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder="N"
              className="mt-1"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">เว้นว่างเพื่อส่งออกทั้งหมด</p>
        <button
          type="button"
          onClick={download}
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          ดาวน์โหลด
        </button>
      </PopoverContent>
    </Popover>
  );
}
