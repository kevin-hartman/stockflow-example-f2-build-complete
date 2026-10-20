import { useParams } from "react-router-dom";
import { useSkuDetail } from "../hooks/useSkuDetail";
import { SkuLocationsTable } from "../components/SkuLocationsTable";
import { TrackingCode } from "../components/TrackingCode";

// SKU detail: one SKU's stock across locations + its par level. Every state
// (loading, success, error, empty) is explicit, never a blank region.
export function SkuDetailPage() {
  const sku = useParams().sku ?? "";
  const detail = useSkuDetail(sku);

  return (
    <main className="page page--narrow" data-testid="sku-detail">
      <header className="page__header">
        <img className="page__icon" src="/warehouse.png" alt="" />
        <div>
          <h1 className="page__title">{sku}</h1>
          <p className="page__subtitle">Stock at every location holding this SKU</p>
        </div>
      </header>
      <section className="card">
        <h2 className="card__title">Locations</h2>
        {detail.status === "loading" && (
          <p className="field__hint" data-testid="sku-loading" role="status" aria-live="polite">
            Loading SKU...
          </p>
        )}
        {detail.status === "error" && (
          <div className="alert alert--error" data-testid="sku-error" role="alert">
            Could not load this SKU: {detail.message}
          </div>
        )}
        {detail.status === "ok" && <SkuLocationsTable sku={sku} rows={detail.locations} />}
      </section>
      <section className="card" data-testid="sku-par-level">
        <h2 className="card__title">Par level</h2>
        <TrackingCode code={null} notTrackedTestId="sku-par-not-tracked" />
      </section>
    </main>
  );
}
