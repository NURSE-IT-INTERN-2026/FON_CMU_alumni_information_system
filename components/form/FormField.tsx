import React from "react";

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
  labelClassName?: string;
}

export default function FormField({
  label,
  required,
  error,
  children,
  className = "",
  labelClassName = "mb-1 block text-sm font-medium text-gray-700",
}: FormFieldProps) {
  return (
    <div className={className}>
      <label className={labelClassName}>
        {label}{" "}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
