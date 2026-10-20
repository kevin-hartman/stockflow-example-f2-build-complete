import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AdjustPage } from "../../src/pages/AdjustPage";

async function open() {
  const sku = `SKU-${crypto.randomUUID()}`;
  const loc = `LOC-${crypto.randomUUID()}`;
  const r = await fetch("/api/stock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku, location: loc, quantity: 7 }),
  });
  expect(r.ok).toBe(true);
  render(
    <MemoryRouter initialEntries={[`/adjust?sku=${encodeURIComponent(sku)}&location=${encodeURIComponent(loc)}`]}>
      <AdjustPage />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByTestId("adjust-current-qty")).toHaveTextContent("7"));
  return userEvent.setup();
}

describe("AdjustPage negative stock", () => {
  it("accepts a delta of -7 on 7 and shows 0 with one audit row @T55", async () => {
    const user = await open();
    await user.click(screen.getByTestId("adjust-mode-delta"));
    await user.type(screen.getByTestId("field-delta"), "-7");
    await user.type(screen.getByTestId("field-actor"), "alice");
    await user.click(screen.getByTestId("adjust-submit"));
    expect(await screen.findByTestId("adjust-success")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("adjust-current-qty")).toHaveTextContent(/^0$/));
    expect(await screen.findAllByTestId(/^adjust-audit-row-/)).toHaveLength(1);
  });

  it("rejects delta -10 inline at the delta field, quantity stays 7 @T49", async () => {
    const user = await open();
    await user.click(screen.getByTestId("adjust-mode-delta"));
    await user.type(screen.getByTestId("field-delta"), "-10");
    await user.type(screen.getByTestId("field-actor"), "alice");
    await user.click(screen.getByTestId("adjust-submit"));
    const err = await screen.findByTestId("field-delta-error");
    expect(err).toHaveTextContent(/quantity would go below zero/i);
    expect(screen.getByTestId("field-delta").closest(".field")).toHaveClass("field--error");
    expect(screen.getByTestId("adjust-current-qty")).toHaveTextContent("7");
  });

  it("rejects corrected value -2 inline at the quantity field, quantity stays 7 @T51", async () => {
    const user = await open();
    await user.clear(screen.getByTestId("field-quantity"));
    await user.type(screen.getByTestId("field-quantity"), "-2");
    await user.type(screen.getByTestId("field-actor"), "alice");
    await user.click(screen.getByTestId("adjust-submit"));
    const err = await screen.findByTestId("field-quantity-error");
    expect(err).toHaveTextContent(/corrected quantity/i);
    expect(screen.getByTestId("field-quantity").closest(".field")).toHaveClass("field--error");
    expect(screen.getByTestId("adjust-current-qty")).toHaveTextContent("7");
  });
});
