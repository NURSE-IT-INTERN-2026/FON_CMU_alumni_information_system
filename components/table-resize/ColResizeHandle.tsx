"use client";

/**
 * The visual + interactive resize grip. Renders as a full-width/full-height
 * strip and relies on its parent (either a header `<th>` or an overlay cell) to
 * position it at a column border. Only mounted for superadmins.
 *
 * - Pointer down → start resizing that column.
 * - Double-click → auto-fit (drop that column's saved width).
 * - All events stop propagation so a drag never triggers the `<th>` sort click.
 */
export function ColResizeHandle({
  onPointerDown,
  onReset,
}: {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onReset: () => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="ปรับความกว้างคอลัมน์"
      title="ลากเพื่อปรับความกว้าง · ดับเบิลคลิกเพื่อรีเซ็ต"
      className="h-full w-full cursor-col-resize bg-transparent transition-colors hover:bg-white/60 active:bg-white/80"
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown(e);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onReset();
      }}
    />
  );
}
