import React from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

const BASE_CLASS =
  "w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent";
const BORDER_NORMAL = "border-gray-300";
const BORDER_ERROR = "border-red-400";
const FOCUS_RING_ERROR = "focus:ring-red-400";

interface FormSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name"> {
  registration: UseFormRegisterReturn;
  error?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export default function FormSelect({
  registration,
  error,
  options,
  placeholder,
  className,
  children,
  ...rest
}: FormSelectProps) {
  const classes = [
    BASE_CLASS,
    error ? BORDER_ERROR : BORDER_NORMAL,
    error ? FOCUS_RING_ERROR : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <select
      {...registration}
      {...rest}
      className={classes}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  );
}
