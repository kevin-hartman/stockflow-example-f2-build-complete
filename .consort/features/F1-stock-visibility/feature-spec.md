# Record and view stock by SKU and location

## Summary
Operators file the stock level of a SKU at a physical location and read it back, then scan it on a stock-by-location home table and a per-SKU detail view. This is the read-and-record foundation of StockFlow.

## Data semantics
- A stock record is uniquely identified by its `(sku, location)` pair; re-filing the same pair updates the record in place (never a duplicate, never an error page).
- `tracking_code` is optional: a record filed without it stores it as absent, and every view renders that as "not tracked", never blank.
- Par level is not tracked in V1; views render it as "not tracked".
- A `quantity-0` record is a filed record but is NOT holding stock: it is excluded from every stock view (home table, per-location view, SKU detail). A location with only quantity-0 records (or none) shows "No stock at this location". (Recommended resolution; PO to confirm.)

## Stories
- S1-file-stock — file a SKU's stock at an existing or new location (optional tracking_code) and retrieve it; same-pair re-file updates in place.
- S2-stock-by-location-table — home table of SKU, location, quantity, tracking code, with an empty-location state.
- S3-sku-detail-view — one SKU's stock across its locations, tracking code, par level "not tracked".

## Out of scope
- Adjusting quantities and receiving inbound goods (separate features).
- Splitting tracking_code into location/batch/serial fields (later iteration).
- App shell / navbar / brand icon / favicon are delivered by the design system and IA, not as a story.
- Authentication (per nfrs out-of-bounds, if stated).

## Open questions
- S1 collision semantics: recommended update-in-place (last write wins) per the request's "resolve the collision at write time"; PO to confirm vs. additive quantity.
- S1 quantity validation: recommended non-negative integers only; is 0 allowed? (recommended yes).
- S2 empty-location access: recommended the table offers a per-location view (e.g. a location filter) through which an empty location is reached; PO/UX to confirm presentation.
- S2 row ordering: recommended sort by location then SKU.
- S3 entry point: recommended the SKU detail view is reached by selecting a SKU in the home table; an unknown SKU shows the same no-stock empty state.
- S3 par level: confirm it stays 'not tracked' in V1 (no input to set it).
- S1 location identity: recommended exact match after trimming whitespace; are locations case-insensitive?
