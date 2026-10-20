import { test, expect } from "./consort-fixtures";

test("a -3 delta lowers quantity 7 to 4 @T43", async ({ page, request }) => {
  const sku = `SKU-${crypto.randomUUID()}`;
  const loc = `LOC-${crypto.randomUUID()}`;
  const r = await request.post("/api/stock", { data: { sku, location: loc, quantity: 7 } });
  expect(r.ok()).toBe(true);
  await page.goto(`/adjust?sku=${encodeURIComponent(sku)}&location=${encodeURIComponent(loc)}`);
  await expect(page.getByTestId("adjust-current-qty")).toContainText("7");
  await page.getByTestId("adjust-mode-delta").click();
  await page.getByTestId("field-delta").fill("-3");
  await page.getByTestId("field-actor").fill("alice");
  await page.getByTestId("adjust-submit").click();
  await expect(page.getByTestId("adjust-success")).toBeVisible();
  await page.goto(`/sku/${encodeURIComponent(sku)}`);
  await expect(page.getByTestId(`sku-qty-${loc}`)).toHaveText("4");
});
