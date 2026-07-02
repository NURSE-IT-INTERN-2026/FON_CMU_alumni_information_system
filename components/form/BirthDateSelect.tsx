"use client";

import { useState } from "react";
import {
  useController,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const SELECT_CLASS =
  "w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent";
const BORDER_NORMAL = "border-gray-300";
const BORDER_ERROR = "border-red-400";

interface BirthDateSelectProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  error?: string;
}

/**
 * Buddhist-era date selector (day / Thai month / พ.ศ. year) for the alumni
 * birthDate field. Emits the DDMMYYYY string the alumni schemas expect, so
 * storage + the `formatBirthDateThai` display stay consistent.
 *
 * The native `<input type="date">` can't render Buddhist years (2569), so three
 * selects are used. Each select holds its own partial selection in local state
 * (the combined DDMMYYYY is only written once all three are chosen); the parts
 * re-sync from the field value when it changes externally (e.g. form reset)
 * using the "adjust state when the prop changes" render-time pattern (no effect,
 * no ref — same as SearchInput).
 */
export default function BirthDateSelect<T extends FieldValues>({
  control,
  name,
  error,
}: BirthDateSelectProps<T>) {
  const { field } = useController({ control, name });
  const value = (field.value as string) ?? "";

  const [day, setDay] = useState(value.slice(0, 2));
  const [month, setMonth] = useState(value.slice(2, 4));
  const [year, setYear] = useState(value.slice(4, 8));
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDay(value.slice(0, 2));
    setMonth(value.slice(2, 4));
    setYear(value.slice(4, 8));
  }

  // Current Buddhist year (e.g. 2569 for CE 2026); descending so it never
  // goes stale. Covers ages 0–120.
  const currentBe = new Date().getFullYear() + 543;
  const years = Array.from({ length: 121 }, (_, i) => currentBe - i);
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

  const emit = (d: string, m: string, y: string) => {
    field.onChange(d && m && y ? `${d}${m}${y}` : "");
  };

  const selectClass = `${SELECT_CLASS} ${error ? BORDER_ERROR : BORDER_NORMAL}`;

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        aria-label="วันที่"
        className={selectClass}
        value={day}
        onChange={(e) => {
          setDay(e.target.value);
          emit(e.target.value, month, year);
        }}
      >
        <option value="">วัน</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {Number(d)}
          </option>
        ))}
      </select>

      <select
        aria-label="เดือน"
        className={selectClass}
        value={month}
        onChange={(e) => {
          setMonth(e.target.value);
          emit(day, e.target.value, year);
        }}
      >
        <option value="">เดือน</option>
        {THAI_MONTHS.map((label, i) => {
          const m = String(i + 1).padStart(2, "0");
          return (
            <option key={m} value={m}>
              {label}
            </option>
          );
        })}
      </select>

      <select
        aria-label="ปี พ.ศ."
        className={selectClass}
        value={year}
        onChange={(e) => {
          setYear(e.target.value);
          emit(day, month, e.target.value);
        }}
      >
        <option value="">พ.ศ.</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
