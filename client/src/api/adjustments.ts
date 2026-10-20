import { getJson, postJson } from "./client";

export interface Adjustment {
  id: number;
  sku: string;
  location: string;
  prior_quantity: number;
  new_quantity: number;
  actor: string;
  adjusted_at: string;
}

export interface AdjustInput {
  sku: string;
  location: string;
  quantity: number | string;
  actor: string;
}

export function adjustToValue(input: AdjustInput): Promise<Adjustment> {
  return postJson<Adjustment>("/api/adjustments", input);
}

/** The pair's audit trail, newest first. */
export function listAdjustments(sku: string, location: string): Promise<Adjustment[]> {
  return getJson<Adjustment[]>(`/api/adjustments?${new URLSearchParams({ sku, location })}`);
}
