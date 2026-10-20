/** A tracking code, or the explicit "Not tracked" indicator — never a blank. */
export function TrackingCode({ code, notTrackedTestId }: { code: string | null; notTrackedTestId?: string }) {
  if (code) return <span>{code}</span>;
  return (
    <span className="not-tracked" data-testid={notTrackedTestId}>
      Not tracked
    </span>
  );
}
