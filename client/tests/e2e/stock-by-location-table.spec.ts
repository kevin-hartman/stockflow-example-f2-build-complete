import { test, expect } from "./consort-fixtures";
import type { APIRequestContext } from "@playwright/test";

async function seed(request: APIRequestContext, body: Record<string, unknown>) {
  const r = await request.post("/api/stock", { data: body });
  expect(r.ok()).toBe(true);
}

test("table lists stock by location @T43", async ({ page, request }) => {
  const sku = `SKU-${crypto.randomUUID()}`;
  const loc = `LOC-${crypto.randomUUID()}`;
  await seed(request, { sku, location: loc, quantity: 8 });
  await page.goto("/");
  const row = page.getByTestId(`stock-row-${sku}-${loc}`);
  await expect(page.getByTestId("stock-table")).toBeVisible();
  await expect(row).toContainText(sku);
  await expect(row).toContainText(loc);
  await expect(page.getByTestId(`stock-qty-${sku}-${loc}`)).toHaveText("8");
});

test("table shows tracking code @T44", async ({ page, request }) => {
  const sku = `SKU-${crypto.randomUUID()}`;
  const loc = `LOC-${crypto.randomUUID()}`;
  const code = `TC-${crypto.randomUUID()}`;
  await seed(request, { sku, location: loc, quantity: 3, tracking_code: code });
  await page.goto("/");
  await expect(page.getByTestId(`stock-tracking-${sku}-${loc}`)).toContainText(code);
});

test("table shows Not tracked label @T45", async ({ page, request }) => {
  const sku = `SKU-${crypto.randomUUID()}`;
  const loc = `LOC-${crypto.randomUUID()}`;
  await seed(request, { sku, location: loc, quantity: 3 });
  await page.goto("/");
  const cell = page.getByTestId(`stock-row-${sku}-${loc}`).getByTestId("tracking-not-tracked");
  await expect(cell).toHaveText("Not tracked");
});
