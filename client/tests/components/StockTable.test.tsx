import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StockTable } from "../../src/components/StockTable";

async function seed(body: Record<string, unknown>) {
  const r = await fetch("/api/stock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(r.ok).toBe(true);
}

async function list(location: string) {
  const r = await fetch(`/api/stock?location=${encodeURIComponent(location)}`);
  expect(r.ok).toBe(true);
  return r.json();
}

describe("StockTable", () => {
  it("shows one row per held (sku, location) @T40", async () => {
    const location = `LOC-${crypto.randomUUID()}`;
    const skus = [`SKU-${crypto.randomUUID()}`, `SKU-${crypto.randomUUID()}`];
    await seed({ sku: skus[0], location, quantity: 4 });
    await seed({ sku: skus[1], location, quantity: 12 });
    render(<StockTable rows={await list(location)} />);
    for (const sku of skus) {
      const row = screen.getByTestId(`stock-row-${sku}-${location}`);
      expect(row).toHaveTextContent(sku);
      expect(row).toHaveTextContent(location);
    }
    expect(screen.getByTestId(`stock-qty-${skus[1]}-${location}`)).toHaveTextContent("12");
  });

  it("shows the tracking code @T41", async () => {
    const sku = `SKU-${crypto.randomUUID()}`;
    const location = `LOC-${crypto.randomUUID()}`;
    const code = `TC-${crypto.randomUUID()}`;
    await seed({ sku, location, quantity: 2, tracking_code: code });
    render(<StockTable rows={await list(location)} />);
    expect(screen.getByTestId(`stock-tracking-${sku}-${location}`)).toHaveTextContent(code);
  });

  it("shows Not tracked for a null tracking_code @T42", async () => {
    const sku = `SKU-${crypto.randomUUID()}`;
    const location = `LOC-${crypto.randomUUID()}`;
    await seed({ sku, location, quantity: 2 });
    render(<StockTable rows={await list(location)} />);
    const el = screen.getByTestId("tracking-not-tracked");
    expect(el).toHaveClass("not-tracked");
    expect(el).toHaveTextContent("Not tracked");
  });

  it("right-aligns quantity via stock-table__num @T46", async () => {
    const location = `LOC-${crypto.randomUUID()}`;
    const skus = [`SKU-${crypto.randomUUID()}`, `SKU-${crypto.randomUUID()}`];
    await seed({ sku: skus[0], location, quantity: 5 });
    await seed({ sku: skus[1], location, quantity: 12345 });
    render(<StockTable rows={await list(location)} />);
    expect(screen.getByTestId("stock-col-quantity")).toHaveClass("stock-table__num");
    for (const sku of skus)
      expect(screen.getByTestId(`stock-qty-${sku}-${location}`)).toHaveClass("stock-table__num");
  });

  it("keeps text columns left-aligned @T47", async () => {
    const sku = `SKU-${crypto.randomUUID()}`;
    const location = `LOC-${crypto.randomUUID()}`;
    await seed({ sku, location, quantity: 9, tracking_code: "x" });
    render(<StockTable rows={await list(location)} />);
    const row = screen.getByTestId(`stock-row-${sku}-${location}`);
    const cells = row.querySelectorAll("td");
    const qty = screen.getByTestId(`stock-qty-${sku}-${location}`);
    const text = Array.from(cells).filter((c) => c !== qty);
    expect(text.length).toBeGreaterThanOrEqual(3);
    for (const c of text) expect(c).not.toHaveClass("stock-table__num");
  });

  it("shows stock-empty for a location with only quantity-0 records @T49", async () => {
    const location = `LOC-${crypto.randomUUID()}`;
    await seed({ sku: `SKU-${crypto.randomUUID()}`, location, quantity: 0 });
    render(<StockTable rows={await list(location)} />);
    expect(screen.getByTestId("stock-empty")).toHaveTextContent("No stock at this location");
    expect(screen.queryAllByTestId(/^stock-row-/)).toHaveLength(0);
  });

  it("shows stock-empty with no empty table body for an empty response @T50", async () => {
    const rows = await list(`LOC-${crypto.randomUUID()}`);
    expect(rows).toEqual([]);
    const { container } = render(<StockTable rows={rows} />);
    expect(screen.getByTestId("stock-empty")).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^stock-row-/)).toHaveLength(0);
    expect(container.querySelector("tbody")).toBeNull();
  });
});
