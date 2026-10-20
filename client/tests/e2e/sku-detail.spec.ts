import { test, expect } from "./consort-fixtures";
import type { APIRequestContext } from "@playwright/test";

async function seed(
  request: APIRequestContext,
  sku: string,
  location: string,
  quantity: number,
  tracking_code?: string,
) {
  const r = await request.post("/api/stock", { data: { sku, location, quantity, tracking_code } });
  expect(r.ok()).toBe(true);
}

const uid = (p: string) => `${p}-${crypto.randomUUID()}`;

test("lists each location with quantity @T55", async ({ page, request }) => {
  const sku = uid("SKU");
  const locs = [uid("LOC"), uid("LOC"), uid("LOC")];
  for (const [i, l] of locs.entries()) await seed(request, sku, l, i + 2);
  await page.goto(`/sku/${sku}`);
  for (const [i, l] of locs.entries()) {
    await expect(page.getByTestId(`sku-location-${l}`)).toBeVisible();
    await expect(page.getByTestId(`sku-qty-${l}`)).toHaveText(String(i + 2));
  }
});

test("excludes another SKU's locations @T56", async ({ page, request }) => {
  const sku = uid("SKU");
  const other = uid("SKU");
  const mine = uid("LOC");
  const theirs = uid("LOC");
  await seed(request, sku, mine, 1);
  await seed(request, other, theirs, 5);
  await page.goto(`/sku/${sku}`);
  await expect(page.getByTestId(`sku-location-${mine}`)).toBeVisible();
  await expect(page.getByTestId(`sku-location-${theirs}`)).toHaveCount(0);
});

test("home row click navigates to the SKU detail @T57", async ({ page, request }) => {
  const sku = uid("SKU");
  const loc = uid("LOC");
  await seed(request, sku, loc, 4);
  await page.goto("/");
  await page.getByTestId(`stock-row-${sku}-${loc}`).click();
  await expect(page).toHaveURL(new RegExp(`/sku/${sku}$`));
  await expect(page.getByTestId("sku-detail")).toBeVisible();
  await expect(page.getByTestId("sku-locations")).toBeVisible();
});

test("quantity-0-only SKU shows the empty state @T67", async ({ page, request }) => {
  const sku = uid("SKU");
  const loc = uid("LOC");
  await seed(request, sku, loc, 0);
  await page.goto(`/sku/${sku}`);
  await expect(page.getByTestId("sku-empty")).toContainText("This SKU has no stock at any location");
  await expect(page.getByTestId(`sku-location-${loc}`)).toHaveCount(0);
});

test("never-filed SKU shows the empty state @T68", async ({ page }) => {
  await page.goto(`/sku/${uid("SKU")}`);
  await expect(page.getByTestId("sku-empty")).toBeVisible();
  await expect(page.getByTestId("sku-error")).toHaveCount(0);
});

test("coded location shows its tracking code @T60", async ({ page, request }) => {
  const sku = uid("SKU");
  const loc = uid("LOC");
  const code = uid("TC");
  await seed(request, sku, loc, 2, code);
  await page.goto(`/sku/${sku}`);
  await expect(page.getByTestId(`sku-tracking-${loc}`)).toContainText(code);
});

test("uncoded location shows Not tracked @T61", async ({ page, request }) => {
  const sku = uid("SKU");
  const loc = uid("LOC");
  await seed(request, sku, loc, 2);
  await page.goto(`/sku/${sku}`);
  await expect(page.getByTestId(`sku-tracking-not-tracked-${loc}`)).toHaveText("Not tracked");
});

test("par level region shows Not tracked @T63", async ({ page, request }) => {
  const sku = uid("SKU");
  await seed(request, sku, uid("LOC"), 3);
  await page.goto(`/sku/${sku}`);
  await expect(page.getByTestId("sku-par-level").getByTestId("sku-par-not-tracked")).toHaveText("Not tracked");
  await expect(page.getByTestId("sku-error")).toHaveCount(0);
});
