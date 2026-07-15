"use client";

import React, { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";

// Mirrors components/form/FormInput.tsx so it's a visual drop-in for any
// <FormInput type="password">, plus a show/hide eye toggle. `registration` is
// optional so this also works for plain-controlled inputs (e.g. the reapply
// credentials step, which is not react-hook-form). Callers may keep passing
// type="password" — it's overridden internally by the show/hide state.
const BASE_CLASS =
  "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent";
const BORDER_NORMAL = "border-gray-300";
const BORDER_ERROR = "border-red-400";
const FOCUS_RING_ERROR = "focus:ring-red-400";
// Reserve room on the right so typed text doesn't run under the eye button.
const ICON_PADDING = "pr-10";

interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "name"> {
  /** react-hook-form registration (omit for a plain-controlled input). */
  registration?: UseFormRegisterReturn;
  error?: string;
}

export default function PasswordInput({
  registration,
  error,
  className,
  ...rest
}: PasswordInputProps) {
  const [show, setShow] = useState(false);
  const classes = [
    BASE_CLASS,
    error ? BORDER_ERROR : BORDER_NORMAL,
    error ? FOCUS_RING_ERROR : "",
    ICON_PADDING,
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="relative">
      <input
        {...(registration ?? {})}
        {...rest}
        type={show ? "text" : "password"}
        className={classes}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
