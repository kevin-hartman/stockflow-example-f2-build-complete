import { useEffect, useState } from "react";
import { getStockRecord } from "../api/stock";

interface Props {
  sku: string;
  location: string;
  delta: number;
}

/** Shows the pair's current quantity and the level a delta would leave it at. */
export function AdjustDeltaPreview({ sku, location, delta }: Props) {
  const [current, setCurrent] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void getStockRecord(sku, location).then((r) => live && setCurrent(r ? r.quantity : null));
    return () => {
      live = false;
    };
  }, [sku, location]);
  return <DeltaPreview current={current} delta={delta} />;
}

/** Pure presentation: current -> resulting level for a delta. */
export function DeltaPreview({ current, delta }: { current: number | null; delta: number }) {
  const result = current === null || !Number.isFinite(delta) ? null : current + delta;
  return (
    <p className="field__hint" data-testid="adjust-delta-preview" aria-live="polite">
      Current <strong>{current ?? "—"}</strong> → resulting <strong>{result ?? "—"}</strong>
    </p>
  );
}
