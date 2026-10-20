import type { SkuLocation } from "../api/stock";
import { TrackingCode } from "./TrackingCode";

/** One SKU's per-location stock; no stock anywhere renders the sku-empty state, never an empty tbody. */
export function SkuLocationsTable({ sku, rows }: { sku: string; rows: SkuLocation[] }) {
  if (rows.length === 0) {
    return (
      <div className="empty-state" data-testid="sku-empty" role="status">
        <p className="empty-state__title">This SKU has no stock at any location</p>
        <p className="empty-state__copy">Receive stock for it to see it listed here.</p>
        <a className="btn btn--primary" href={`/receive?sku=${encodeURIComponent(sku)}`}>
          Receive stock
        </a>
      </div>
    );
  }
  return (
    <table className="stock-table" data-testid="sku-locations">
      <thead>
        <tr>
          <th scope="col">Location</th>
          <th scope="col" className="stock-table__num">
            Quantity
          </th>
          <th scope="col">Tracking code</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.location} data-testid={`sku-location-${r.location}`}>
            <td>{r.location}</td>
            <td className="stock-table__num" data-testid={`sku-qty-${r.location}`}>
              {r.quantity}
            </td>
            <td data-testid={`sku-tracking-${r.location}`}>
              {r.tracking_code ? (
                <TrackingCode code={r.tracking_code} />
              ) : (
                <span data-testid={`sku-tracking-not-tracked-${r.location}`}>
                  <TrackingCode code={null} notTrackedTestId="sku-tracking-not-tracked" />
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
