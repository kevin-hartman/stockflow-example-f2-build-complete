import type { StockRecord } from "../api/stock";

interface Props {
  rows: StockRecord[];
  /** Opens the SKU detail for a clicked row (the page wires navigation). */
  onRowClick?: (sku: string) => void;
}

/** SKU x location stock table; an empty result renders the stock-empty state, never an empty tbody. */
export function StockTable({ rows, onRowClick }: Props) {
  if (rows.length === 0) {
    return (
      <div className="empty-state" data-testid="stock-empty" role="status">
        <p className="empty-state__title">No stock at this location</p>
        <p className="empty-state__copy">File stock here to see it listed.</p>
        <a className="btn btn--primary" href="/file">
          File stock
        </a>
      </div>
    );
  }
  return (
    <table className="stock-table" data-testid="stock-table">
      <thead>
        <tr>
          <th scope="col">SKU</th>
          <th scope="col">Location</th>
          <th scope="col" className="stock-table__num" data-testid="stock-col-quantity">
            Quantity
          </th>
          <th scope="col">Tracking code</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const key = `${r.sku}-${r.location}`;
          return (
            <tr
              key={key}
              data-testid={`stock-row-${key}`}
              onClick={onRowClick && (() => onRowClick(r.sku))}
              onKeyDown={onRowClick && ((e) => e.key === "Enter" && onRowClick(r.sku))}
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? "link" : undefined}
            >
              <td>{r.sku}</td>
              <td>{r.location}</td>
              <td className="stock-table__num" data-testid={`stock-qty-${key}`}>
                {r.quantity}
              </td>
              <td data-testid={`stock-tracking-${key}`}>
                {r.tracking_code ?? (
                  <span className="not-tracked" data-testid="tracking-not-tracked">
                    Not tracked
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
