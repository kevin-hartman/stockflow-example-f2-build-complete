# StockFlow Information Architecture

## Screens
| Screen | Route | Purpose | Stories | Key seams |
|---|---|---|---|---|
| Home: stock by location | `/` | warehouse picker (F7) + `stock-table` of SKU x location with qty + status badge; scan zone | F1, F7, F8, S2-stock-by-location-table | S2: `stock-table` class, columns SKU / Location / Quantity / Tracking code, one row per (sku, location) holding stock; tracking cell shows the code or an explicit "Not tracked" (`tracking-not-tracked`), never blank; Quantity header + cells right-aligned (`--font-mono`, tabular-nums), text columns left-aligned; `warehouse-select` combobox (ALL distinct locations, see Controls) filters to one location; a location on record with no stock / only qty-0 records → `stock-empty` `empty-state` "No stock at this location" in place of rows (no empty tbody) + CTA to `/receive`. Seams: `stock-table`, `stock-col-quantity`, `stock-qty-<sku>-<loc>`, `stock-tracking-<sku>-<loc>`, `tracking-not-tracked`, `stock-row-<sku>-<loc>`, `stock-empty`, `stock-loading`, `stock-error`, `warehouse-select`, `scan-zone`, `scan-input` |
| SKU detail | `/sku/:sku` | narrow page: per-location qty, batch/serial (tracking code parts, F6) or "Not tracked" | F1, F6, S3-sku-detail-view | S3: `sku-locations` lists ONLY this SKU's locations holding stock (`sku-location-<loc>`), qty right-aligned (`sku-qty-<loc>`, `--font-mono`); per-location tracking cell shows the combined code (`sku-tracking-<loc>`) or explicit "Not tracked" (`sku-tracking-not-tracked-<loc>`), never blank; `card` par-level region `sku-par-level` shows "Not tracked" (`sku-par-not-tracked`) when par is untracked, never blank/error; SKU with no stock anywhere (no / only qty-0 records) → `empty-state` `sku-empty` "This SKU has no stock at any location" + CTA to `/receive?sku=<sku>`, never an error page. No interactive filter. Seams: `sku-detail`, `sku-location-<loc>`, `sku-qty-<loc>`, `sku-tracking-<loc>`, `sku-tracking-not-tracked-<loc>`, `sku-par-level`, `sku-par-not-tracked`, `sku-empty`, `sku-locations`, `sku-tracking`, `sku-not-tracked`, `sku-error` |
| Adjust stock | `/adjust` (prefill `?sku=&location=`) | set/adjust qty for one SKU at one location | F2 | `adjust-form`, `field-sku`, `field-location`, `field-quantity`, `form-error`, `adjust-success` |
| Receive | `/receive` (`?sku=`) | inbound receipt: supplier, SKU, qty, location | F3 | `receive-form`, `field-supplier`, `form-error`, `receive-confirmation` |
| Pick | `/pick` | outbound pick for an order; refuses overcommit | F4 | `pick-form`, `field-order`, `field-quantity-error`, `pick-confirmation` |
| Cycle count | `/count` | count a location, show the variance, reconcile | F5 | `count-form`, `count-variance`, `count-confirmation` |
| Search | `/search?q=` | find SKUs or tracking codes | F9 | `search-input`, `search-results`, `search-empty` |
| File stock | `/file` (prefill `?sku=&location=`) | file or retrieve one stock record for a (sku, location): SKU, location, quantity, optional tracking_code; a repeat file for the same pair updates in place and shows the normal confirmation; a lookup panel retrieves the record back | S1-file-stock (F1) | `file-stock-form`, `field-sku`, `field-location`, `field-quantity`, `field-tracking-code`, `file-submit`, `form-error`, `file-confirmation`, `stock-lookup`, `lookup-sku`, `lookup-location`, `lookup-submit`, `lookup-result`, `lookup-not-tracked`, `lookup-empty` |
| About | `/about` | product tagline | — | `about-page` |

Global seams: `navbar`, `toast-region`, `toast-success`, `toast-error`.

