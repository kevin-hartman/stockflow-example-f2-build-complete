import { test, expect } from "./consort-fixtures";

test("quantity right-aligned, text columns left @T48", async ({ page, request }) => {
  const loc = `LOC-${crypto.randomUUID()}`;
  const skus = [`SKU-${crypto.randomUUID()}`, `SKU-${crypto.randomUUID()}`];
  const qtys = [7, 123456];
  for (let i = 0; i < 2; i++) {
    const r = await request.post("/api/stock", {
      data: { sku: skus[i], location: loc, quantity: qtys[i], tracking_code: `TC-${crypto.randomUUID()}` },
    });
    expect(r.ok()).toBe(true);
  }
  await page.goto("/");
  const align = (l: ReturnType<typeof page.getByTestId>) =>
    l.evaluate((el) => getComputedStyle(el).textAlign);
  const right = async (l: ReturnType<typeof page.getByTestId>) =>
    expect(["right", "end"]).toContain(await align(l));
  const left = async (l: ReturnType<typeof page.getByTestId>) =>
    expect(["left", "start"]).toContain(await align(l));
  await right(page.getByTestId("stock-col-quantity"));
  for (const sku of skus) {
    await right(page.getByTestId(`stock-qty-${sku}-${loc}`));
    await left(page.getByTestId(`stock-row-${sku}-${loc}`).locator("td").first());
    await left(page.getByTestId(`stock-tracking-${sku}-${loc}`));
  }
});
