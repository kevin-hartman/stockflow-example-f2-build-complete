import { test, expect } from "./consort-fixtures";
import type { APIRequestContext, Page } from "@playwright/test";

const uid = (p: string) => `${p}-${crypto.randomUUID()}`;

async function seed(request: APIRequestContext, sku: string, location: string, quantity: number) {
  const r = await request.post("/api/stock", { data: { sku, location, quantity } });
  expect(r.ok()).toBe(true);
}

async function submitWithoutActor(page: Page, sku: string, loc: string) {
  await page.goto(`/adjust?sku=${encodeURIComponent(sku)}&location=${encodeURIComponent(loc)}`);
  await expect(page.getByTestId("adjust-current-qty")).toContainText("7");
  await page.getByTestId("field-quantity").fill("4");
  await page.getByTestId("adjust-submit").click();
}

test("empty actor shows an inline field-actor-error naming Your name @T37", async ({ page, request }) => {
  const sku = uid("SKU");
  const loc = uid("LOC");
  await seed(request, sku, loc, 7);
  await submitWithoutActor(page, sku, loc);
  const field = page.locator(".field", { has: page.getByTestId("field-actor") });
  await expect(field.getByTestId("field-actor-error")).toBeVisible();
  await expect(field.getByTestId("field-actor-error")).toContainText(/your name/i);
});

test("empty-actor rejection leaves quantity 7 and no audit row @T38", async ({ page, request }) => {
  const sku = uid("SKU");
  const loc = uid("LOC");
  await seed(request, sku, loc, 7);
  await submitWithoutActor(page, sku, loc);
  await expect(page.getByTestId("field-actor-error")).toBeVisible();
  await expect(page.getByTestId("adjust-current-qty")).toContainText("7");
  await expect(page.getByTestId("adjust-success")).toHaveCount(0);
  await expect(page.locator('[data-testid^="adjust-audit-row-"]')).toHaveCount(0);
});
