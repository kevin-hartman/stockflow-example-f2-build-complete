# F2 Stock adjustment

## Summary
Lets the warehouse team correct the stock level of one SKU at one location when the shelf count disagrees with the system, either to a corrected value or by a delta. Every adjustment leaves an unmodifiable audit record of when and who, and stock can never go below zero.

## Data semantics
- An adjustment applies to an existing (sku, location) stock record from F1; "who" is an explicit actor name the operator types (no authentication in V1, per nfrs.md Out of bounds).
- Stock quantity is never negative; 0 is a valid stored level. A rejected adjustment changes nothing and writes no audit record.
- An adjustment audit record is append-only: never edited or deleted after it is written.

## Stories
- S1-adjust-to-value: set a (sku, location) to a corrected quantity via the adjustment form, writing an immutable audit record of when and who (ACs: AC1-form-sets-corrected-level, AC2-audit-record-captures-when-and-who, AC3-audit-record-unmodifiable, AC4-actor-required).
- S2-adjust-by-delta: adjust a (sku, location) by a positive or negative delta via the adjustment form; the new level is computed from current stock and audited with the delta (ACs: AC1-positive-delta-increases-level, AC2-negative-delta-decreases-level, AC3-delta-audit-records-resulting-level).
- S3-reject-negative-stock: reject any adjustment (delta or corrected value) that would take stock below zero, inline next to the field naming it, enforced at write time; adjusting to exactly 0 is allowed (ACs: AC1-negative-delta-rejected-inline, AC2-negative-corrected-value-rejected-inline, AC3-adjust-to-exactly-zero-accepted, AC4-negative-rejected-at-write-without-form).

## Out of scope
- A delta that would take stock below zero is handled by S3, not S2.
- Authentication or derived user identity (actor is typed input).
- Editing or reverting a past adjustment.
- Real-time multi-operator conflict resolution beyond the no-overcommit rule.

## Open questions
- OQ1 (S1): Can an adjustment create stock for a (sku, location) pair that has no existing record? Recommended: no, S1 adjusts existing records only; creating stock stays F1's file-stock path.
- OQ2 (S1): Is a reason/note required on an adjustment? Recommended: not for V1 (the request asks only for when and who).
- OQ3 (S1): Does the operator see the audit trail in the UI in this feature? Recommended: no UI view in F2; the audit record must be retrievable, and a history screen can be a later feature.
- OQ4 (S2): Is a delta of 0 a valid adjustment (an audited no-op count confirmation)? Recommended: reject it inline on the delta field, since it changes nothing.
- OQ5 (S3): A quantity-0 record left by an adjustment: does F1's stock views treat it as not holding stock? Recommended: follow F1's existing data semantics for quantity-0 rows; F2 does not redefine them.
