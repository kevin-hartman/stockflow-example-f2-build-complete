import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StockLookup } from "../../src/components/StockLookup";

async function seed(body: Record<string, unknown>) {
  const r = await fetch("/api/stock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(r.ok).toBe(true);
}

async function lookup(sku: string, location: string) {
  const user = userEvent.setup();
  await user.type(screen.getByTestId("lookup-sku"), sku);
  await user.type(screen.getByTestId("lookup-location"), location);
  await user.click(screen.getByTestId("lookup-submit"));
}

describe("StockLookup", () => {
  it("renders the filed record @T18", async () => {
    const sku = `SKU-${crypto.randomUUID()}`;
    const location = `LOC-${crypto.randomUUID()}`;
    const tracking_code = `TC-${crypto.randomUUID()}`;
    await seed({ sku, location, quantity: 7, tracking_code });
    render(<StockLookup />);
    await lookup(sku, location);
    const res = await screen.findByTestId("lookup-result");
    for (const t of [sku, location, "7", tracking_code]) expect(res).toHaveTextContent(t);
  });

  it("renders lookup-not-tracked for a null tracking_code @T19", async () => {
    const sku = `SKU-${crypto.randomUUID()}`;
    const location = `LOC-${crypto.randomUUID()}`;
    await seed({ sku, location, quantity: 2 });
    render(<StockLookup />);
    await lookup(sku, location);
    await screen.findByTestId("lookup-result");
    expect(screen.getByTestId("lookup-not-tracked")).toBeInTheDocument();
  });

  it("renders lookup-empty on 404 @T20", async () => {
    render(<StockLookup />);
    await lookup(`SKU-${crypto.randomUUID()}`, `LOC-${crypto.randomUUID()}`);
    expect(await screen.findByTestId("lookup-empty")).toBeInTheDocument();
  });
});
