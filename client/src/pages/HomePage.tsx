import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocations } from "../hooks/useLocations";
import { useStockList } from "../hooks/useStockList";
import { LocationCombobox } from "../components/LocationCombobox";
import { StockTable } from "../components/StockTable";
import { useHealth } from "../hooks/useHealth";
import { StatusBadge, type BadgeTone } from "../components/StatusBadge";

const ALL_LOCATIONS = "All locations";

// Home: stock by location. Pages wire hooks to components; every state
// (loading, success, error, empty) is explicit, never a blank region.
export function HomePage() {
  const { locations } = useLocations();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const stock = useStockList(location);
  const health = useHealth();
  const navigate = useNavigate();
  const tone: BadgeTone = health.status === "ok" ? "ok" : health.status === "error" ? "error" : "warn";
  const healthLabel =
    health.status === "ok"
      ? `Backend ${health.backend}`
      : health.status === "error"
        ? `Backend unreachable: ${health.message}`
        : "Checking backend...";

  function select(value: string) {
    const picked = value === ALL_LOCATIONS ? "" : value;
    setQuery(picked);
    setLocation(picked);
  }

  return (
    <main className="page">
      <header className="page__header">
        <img className="page__icon" src="/warehouse.png" alt="" />
        <div>
          <h1 className="page__title">Stock by location</h1>
          <p className="page__subtitle">Every SKU held, by warehouse location</p>
        </div>
        <StatusBadge tone={tone} label={healthLabel} />
      </header>
      <section className="card">
        <LocationCombobox
          testId="warehouse-select"
          label="Warehouse location"
          value={query}
          options={[ALL_LOCATIONS, ...locations]}
          onChange={(v) => {
            setQuery(v);
            if (v.trim() === "") setLocation("");
          }}
          onSelect={select}
        />
        {stock.status === "loading" && (
          <p className="field__hint" data-testid="stock-loading" role="status" aria-live="polite">
            Loading stock...
          </p>
        )}
        {stock.status === "error" && (
          <div className="alert alert--error" data-testid="stock-error" role="alert">
            Could not load stock: {stock.message}
          </div>
        )}
        {stock.status === "ok" && <StockTable rows={stock.rows} onRowClick={(sku) => navigate(`/sku/${encodeURIComponent(sku)}`)} />}
      </section>
    </main>
  );
}
