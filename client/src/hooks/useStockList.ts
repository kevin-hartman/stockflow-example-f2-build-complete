import { useEffect, useState } from "react";
import { listStock, type StockRecord } from "../api/stock";

export type StockListState =
  | { status: "loading" }
  | { status: "ok"; rows: StockRecord[] }
  | { status: "error"; message: string };

/** Stock held at `location` (all locations when empty), re-queried when it changes. */
export function useStockList(location: string): StockListState {
  const [state, setState] = useState<StockListState>({ status: "loading" });
  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    listStock(location || undefined)
      .then((rows) => live && setState({ status: "ok", rows }))
      .catch((e: Error) => live && setState({ status: "error", message: e.message }));
    return () => {
      live = false;
    };
  }, [location]);
  return state;
}