## Controls
Each interactive control declares its TYPE, its OPTION SOURCE, and the states a user must be able to reach THROUGH the control — so the surface is usable by construction and an e2e drives the real control, never a URL/query-param bypass. A named-but-unusable control (e.g. a native `<datalist>` whose options are only the filtered rows and whose empty option cannot be selected) is an IA defect.
| Control | Screen | Type | Option source | Reachable states |
|---|---|---|---|---|
| `warehouse-select` | Home `/` | accessible combobox (listbox popup anchored under the input, keyboard-navigable) | ALL distinct locations (not only those currently holding stock), plus an "All locations" option | pick a location with stock → table; pick an EMPTY location → `stock-empty` reachable through the control; clear → all locations |
| `field-location` | File stock `/file` | accessible creatable combobox (`field` class, listbox popup anchored under the input, keyboard-navigable) | ALL distinct locations on record (server-queried, not filtered by SKU), plus a "Use new location \"<typed>\"" option | choose an existing location without retyping → submit; type a never-used location → create option → submit; empty → inline `form-error` |
| `field-tracking-code` | File stock `/file` | optional text input (persistent label "Tracking code (optional)") | free-text | blank → filed as not tracked; given → stored |
| `lookup-location` | File stock `/file` | accessible combobox (same option source as `field-location`, no create option) | ALL distinct locations on record | pick a pair with a record → `lookup-result`; pair with no record → `lookup-empty` |
| `search-input` | Search `/search` | text search box | free-text, server-queried | results; no match → `search-empty` |

## Navigation
- **Navbar** (`App.tsx`):
  - brand (icon + "StockFlow") links to `/`
  - links: Stock `/`, File stock `/file`, Receive `/receive`, Pick `/pick`, Adjust `/adjust`, Count `/count`, Search `/search`, About `/about`
  - the active link is brand red
- **Contextual links:**
  - a stock row or a search result opens `/sku/:sku`
  - the SKU detail page has Adjust / Receive / Pick buttons that open the form prefilled
  - the empty-state CTA opens `/receive`
  - the SKU detail page has a File stock button → `/file?sku=<sku>&location=<loc>`
  - `file-confirmation` links to `/sku/:sku` and offers "File another"
  - a confirmation view links back to `/sku/:sku` and `/`
- **Routing:** every screen above is a `<Route>` in `App.tsx`. Unknown routes show an inline not-found alert with a link home.

## User flows
1. **See stock (F1/F7):** open `/` → pick a warehouse → the table shows qty + status pill. Empty location → empty state → CTA to Receive.
2. **Drill down (F1/F6):** click a row → `/sku/:sku` → see locations and tracking detail, or "Not tracked".
3. **Adjust (F2):** detail → Adjust → submit. Success: green toast + the row updates. Invalid input: inline field error.
4. **Receive (F3):** `/receive` → supplier, SKU, qty, location → confirmation view. Unknown SKU: inline field error.
5. **Pick (F4):** `/pick` → order, SKU, qty, location → confirmation. Overcommit: inline error on the quantity field, stating what is available.
6. **Cycle count (F5):** `/count` → enter the counted qty → variance shown → reconcile → confirmation.
7. **Scan (F8):** focus the scan zone on `/` → scan. Success: green flash + row flash + qty update. Unknown barcode or locked SKU: red flash + persistent error toast.
8. **Search (F9):** `/search` → type → results. No match: empty state.
9. **File stock (S1-file-stock, AC1):** navbar → `/file` → SKU, choose an existing location from `field-location` (or type a new one), qty, optional tracking code → submit → `file-confirmation` shows sku, location, qty, tracking code or "Not tracked" + success toast. Invalid input: inline `form-error`.
10. **Retrieve filed stock (S1-file-stock, AC2):** `/file` → `stock-lookup` → SKU + `lookup-location` → `lookup-result` shows the filed sku, location, qty, tracking code (or `lookup-not-tracked`); no record → `lookup-empty`.
11. **Re-file same pair (S1-file-stock, AC3):** `/file` → file the same (sku, location) again with a new qty and/or tracking code → normal `file-confirmation` (no error page); lookup shows exactly one updated record.
12. **Stock table (S2, AC1/AC2):** open `/` (All locations) → `stock-table` lists one row per (sku, location) with SKU, location, right-aligned quantity, tracking code or "Not tracked".
13. **Empty location (S2, AC3):** `/` → open `warehouse-select` → choose a location on record with no stock → `stock-empty` "No stock at this location" replaces rows → CTA to `/receive`.
14. **SKU detail (S3, AC1–AC3):** `/` → click `stock-row-<sku>-<loc>` → `/sku/:sku` → only that SKU's locations + qty, each with tracking code or "Not tracked"; par-level region shows "Not tracked".
15. **Stockless SKU (S3, AC4):** open `/sku/:sku` for a SKU with no stock → `sku-empty` "no stock at any location" → CTA to `/receive?sku=<sku>`.
