"use client";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T, index: number) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  onSort?: () => void;
  sortIcon?: React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  /** Show row selection checkboxes */
  selectable?: boolean;
  /** IDs of currently selected rows */
  selectedIds?: string[];
  /** All available IDs (for select-all toggle) */
  allIds?: string[];
  /** Callback when selection changes */
  onSelectionChange?: (ids: string[]) => void;
  /** Get the unique ID for each row */
  getRowId: (row: T) => string;
  /** Number of columns to account for (auto-calculated if not provided) */
  colSpan?: number;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = "ไม่พบข้อมูล",
  selectable = false,
  selectedIds = [],
  allIds = [],
  onSelectionChange,
  getRowId,
  colSpan,
  className,
}: DataTableProps<T>) {
  const totalCols =
    colSpan ?? columns.length + (selectable ? 1 : 0);

  const isAllSelected =
    allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));

  const handleToggleAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    onSelectionChange(checked ? [...allIds] : []);
  };

  const handleToggleRow = (id: string) => {
    if (!onSelectionChange) return;
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((sid) => sid !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg bg-white shadow-sm",
        className
      )}
    >
      <Table className="w-full text-sm">
        <TableHeader>
          <TableRow
            className="text-white text-left border-0 hover:bg-transparent"
            style={{ backgroundColor: "var(--primary)" }}
          >
            {selectable && (
              <TableHead className="px-4 py-3 w-12 text-center">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleToggleAll}
                  className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-[var(--primary)]"
                />
              </TableHead>
            )}
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap",
                  col.sortable && "cursor-pointer hover:bg-white/10",
                  col.className
                )}
                onClick={col.sortable ? col.onSort : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortIcon}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell
                colSpan={totalCols}
                className="px-4 py-12 text-center"
              >
                <div className="flex justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
                </div>
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={totalCols}
                className="px-4 py-12 text-center text-[var(--muted)]"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, i) => {
              const id = getRowId(row);
              return (
                <TableRow
                  key={id}
                  className="border-b border-[var(--border)] transition-colors hover:bg-gray-50"
                >
                  {selectable && (
                    <TableCell className="px-4 py-3 text-center">
                      <Checkbox
                        checked={selectedIds.includes(id)}
                        onCheckedChange={() => handleToggleRow(id)}
                        className="h-4 w-4"
                      />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn("px-4 py-3", col.className)}
                    >
                      {col.render(row, i)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Renders skeleton placeholder rows for table loading state.
 */
export function DataTableSkeleton({
  columns,
  rows = 5,
  selectable = false,
}: {
  columns: number;
  rows?: number;
  selectable?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm">
      <Table className="w-full text-sm">
        <TableHeader>
          <TableRow
            className="text-white text-left border-0 hover:bg-transparent"
            style={{ backgroundColor: "var(--primary)" }}
          >
            {selectable && (
              <TableHead className="px-4 py-3 w-12">
                <Skeleton className="h-4 w-4 bg-white/30" />
              </TableHead>
            )}
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead key={i} className="px-4 py-3">
                <Skeleton className="h-3 w-20 bg-white/30" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <TableRow key={rowIdx}>
              {selectable && (
                <TableCell className="px-4 py-3 text-center">
                  <Skeleton className="mx-auto h-4 w-4" />
                </TableCell>
              )}
              {Array.from({ length: columns }).map((_, colIdx) => (
                <TableCell key={colIdx} className="px-4 py-3">
                  <Skeleton
                    className="h-4"
                    style={{ width: `${50 + Math.random() * 40}%` }}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
