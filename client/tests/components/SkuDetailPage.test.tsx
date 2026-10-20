import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SkuDetailPage } from "../../src/pages/SkuDetailPage";

async function seed(body: Record<string, unknown>) {
  const r = await fetch("/api/stock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(r.ok).toBe(true);
}

function renderSku(sku: string) {
  render(
    <MemoryRouter initialEntries={[`/sku/${encodeURIComponent(sku)}`]}>
      <Routes>
        <Route path="/sku/:sku" element={<SkuDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SkuDetailPage", () => {
  it("lists a row per location with quantity @T53", async () => {
    const sku = `SKU-${crypto.randomUUID()}`;
    const a = `LOC-${crypto.randomUUID()}`;
    const b = `LOC-${crypto.randomUUID()}`;
    await seed({ sku, location: a, quantity: 3 });
    await seed({ sku, location: b, quantity: 9 });
    renderSku(sku);
    const row = await screen.findByTestId(`sku-location-${a}`);
    expect(within(row).getByTestId(`sku-qty-${a}`)).toHaveTextContent("3");
    expect(within(screen.getByTestId(`sku-location-${b}`)).getByTestId(`sku-qty-${b}`)).toHaveTextContent("9");
  });

  it("omits another SKU's locations @T54", async () => {
    const sku = `SKU-${crypto.randomUUID()}`;
    const other = `SKU-${crypto.randomUUID()}`;
    const mine = `LOC-${crypto.randomUUID()}`;
    const theirs = `LOC-${crypto.randomUUID()}`;
    await seed({ sku, location: mine, quantity: 1 });
    await seed({ sku: other, location: theirs, quantity: 2 });
    renderSku(sku);
    await screen.findByTestId(`sku-location-${mine}`);
    expect(screen.getByTestId("sku-locations")).toBeInTheDocument();
    expect(screen.queryByTestId(`sku-location-${theirs}`)).toBeNull();
  });

  it("shows sku-empty for a SKU with no records @T65", async () => {
    renderSku(`SKU-${crypto.randomUUID()}`);
    const empty = await screen.findByTestId("sku-empty");
    expect(empty).toHaveTextContent(/no stock at any location/i);
    expect(screen.queryByTestId("sku-error")).toBeNull();
    expect(screen.queryAllByTestId(/^sku-location-/)).toHaveLength(0);
  });

  it("shows sku-empty for quantity-0 only @T66", async () => {
    const sku = `SKU-${crypto.randomUUID()}`;
    const loc = `LOC-${crypto.randomUUID()}`;
    await seed({ sku, location: loc, quantity: 0 });
    renderSku(sku);
    expect(await screen.findByTestId("sku-empty")).toBeInTheDocument();
    expect(screen.queryByTestId(`sku-location-${loc}`)).toBeNull();
  });

  it("shows the filed tracking code @T58", async () => {
    const sku = `SKU-${crypto.randomUUID()}`;
    const loc = `LOC-${crypto.randomUUID()}`;
    const code = `TC-${crypto.randomUUID()}`;
    await seed({ sku, location: loc, quantity: 2, tracking_code: code });
    renderSku(sku);
    const row = await screen.findByTestId(`sku-location-${loc}`);
    expect(within(row).getByTestId(`sku-tracking-${loc}`)).toHaveTextContent(code);
  });

  it("shows not-tracked for a missing tracking code @T59", async () => {
    const sku = `SKU-${crypto.randomUUID()}`;
    const loc = `LOC-${crypto.randomUUID()}`;
    await seed({ sku, location: loc, quantity: 2 });
    renderSku(sku);
    await screen.findByTestId(`sku-location-${loc}`);
    const nt = screen.getByTestId("sku-tracking-not-tracked");
    expect(nt).toHaveTextContent("Not tracked");
    expect(nt).toHaveClass("not-tracked");
  });

  it("shows par level not tracked @T62", async () => {
    const sku = `SKU-${crypto.randomUUID()}`;
    const loc = `LOC-${crypto.randomUUID()}`;
    await seed({ sku, location: loc, quantity: 2 });
    renderSku(sku);
    await screen.findByTestId(`sku-location-${loc}`);
    const par = within(screen.getByTestId("sku-par-level")).getByTestId("sku-par-not-tracked");
    expect(par).toHaveTextContent("Not tracked");
    expect(screen.queryByTestId("sku-error")).toBeNull();
  });
});
