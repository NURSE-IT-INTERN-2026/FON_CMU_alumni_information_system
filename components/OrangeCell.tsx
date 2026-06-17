"use client";

import { useState, type ReactNode } from "react";
import FieldHistoryModal from "./FieldHistoryModal";

/**
 * Renders a table-cell value. If the field has recorded change history
 * (`hotFields` includes `field`), the value is shown orange + clickable and
 * opens the per-field history modal (PRD §3.16).
 */
export default function OrangeCell({
  resourceType,
  recordId,
  field,
  value,
  hotFields,
}: {
  resourceType: string;
  recordId: string;
  field: string;
  value: ReactNode;
  hotFields?: string[];
}) {
  const [open, setOpen] = useState(false);
  if (!hotFields?.includes(field)) return <>{value}</>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer font-medium text-orange-600 underline decoration-dotted underline-offset-2 hover:text-orange-700"
      >
        {value}
      </button>
      {open && (
        <FieldHistoryModal
          resourceType={resourceType}
          resourceId={recordId}
          field={field}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
