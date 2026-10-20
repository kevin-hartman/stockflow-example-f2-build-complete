import { useState } from "react";
import { getStockRecord, type StockRecord } from "../api/stock";

export type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; record: StockRecord }
  | { status: "empty" }
  | { status: "error"; message: string };

export function useStockRecord() {
  const [state, setState] = useState<LookupState>({ status: "idle" });

  async function lookup(sku: string, location: string) {
    setState({ status: "loading" });
    try {
      const record = await getStockRecord(sku.trim(), location.trim());
      setState(record ? { status: "found", record } : { status: "empty" });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return { state, lookup };
}
