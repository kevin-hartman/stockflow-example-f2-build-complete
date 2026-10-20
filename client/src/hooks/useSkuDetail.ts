import { useEffect, useState } from "react";
import { getSkuDetail, type SkuLocation } from "../api/stock";

export type SkuDetailState =
  | { status: "loading" }
  | { status: "ok"; locations: SkuLocation[] }
  | { status: "error"; message: string };

/** The locations holding stock of `sku`, re-queried when it changes. */
export function useSkuDetail(sku: string): SkuDetailState {
  const [state, setState] = useState<SkuDetailState>({ status: "loading" });
  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    getSkuDetail(sku)
      .then((d) => live && setState({ status: "ok", locations: d.locations }))
      .catch((e: Error) => live && setState({ status: "error", message: e.message }));
    return () => {
      live = false;
    };
  }, [sku]);
  return state;
}
