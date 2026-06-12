"use client";

import React from "react";
import { useFieldArray, type UseFormRegister, type FieldErrors } from "react-hook-form";

const INPUT_CLASS =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent";
const ERROR_INPUT_CLASS =
  "w-full border border-red-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent";

export interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea";
  required?: boolean;
  options?: { value: string; label: string }[];
}

interface RepeatableFieldArrayProps {
  control: any;
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  name: string;
  emptyRow: Record<string, any>;
  fields: FieldDef[];
  singleRow?: boolean;
}

export default function RepeatableFieldArray({
  control,
  register,
  errors,
  name,
  emptyRow,
  fields: fieldDefs,
  singleRow = false,
}: RepeatableFieldArrayProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const getFieldError = (index: number, key: string): string | undefined => {
    const sectionErrors = errors[name];
    if (!sectionErrors || !Array.isArray(sectionErrors)) return undefined;
    const rowError = sectionErrors[index];
    if (!rowError || typeof rowError !== "object") return undefined;
    return (rowError as Record<string, { message?: string }>)[key]?.message;
  };

  const addRow = () => append(emptyRow);

  const resetRow = (index: number) => {
    // Remove and re-add with empty values
    remove(index);
    // We need to insert at same position, but useFieldArray doesn't have insert easily
    // Instead we just set values via register
  };

  return (
    <div>
      {fields.map((field, idx) => (
        <div
          key={field.id}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end mb-3 p-3 bg-gray-50 rounded-lg"
        >
          {fieldDefs.map((f) => {
            const fieldPath = `${name}.${idx}.${f.key}`;
            const errorMsg = getFieldError(idx, f.key);
            const hasError = !!errorMsg;

            return (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {f.label}{" "}
                  {f.required && <span className="text-red-500">*</span>}
                </label>
                {f.type === "select" ? (
                  <select
                    {...register(fieldPath)}
                    className={hasError ? ERROR_INPUT_CLASS : INPUT_CLASS}
                  >
                    {f.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    {...register(fieldPath)}
                    className={hasError ? ERROR_INPUT_CLASS : INPUT_CLASS}
                    rows={3}
                    placeholder={f.label}
                  />
                ) : (
                  <input
                    {...register(fieldPath)}
                    className={hasError ? ERROR_INPUT_CLASS : INPUT_CLASS}
                    type={f.type || "text"}
                    placeholder={f.label}
                  />
                )}
                {errorMsg && (
                  <p className="text-red-500 text-xs mt-1">{errorMsg}</p>
                )}
              </div>
            );
          })}
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => (singleRow ? resetRow(idx) : remove(idx))}
              className="text-red-500 text-sm hover:text-red-700"
            >
              {singleRow ? "ล้างข้อมูล" : "ลบ"}
            </button>
          </div>
        </div>
      ))}
      {!singleRow && (
        <button
          type="button"
          onClick={addRow}
          className="text-sm text-[var(--primary)] font-medium hover:underline"
        >
          + เพิ่มข้อมูล
        </button>
      )}
    </div>
  );
}
