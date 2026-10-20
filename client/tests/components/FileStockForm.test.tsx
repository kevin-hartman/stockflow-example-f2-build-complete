import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileStockForm } from "../../src/components/FileStockForm";

async function seed(sku: string, location: string) {
  const r = await fetch("/api/stock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku, location, quantity: 1 }),
  });
  expect(r.ok).toBe(true);
}

async function fill(sku: string, location: string, qty: string, code?: string) {
  const user = userEvent.setup();
  await user.type(screen.getByTestId("field-sku"), sku);
  await user.type(screen.getByTestId("field-location"), location);
  const create = screen.queryByRole("option", { name: /use new location/i });
  if (create) await user.click(create);
  await user.type(screen.getByTestId("field-quantity"), qty);
  if (code) await user.type(screen.getByTestId("field-tracking-code"), code);
  await user.click(screen.getByTestId("file-submit"));
}

describe("FileStockForm", () => {
  it("lists locations already on record @T10", async () => {
    const loc = `LOC-${crypto.randomUUID()}`;
    await seed(`SKU-${crypto.randomUUID()}`, loc);
    render(<FileStockForm />);
    await userEvent.setup().click(screen.getByTestId("field-location"));
    const list = await screen.findByRole("listbox");
    expect(await within(list).findByRole("option", { name: loc })).toBeInTheDocument();
  });

  it("offers Use new location for an unknown location @T11", async () => {
    render(<FileStockForm />);
    await userEvent.setup().type(screen.getByTestId("field-location"), `NEW-${crypto.randomUUID()}`);
    expect(await screen.findByRole("option", { name: /use new location/i })).toBeInTheDocument();
  });

  it("confirms with not-tracked when no tracking code @T12", async () => {
    render(<FileStockForm />);
    const sku = `SKU-${crypto.randomUUID()}`;
    await fill(sku, `NEW-${crypto.randomUUID()}`, "3");
    const conf = await screen.findByTestId("file-confirmation");
    expect(conf).toHaveTextContent(sku);
    expect(conf).toHaveTextContent(/not tracked/i);
  });

  it("confirms with the submitted tracking code @T13", async () => {
    render(<FileStockForm />);
    const code = `TC-${crypto.randomUUID()}`;
    await fill(`SKU-${crypto.randomUUID()}`, `NEW-${crypto.randomUUID()}`, "3", code);
    const conf = await screen.findByTestId("file-confirmation");
    expect(conf).toHaveTextContent(code);
  });

  it("renders an inline form-error naming quantity when API rejects negative @T14", async () => {
    render(<FileStockForm />);
    await fill(`SKU-${crypto.randomUUID()}`, `NEW-${crypto.randomUUID()}`, "-4");
    const err = await screen.findByTestId("form-error");
    expect(err).toHaveTextContent(/quantity/i);
  });
});
