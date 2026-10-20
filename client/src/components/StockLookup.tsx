import { useState, type FormEvent } from "react";
import { useLocations } from "../hooks/useLocations";
import { useStockRecord } from "../hooks/useStockRecord";
import { LocationCombobox } from "./LocationCombobox";
import { TrackingCode } from "./TrackingCode";

/** Retrieve the filed record for a (sku, location). */
export function StockLookup() {
  const { locations } = useLocations();
  const { state, lookup } = useStockRecord();
  const [sku, setSku] = useState("");
  const [location, setLocation] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void lookup(sku, location);
  }

  return (
    <section className="card" data-testid="stock-lookup">
      <h2 className="card__title">Look up a record</h2>
      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="lookup-sku">
            SKU
          </label>
          <input
            id="lookup-sku"
            className="field__input"
            data-testid="lookup-sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          />
        </div>
        <LocationCombobox
          testId="lookup-location"
          label="Location"
          value={location}
          options={locations}
          onChange={setLocation}
        />
        <div className="form__actions">
          <button
            type="submit"
            className="btn btn--secondary"
            data-testid="lookup-submit"
            aria-busy={state.status === "loading"}
          >
            Look up
          </button>
        </div>
      </form>
      <div aria-live="polite">
        {state.status === "found" && (
          <table className="stock-table" data-testid="lookup-result">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Location</th>
                <th className="stock-table__num">Quantity</th>
                <th>Tracking code</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{state.record.sku}</td>
                <td>{state.record.location}</td>
                <td className="stock-table__num">{state.record.quantity}</td>
                <td>
                  <TrackingCode code={state.record.tracking_code} notTrackedTestId="lookup-not-tracked" />
                </td>
              </tr>
            </tbody>
          </table>
        )}
        {state.status === "empty" && (
          <div className="empty-state" data-testid="lookup-empty">
            <p className="empty-state__title">No record</p>
            <p className="empty-state__copy">Nothing is filed for that SKU at that location.</p>
          </div>
        )}
        {state.status === "error" && (
          <p className="alert alert--error" role="alert">
            {state.message}
          </p>
        )}
      </div>
    </section>
  );
}
