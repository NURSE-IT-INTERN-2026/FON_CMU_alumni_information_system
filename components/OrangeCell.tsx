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
  // One resource type, or several (e.g. ["alumni", "alumni_profile"]) so a
  // value changed under either tracking scope is highlighted and its modal
  // shows the combined history.
  resourceType: string | string[];
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
        onClick={(e) => {
          // Stop the click from bubbling to a parent row's onClick (e.g. the
          // management tables' "click row → view profile" navigation) so a
          // click on an orange value only opens this history modal.
          e.stopPropagation();
          setOpen(true);
        }}
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
