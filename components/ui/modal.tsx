"use client";

/**
 * Shared application Modal — the ONE shell every dialog in the app should use.
 *
 * A thin wrapper over the radix Dialog primitives (`components/ui/dialog.tsx`)
 * that adds the pieces this app's hand-rolled modals all had (and that radix
 * gives for free): focus trap + focus restore, Escape/overlay close,
 * `role="dialog"` + `aria-modal`, a required accessible title, and body scroll
 * lock. NEVER hand-roll a `fixed inset-0` overlay again — those were
 * unreachable by keyboard and unannounced to screen readers.
 *
 * Typical swap for an old inline overlay:
 *
 *   {deleteId && (
 *     <div className="fixed inset-0 ...">…<h3>ลบรายการ</h3>…<button>ยืนยัน</button></div>
 *   )}
 * →
 *   <Modal open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}
 *          title="ลบรายการ" size="sm"
 *          footer={<Button variant="destructive" onClick={confirm}>ลบ</Button>}>
 *     <p>ยืนยันการลบ?</p>
 *   </Modal>
 *
 * Keep the caller's `{state && …}` conditional wrapper when local state must
 * reset on close (radix unmounts content either way); the always-mounted form
 * above is for simple boolean-gated dialogs.
 * For pure confirmations prefer `components/confirm-dialog.tsx` (built on this).
 */

import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ModalProps {
  /** Controlled open state (this component is always-mounted by design). */
  open: boolean;
  /** radix's onOpenChange — called with `false` on Escape / overlay click / close X. */
  onOpenChange: (open: boolean) => void;
  /** Required — the dialog's accessible name (rendered as the heading). */
  title: string;
  /** Optional subtitle / explanatory line under the title. */
  description?: string;
  children?: ReactNode;
  /** Action row (buttons). Pass them in visual order; they right-align on sm+. */
  footer?: ReactNode;
  /** Dialog width. `md` (max-w-lg) is the default; `sm` = confirm-sized,
   *  `lg` = wide forms, `xl` = very wide content. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Let tall bodies scroll internally (max-h-[85vh] overflow-y-auto) instead
   *  of growing past the viewport. */
  scrollBody?: boolean;
  /** Hide the corner × (e.g. when the footer already offers ปิด/ยกเลิก). */
  showCloseButton?: boolean;
  /** Extra classes on the content panel (rare). */
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  scrollBody = false,
  showCloseButton = true,
  className,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={showCloseButton} className={cn(SIZE_CLASSES[size], className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {scrollBody ? (
          <div className="-mx-1 max-h-[85vh] overflow-y-auto px-1">{children}</div>
        ) : (
          children
        )}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
