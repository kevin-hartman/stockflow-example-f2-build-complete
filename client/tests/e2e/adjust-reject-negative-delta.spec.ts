import { test, expect } from "./consort-fixtures";

test("a -10 delta on quantity 7 is rejected inline at the delta field @T50", async ({ page, request }) => {
  const sku = `SKU-${crypto.randomUUID()}`;
  const loc = `LOC-${crypto.randomUUID()}`;
  const r = await request.post("/api/stock", { data: { sku, location: loc, quantity: 7 } });
  expect(r.ok()).toBe(true);
  await page.goto(`/adjust?sku=${encodeURIComponent(sku)}&location=${encodeURIComponent(loc)}`);
  await expect(page.getByTestId("adjust-current-qty")).toContainText("7");
  await page.getByTestId("adjust-mode-delta").click();
  await page.getByTestId("field-delta").fill("-10");
  await page.getByTestId("field-actor").fill("alice");
  await page.getByTestId("adjust-submit").click();
  await expect(page.getByTestId("field-delta-error")).toContainText(/quantity would go below zero/i);
  await expect(page.getByTestId("adjust-current-qty")).toHaveText(/^7$/);
  await expect(page.locator('[data-testid^="adjust-audit-row-"]')).toHaveCount(0);
  await expect(page.getByTestId("adjust-success")).toHaveCount(0);
});
