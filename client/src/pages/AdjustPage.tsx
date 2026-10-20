import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AdjustForm } from "../components/AdjustForm";

/** Pick a (sku, location) pair, then adjust it to a counted value. */
function PairPicker({ onPick }: { onPick: (sku: string, location: string) => void }) {
  const [sku, setSku] = useState("");
  const [location, setLocation] = useState("");
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sku.trim() && location.trim()) onPick(sku.trim(), location.trim());
  }
  return (
    <section className="card">
      <h2 className="card__title">Choose a stock record</h2>
      <form className="form" data-testid="adjust-pick-form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="pick-sku">
            SKU
          </label>
          <input id="pick-sku" className="field__input" data-testid="pick-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="pick-location">
            Location
          </label>
          <input
            id="pick-location"
            className="field__input"
            data-testid="pick-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div className="form__actions">
          <button type="submit" className="btn btn--secondary" data-testid="adjust-pick-submit">
            Open
          </button>
        </div>
      </form>
    </section>
  );
}

export function AdjustPage() {
  const [params, setParams] = useSearchParams();
  const sku = params.get("sku") ?? "";
  const location = params.get("location") ?? "";
  return (
    <main className="page page--narrow">
      <header className="page__header">
        <h1 className="page__title">Adjust stock</h1>
      </header>
      {sku && location ? (
        <AdjustForm key={`${sku}|${location}`} sku={sku} location={location} />
      ) : (
        <PairPicker onPick={(s, l) => setParams({ sku: s, location: l })} />
      )}
    </main>
  );
}
