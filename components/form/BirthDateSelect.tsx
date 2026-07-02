"use client";

import { useState } from "react";
import {
  useController,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  ddmmyyyyBeToDate,
  dateToDdmmyyyyBe,
  formatBirthDateThaiSlash,
} from "@/lib/alumni-verify";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
// Sun–Sat short labels (getDay(): 0 = Sunday).
const THAI_WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

interface BirthDateSelectProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  error?: string;
}

/**
 * Buddhist-era calendar popup for the alumni `birthDate` field. Renders a
 * button + Popover with a shadcn Calendar whose formatters show พ.ศ. years and
 * Thai months/weekdays (native `<input type="date">` can't show Buddhist
 * years). Emits the DDMMYYYY string the alumni schemas expect (via
 * `dateToDdmmyyyyBe`), so storage + the `formatBirthDateThai` display stay
 * unchanged. Same props/output as the previous 3-select version, so the
 * new-alumni + signup call-sites are unchanged.
 */
export default function BirthDateSelect<T extends FieldValues>({
  control,
  name,
  error,
}: BirthDateSelectProps<T>) {
  const { field } = useController({ control, name });
  const value = (field.value as string) ?? "";
  const selected = ddmmyyyyBeToDate(value);
  const [open, setOpen] = useState(false);

  const now = new Date();
  const currentCe = now.getFullYear();
  // ~120 years back → suitable for birthdays; the year dropdown tops at the
  // current พ.ศ. year (e.g. 2569) and never goes stale.
  const startMonth = new Date(currentCe - 120, 0, 1);
  const endMonth = new Date(currentCe, 11, 31);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={`w-full justify-start text-left font-normal ${
            error ? "border-red-400 focus-visible:ring-red-400" : ""
          } ${selected ? "" : "text-[var(--muted)]"}`}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? formatBirthDateThaiSlash(value) ?? "" : "เลือกวันเกิด"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={startMonth}
          endMonth={endMonth}
          selected={selected ?? undefined}
          defaultMonth={selected ?? now}
          formatters={{
            formatCaption: (month) =>
              `${THAI_MONTHS[month.getMonth()]} ${month.getFullYear() + 543}`,
            formatMonthDropdown: (month) => THAI_MONTHS[month.getMonth()],
            formatYearDropdown: (year) => `${year.getFullYear() + 543}`,
            formatWeekdayName: (weekday) => THAI_WEEKDAYS[weekday.getDay()],
          }}
          onSelect={(d) => {
            field.onChange(d ? dateToDdmmyyyyBe(d) : "");
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
