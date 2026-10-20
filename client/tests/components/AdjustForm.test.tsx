import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AdjustForm } from "../../src/components/AdjustForm";

async function seed(sku: string, location: string, quantity = 7) {
  const r = await fetch("/api/stock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku, location, quantity }),
  });
  expect(r.ok).toBe(true);
}

async function open() {
  const sku = `SKU-${crypto.randomUUID()}`;
  const loc = `LOC-${crypto.randomUUID()}`;
  await seed(sku, loc);
  render(
    <MemoryRouter>
      <AdjustForm sku={sku} location={loc} />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByTestId("adjust-current-qty")).toHaveTextContent("7"));
  return { sku, loc, user: userEvent.setup() };
}

describe("AdjustForm", () => {
  it("shows the current quantity 7 read-only @T2", async () => {
    await open();
    const cur = screen.getByTestId("adjust-current-qty");
    expect(cur).toHaveTextContent("7");
    expect(cur.tagName).not.toBe("INPUT");
    expect(cur.querySelector("input")).toBeNull();
  });

  it("renders every field with a visible persistent label @T3", async () => {
    await open();
    for (const id of ["field-sku", "field-location", "field-quantity", "field-actor"]) {
      const control = screen.getByTestId(id);
      const label = document.querySelector(`label[for="${control.id}"]`);
      expect(label, id).not.toBeNull();
      expect(label).toHaveClass("field__label");
      expect(label!.textContent!.trim().length).toBeGreaterThan(0);
    }
  });

  it("confirms the adjustment naming sku, location, prior to new quantity and actor @T4", async () => {
    const { sku, loc, user } = await open();
    await user.clear(screen.getByTestId("field-quantity"));
    await user.type(screen.getByTestId("field-quantity"), "4");
    await user.type(screen.getByTestId("field-actor"), "alice");
    await user.click(screen.getByTestId("adjust-submit"));
    const ok = await screen.findByTestId("adjust-success");
    expect(ok).toHaveTextContent(sku);
    expect(ok).toHaveTextContent(loc);
    expect(ok).toHaveTextContent("7");
    expect(ok).toHaveTextContent("4");
    expect(ok).toHaveTextContent("alice");
  });

  async function submitWithoutActor() {
    const ctx = await open();
    await ctx.user.clear(screen.getByTestId("field-quantity"));
    await ctx.user.type(screen.getByTestId("field-quantity"), "4");
    await ctx.user.click(screen.getByTestId("adjust-submit"));
    return ctx;
  }

  it("renders field-actor-error naming Your name on a field--error field @T34", async () => {
    await submitWithoutActor();
    const err = await screen.findByTestId("field-actor-error");
    expect(err).toHaveTextContent(/your name/i);
    expect(screen.getByTestId("field-actor").closest(".field")).toHaveClass("field--error");
    expect(screen.queryByTestId("adjust-success")).toBeNull();
  });

  it("keeps adjust-current-qty at 7 after the empty-actor rejection @T35", async () => {
    await submitWithoutActor();
    await screen.findByTestId("field-actor-error");
    expect(screen.getByTestId("adjust-current-qty")).toHaveTextContent("7");
  });

  it("shows adjust-audit-empty with no audit row after the rejection @T36", async () => {
    await submitWithoutActor();
    await screen.findByTestId("field-actor-error");
    expect(await screen.findByTestId("adjust-audit-empty")).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^adjust-audit-row-/)).toHaveLength(0);
  });
});
