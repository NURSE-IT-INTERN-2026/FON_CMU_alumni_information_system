/**
 * Renders `<colgroup>` of `count` `<col>` elements, applying saved px widths
 * (from the resize cache) and leaving un-resized columns auto. Always safe to
 * render — inert when `widths` is empty, so non-superadmins are unaffected.
 */
export function ColGroup({
  count,
  widths,
}: {
  count: number;
  widths: Record<string, number>;
}) {
  return (
    <colgroup>
      {Array.from({ length: count }, (_, i) => {
        const w = widths[String(i)];
        return <col key={i} style={w ? { width: `${w}px` } : undefined} />;
      })}
    </colgroup>
  );
}
