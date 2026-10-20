import { test, expect } from "./consort-fixtures";

test("a -7 delta on quantity 7 is accepted and shows 0 with one audit row @T56", async ({ page, request }) => {
  const sku = `SKU-${crypto.randomUUID()}`;
  const loc = `LOC-${crypto.randomUUID()}`;
  const r = await request.post("/api/stock", { data: { sku, location: loc, quantity: 7 } });
  expect(r.ok()).toBe(true);
  await page.goto(`/adjust?sku=${encodeURIComponent(sku)}&location=${encodeURIComponent(loc)}`);
  await expect(page.getByTestId("adjust-current-qty")).toContainText("7");
  await page.getByTestId("adjust-mode-delta").click();
  await page.getByTestId("field-delta").fill("-7");
  await page.getByTestId("field-actor").fill("alice");
  await page.getByTestId("adjust-submit").click();
  await expect(page.getByTestId("adjust-success")).toBeVisible();
  await expect(page.getByTestId("adjust-current-qty")).toHaveText(/^0$/);
  const rows = page.locator('[data-testid^="adjust-audit-row-"]');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("7");
  await expect(rows.first()).toContainText("0");
});
