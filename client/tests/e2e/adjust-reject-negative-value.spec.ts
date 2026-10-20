import { test, expect } from "./consort-fixtures";

test("a corrected quantity of -2 is rejected inline naming the field @T52", async ({ page, request }) => {
  const sku = `SKU-${crypto.randomUUID()}`;
  const loc = `LOC-${crypto.randomUUID()}`;
  const r = await request.post("/api/stock", { data: { sku, location: loc, quantity: 7 } });
  expect(r.ok()).toBe(true);
  await page.goto(`/adjust?sku=${encodeURIComponent(sku)}&location=${encodeURIComponent(loc)}`);
  await expect(page.getByTestId("adjust-current-qty")).toContainText("7");
  await page.getByTestId("field-quantity").fill("-2");
  await page.getByTestId("field-actor").fill("alice");
  await page.getByTestId("adjust-submit").click();
  await expect(page.getByTestId("field-quantity-error")).toContainText(/corrected quantity/i);
  await expect(page.getByTestId("adjust-current-qty")).toHaveText(/^7$/);
  await expect(page.locator('[data-testid^="adjust-audit-row-"]')).toHaveCount(0);
});
