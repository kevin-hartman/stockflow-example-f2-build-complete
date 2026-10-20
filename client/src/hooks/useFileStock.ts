import { useState } from "react";
import { ApiError } from "../api/client";
import { fileStock, type FileStockInput, type StockRecord } from "../api/stock";

function describe(e: unknown): string {
  if (e instanceof ApiError && e.field) return `${e.field}: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}

export function useFileStock() {
  const [filed, setFiled] = useState<StockRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(input: FileStockInput): Promise<boolean> {
    setBusy(true);
    setError(null);
    setFiled(null);
    try {
      setFiled(await fileStock(input));
      return true;
    } catch (e) {
      setError(describe(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { filed, error, busy, submit, fail: setError };
}
