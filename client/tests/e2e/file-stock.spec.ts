import { test, expect } from "./consort-fixtures";

test("file stock with a new location and no tracking code @T15", async ({ page }) => {
  const sku = `SKU-${crypto.randomUUID()}`;
  const location = `LOC-${crypto.randomUUID()}`;
  await page.goto("/");
  await page.getByRole("link", { name: "File stock", exact: true }).click();
  await expect(page).toHaveURL(/\/file$/);
  await page.getByTestId("field-sku").fill(sku);
  await page.getByTestId("field-location").fill(location);
  await page.getByRole("option", { name: /use new location/i }).click();
  await page.getByTestId("field-quantity").fill("4");
  await page.getByTestId("file-submit").click();
  const conf = page.getByTestId("file-confirmation");
  await expect(conf).toContainText(sku);
  await expect(conf).toContainText(location);
  await expect(conf).toContainText("4");
  await expect(conf).toContainText("Not tracked");
  await expect(page.getByTestId("form-error")).toHaveCount(0);
});

test("file stock choosing an existing location @T16", async ({ page, request, baseURL }) => {
  const location = `LOC-${crypto.randomUUID()}`;
  const seeded = await request.post(`${baseURL}/api/stock`, {
    data: { sku: `SKU-${crypto.randomUUID()}`, location, quantity: 1 },
  });
  expect(seeded.ok()).toBe(true);
  const sku = `SKU-${crypto.randomUUID()}`;
  const code = `TC-${crypto.randomUUID()}`;
  await page.goto("/file");
  await page.getByTestId("field-sku").fill(sku);
  await page.getByTestId("field-location").click();
  await page.getByRole("option", { name: location, exact: true }).click();
  await page.getByTestId("field-quantity").fill("9");
  await page.getByTestId("field-tracking-code").fill(code);
  await page.getByTestId("file-submit").click();
  const conf = page.getByTestId("file-confirmation");
  for (const t of [sku, location, "9", code]) await expect(conf).toContainText(t);
});
