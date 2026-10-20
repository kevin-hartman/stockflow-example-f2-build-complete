import { ApiError, getJson, postJson } from "./client";

export interface StockRecord {
  sku: string;
  location: string;
  quantity: number;
  tracking_code: string | null;
}

export interface FileStockInput {
  sku: string;
  location: string;
  quantity: number | string;
  tracking_code?: string | null;
}

export function fileStock(input: FileStockInput): Promise<StockRecord> {
  return postJson<StockRecord>("/api/stock", input);
}

/** The record for (sku, location), or null when none is on record (404). */
export async function getStockRecord(sku: string, location: string): Promise<StockRecord | null> {
  const qs = new URLSearchParams({ sku, location });
  try {
    return await getJson<StockRecord>(`/api/stock/record?${qs}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function listLocations(): Promise<string[]> {
  return getJson<string[]>("/api/locations");
}

/** Every (sku, location) holding stock, optionally filtered to one location. */
export function listStock(location?: string): Promise<StockRecord[]> {
  const qs = location ? `?${new URLSearchParams({ location })}` : "";
  return getJson<StockRecord[]>(`/api/stock${qs}`);
}

export interface SkuLocation {
  location: string;
  quantity: number;
  tracking_code: string | null;
}

export interface SkuDetail {
  sku: string;
  locations: SkuLocation[];
}

/** One SKU's stock at every location holding it (empty `locations` when it has none). */
export function getSkuDetail(sku: string): Promise<SkuDetail> {
  return getJson<SkuDetail>(`/api/skus/${encodeURIComponent(sku)}`);
}
