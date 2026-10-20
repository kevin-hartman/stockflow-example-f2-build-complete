import { test, expect } from "./consort-fixtures";
import type { APIRequestContext, Page } from "@playwright/test";

const uid = (p: string) => `${p}-${crypto.randomUUID()}`;

async function seed(request: APIRequestContext, sku: string, location: string, quantity: number) {
  const r = await request.post("/api/stock", { data: { sku, location, quantity } });
  expect(r.ok()).toBe(true);
}

async function adjustTo4(page: Page, sku: string, loc: string) {
  await page.goto(`/adjust?sku=${encodeURIComponent(sku)}&location=${encodeURIComponent(loc)}`);
  await expect(page.getByTestId("adjust-current-qty")).toContainText("7");
  await page.getByTestId("field-quantity").fill("4");
  await page.getByTestId("field-actor").fill("alice");
  await page.getByTestId("adjust-submit").click();
}

test("adjusting to a corrected quantity confirms the change @T5", async ({ page, request }) => {
  const sku = uid("SKU");
  const loc = uid("LOC");
  await seed(request, sku, loc, 7);
  await adjustTo4(page, sku, loc);
  const ok = page.getByTestId("adjust-success");
  await expect(ok).toBeVisible();
  await expect(ok).toContainText(sku);
  await expect(ok).toContainText(loc);
  await expect(ok).toContainText("7");
  await expect(ok).toContainText("4");
  await expect(ok).toContainText("alice");
  await expect(page.getByTestId("toast-success")).toBeVisible();
});

test("SKU detail shows the corrected quantity 4 afterwards @T6", async ({ page, request }) => {
  const sku = uid("SKU");
  const loc = uid("LOC");
  await seed(request, sku, loc, 7);
  await adjustTo4(page, sku, loc);
  await expect(page.getByTestId("adjust-success")).toBeVisible();
  await page.goto(`/sku/${encodeURIComponent(sku)}`);
  await expect(page.getByTestId(`sku-qty-${loc}`)).toHaveText("4");
});
