import React from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

const BASE_CLASS =
  "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent";
const BORDER_NORMAL = "border-gray-300";
const BORDER_ERROR = "border-red-400";
const FOCUS_RING_ERROR = "focus:ring-red-400";

interface FormTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name"> {
  registration: UseFormRegisterReturn;
  error?: string;
}

export default function FormTextarea({
  registration,
  error,
  className,
  ...rest
}: FormTextareaProps) {
  const classes = [
    BASE_CLASS,
    error ? BORDER_ERROR : BORDER_NORMAL,
    error ? FOCUS_RING_ERROR : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <textarea
      {...registration}
      {...rest}
      className={classes}
    />
  );
}
