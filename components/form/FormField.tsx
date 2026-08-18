import React, { useId } from "react";

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
  labelClassName?: string;
}

/**
 * Form label + control + error message, properly associated for screen readers:
 * the label's `htmlFor` points at the control's id, and the error (if any) is
 * wired via `aria-describedby` + `aria-invalid` and announced (`role="alert"`).
 *
 * Association works by cloning a SINGLE element child to inject `id`/aria
 * attributes (an explicit id on the child always wins). Multiple children,
 * fragments, or non-elements can't be auto-associated — they render exactly as
 * before (label first, children after), no worse than the historical output.
 */
export default function FormField({
  label,
  required,
  error,
  children,
  className = "",
  labelClassName = "mb-1 block text-sm font-medium text-gray-700",
}: FormFieldProps) {
  const autoId = useId();
  const errorId = `${autoId}-error`;

  const childArray = React.Children.toArray(children);
  let labelFor: string | undefined;
  let rendered = children;
  if (childArray.length === 1 && React.isValidElement(childArray[0])) {
    const child = childArray[0] as React.ReactElement<Record<string, unknown>>;
    const childProps = child.props ?? {};
    const childId = (childProps.id as string | undefined) ?? autoId;
    const describedBy =
      [childProps["aria-describedby"] as string | undefined, error ? errorId : undefined]
        .filter(Boolean)
        .join(" ") || undefined;
    rendered = React.cloneElement(child, {
      id: childId,
      ...(error != null ? { "aria-invalid": true } : {}),
      ...(describedBy ? { "aria-describedby": describedBy } : {}),
    });
    labelFor = childId;
  }

  return (
    <div className={className}>
      <label htmlFor={labelFor} className={labelClassName}>
        {label}{" "}
        {required && <span className="text-red-500">*</span>}
      </label>
      {rendered}
      {error && (
        <p id={errorId} role="alert" className="text-red-500 text-xs mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
