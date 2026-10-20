import { test, expect } from "./consort-fixtures";
import type { Page } from "@playwright/test";

async function file(page: Page, sku: string, location: string, qty: string, code?: string) {
  await page.goto("/file");
  await page.getByTestId("field-sku").fill(sku);
  await page.getByTestId("field-location").fill(location);
  await page.getByRole("option", { name: /use new location/i }).click();
  await page.getByTestId("field-quantity").fill(qty);
  if (code) await page.getByTestId("field-tracking-code").fill(code);
  await page.getByTestId("file-submit").click();
  await expect(page.getByTestId("file-confirmation")).toContainText(sku);
}

async function lookup(page: Page, sku: string, location: string) {
  const panel = page.getByTestId("stock-lookup");
  await panel.getByTestId("lookup-sku").fill(sku);
  await panel.getByTestId("lookup-location").fill(location);
  await panel.getByTestId("lookup-submit").click();
}

test("retrieve a filed record with tracking code @T21", async ({ page }) => {
  const sku = `SKU-${crypto.randomUUID()}`;
  const location = `LOC-${crypto.randomUUID()}`;
  const code = `TC-${crypto.randomUUID()}`;
  await file(page, sku, location, "6", code);
  await lookup(page, sku, location);
  const res = page.getByTestId("lookup-result");
  for (const t of [sku, location, "6", code]) await expect(res).toContainText(t);
});

test("retrieve a filed record without tracking code @T22", async ({ page }) => {
  const sku = `SKU-${crypto.randomUUID()}`;
  const location = `LOC-${crypto.randomUUID()}`;
  await file(page, sku, location, "5");
  await lookup(page, sku, location);
  await expect(page.getByTestId("lookup-result")).toContainText("5");
  await expect(page.getByTestId("lookup-not-tracked")).toBeVisible();
});
