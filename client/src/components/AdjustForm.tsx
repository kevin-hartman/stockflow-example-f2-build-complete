import { useState, type FormEvent } from "react";
import { useAdjustment } from "../hooks/useAdjustment";

interface Props {
  sku: string;
  location: string;
}

function ReadOnlyField({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="field__input" data-testid={id} value={value} readOnly />
    </div>
  );
}

/** Set an existing (sku, location) record to a counted value; every change writes an audit record. */
export function AdjustForm({ sku, location }: Props) {
  const { current, audit, adjusted, error, busy, submit, fail } = useAdjustment(sku, location);
  const [quantity, setQuantity] = useState("");
  const [actor, setActor] = useState("");
  const actorError = error?.field === "actor" ? error.message : null;
  const quantityError = error?.field === "quantity" ? error.message : null;
  const formError = error && !actorError && !quantityError ? error.message : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!actor.trim()) return fail({ field: "actor", message: "Your name is required" });
    const n = Number(quantity);
    await submit({
      sku,
      location,
      quantity: quantity.trim() !== "" && Number.isInteger(n) ? n : quantity,
      actor: actor.trim(),
    });
  }

  return (
    <section className="card">
      <h2 className="card__title">Adjust to counted value</h2>
      <p className="page__subtitle">
        Current quantity: <strong data-testid="adjust-current-qty">{current ?? "—"}</strong>
      </p>
      <form className="form" data-testid="adjust-form" onSubmit={onSubmit} noValidate>
        <ReadOnlyField id="field-sku" label="SKU" value={sku} />
        <ReadOnlyField id="field-location" label="Location" value={location} />
        <div className={`field${quantityError ? " field--error" : ""}`}>
          <label className="field__label" htmlFor="field-quantity">
            Counted quantity
          </label>
          <input
            id="field-quantity"
            className="field__input"
            data-testid="field-quantity"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          {quantityError && (
            <p className="field__error" role="alert" data-testid="field-quantity-error">
              {quantityError}
            </p>
          )}
        </div>
        <div className={`field${actorError ? " field--error" : ""}`}>
          <label className="field__label" htmlFor="field-actor">
            Your name
          </label>
          <input
            id="field-actor"
            className="field__input"
            data-testid="field-actor"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
          />
          {actorError && (
            <p className="field__error" role="alert" data-testid="field-actor-error">
              {actorError.toLowerCase().includes("your name") ? actorError : `Your name: ${actorError}`}
            </p>
          )}
        </div>
        {formError && (
          <p className="field__error" role="alert" data-testid="form-error">
            {formError}
          </p>
        )}
        <div className="form__actions">
          <button type="submit" className="btn btn--primary" data-testid="adjust-submit" aria-busy={busy}>
            Adjust
          </button>
        </div>
      </form>
      {adjusted && (
        <>
          <div className="alert alert--success" role="status" data-testid="adjust-success">
            Adjusted <strong>{adjusted.sku}</strong> at <strong>{adjusted.location}</strong> from{" "}
            <strong>{adjusted.prior_quantity}</strong> to <strong>{adjusted.new_quantity}</strong> by{" "}
            <strong>{adjusted.actor}</strong>
          </div>
          <div className="toast-region" aria-live="polite">
            <div className="toast toast--success" data-testid="toast-success">
              Stock adjusted
            </div>
          </div>
        </>
      )}
      <h3 className="card__title">Adjustment history</h3>
      {audit && audit.length === 0 && (
        <div className="empty-state" data-testid="adjust-audit-empty" role="status">
          <p className="empty-state__title">No adjustments yet</p>
          <p className="empty-state__copy">Adjustments to this record will be listed here.</p>
        </div>
      )}
      {audit && audit.length > 0 && (
        <table className="stock-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th className="stock-table__num">From</th>
              <th className="stock-table__num">To</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((a) => (
              <tr key={a.id} data-testid={`adjust-audit-row-${a.id}`}>
                <td>{new Date(a.adjusted_at).toLocaleString()}</td>
                <td>{a.actor}</td>
                <td className="stock-table__num">{a.prior_quantity}</td>
                <td className="stock-table__num">{a.new_quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
