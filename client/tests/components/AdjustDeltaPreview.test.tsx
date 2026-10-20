import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AdjustDeltaPreview } from "../../src/components/AdjustDeltaPreview";

async function seed(sku: string, location: string, quantity: number) {
  const r = await fetch("/api/stock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku, location, quantity }),
  });
  expect(r.ok).toBe(true);
}

async function preview(delta: number) {
  const sku = `SKU-${crypto.randomUUID()}`;
  const loc = `LOC-${crypto.randomUUID()}`;
  await seed(sku, loc, 7);
  render(<AdjustDeltaPreview sku={sku} location={loc} delta={delta} />);
  return screen.getByTestId("adjust-delta-preview");
}

describe("AdjustDeltaPreview", () => {
  it("shows current 7 and resulting 12 for +5 @T40", async () => {
    const el = await preview(5);
    await waitFor(() => expect(el).toHaveTextContent("7"));
    await waitFor(() => expect(el).toHaveTextContent("12"));
  });

  it("shows current 7 and resulting 4 for -3 @T42", async () => {
    const el = await preview(-3);
    await waitFor(() => expect(el).toHaveTextContent("7"));
    await waitFor(() => expect(el).toHaveTextContent("4"));
  });
});
