import { useState, type FormEvent } from "react";
import { useFileStock } from "../hooks/useFileStock";
import { useLocations } from "../hooks/useLocations";
import { LocationCombobox } from "./LocationCombobox";
import { TrackingCode } from "./TrackingCode";

/** File one stock record for a (sku, location); a repeat filing updates it in place. */
export function FileStockForm() {
  const { locations, reload } = useLocations();
  const { filed, error, busy, submit, fail } = useFileStock();
  const [sku, setSku] = useState("");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState("");
  const [trackingCode, setTrackingCode] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sku.trim()) return fail("sku: SKU is required");
    if (!location.trim()) return fail("location: Location is required");
    const n = Number(quantity);
    const ok = await submit({
      sku: sku.trim(),
      location: location.trim(),
      quantity: quantity.trim() !== "" && Number.isInteger(n) ? n : quantity,
      tracking_code: trackingCode.trim() || null,
    });
    if (ok) reload();
  }

  return (
    <section className="card">
      <h2 className="card__title">File stock</h2>
      <form className="form" data-testid="file-stock-form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="field-sku">
            SKU
          </label>
          <input
            id="field-sku"
            className="field__input"
            data-testid="field-sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          />
        </div>
        <LocationCombobox
          testId="field-location"
          label="Location"
          value={location}
          options={locations}
          onChange={setLocation}
          creatable
        />
        <div className={`field${error?.startsWith("quantity") ? " field--error" : ""}`}>
          <label className="field__label" htmlFor="field-quantity">
            Quantity
          </label>
          <input
            id="field-quantity"
            className="field__input"
            data-testid="field-quantity"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="field-tracking-code">
            Tracking code (optional)
          </label>
          <input
            id="field-tracking-code"
            className="field__input"
            data-testid="field-tracking-code"
            value={trackingCode}
            onChange={(e) => setTrackingCode(e.target.value)}
          />
        </div>
        {error && (
          <p className="field__error" role="alert" data-testid="form-error">
            {error}
          </p>
        )}
        <div className="form__actions">
          <button type="submit" className="btn btn--primary" data-testid="file-submit" aria-busy={busy}>
            File stock
          </button>
        </div>
      </form>
      {filed && (
        <div className="alert alert--success" role="status" data-testid="file-confirmation">
          Filed <strong>{filed.sku}</strong> at <strong>{filed.location}</strong>: quantity{" "}
          <strong>{filed.quantity}</strong>, tracking code <TrackingCode code={filed.tracking_code} />
        </div>
      )}
    </section>
  );
}
