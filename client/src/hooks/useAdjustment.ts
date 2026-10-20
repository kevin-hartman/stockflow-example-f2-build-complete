import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { adjustToValue, listAdjustments, type AdjustInput, type Adjustment } from "../api/adjustments";
import { getStockRecord } from "../api/stock";

export interface FieldError {
  field: string;
  message: string;
}

/** One (sku, location) pair's current quantity + audit trail, and the adjust-to-value action. */
export function useAdjustment(sku: string, location: string) {
  const [current, setCurrent] = useState<number | null>(null);
  const [audit, setAudit] = useState<Adjustment[] | null>(null);
  const [adjusted, setAdjusted] = useState<Adjustment | null>(null);
  const [error, setError] = useState<FieldError | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [record, rows] = await Promise.all([getStockRecord(sku, location), listAdjustments(sku, location)]);
      setCurrent(record ? record.quantity : null);
      setAudit(rows);
    } catch (e) {
      setError({ field: "", message: e instanceof Error ? e.message : String(e) });
    }
  }, [sku, location]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function submit(input: AdjustInput): Promise<boolean> {
    setBusy(true);
    setError(null);
    setAdjusted(null);
    try {
      setAdjusted(await adjustToValue(input));
      await reload();
      return true;
    } catch (e) {
      const field = e instanceof ApiError ? (e.field ?? "") : "";
      setError({ field, message: e instanceof Error ? e.message : String(e) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { current, audit, adjusted, error, busy, submit, fail: setError };
}
