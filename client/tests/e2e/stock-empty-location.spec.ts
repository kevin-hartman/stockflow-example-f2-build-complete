import { test, expect } from "./consort-fixtures";

test("empty location shows stock-empty state @T51", async ({ page, request }) => {
  const sku = `SKU-${crypto.randomUUID()}`;
  const loc = `LOC-${crypto.randomUUID()}`;
  const r = await request.post("/api/stock", { data: { sku, location: loc, quantity: 0 } });
  expect(r.ok()).toBe(true);
  await page.goto("/");
  const select = page.getByTestId("warehouse-select");
  await select.click();
  await select.fill(loc);
  await page.getByRole("option", { name: loc, exact: true }).click();
  await expect(page.getByTestId("stock-empty")).toHaveText(/No stock at this location/);
  await expect(page.getByTestId(`stock-row-${sku}-${loc}`)).toHaveCount(0);
});
