# ADR 0002: Repack matching owns its status vocabulary

## Status

Accepted

## Decision

`src/shared/match-policy.ts` classifies metadata search results using thresholds supplied per call. Scanner and repack catalog use same decision policy without depending on each other's modules.

Repack catalog keeps its own statuses: `MATCHED`, `REVIEW`, `PENDING`, and `REJECTED`. It maps shared `ACCEPTED` and `FLAGGED` decisions to `REVIEW`, `REJECTED` to `REJECTED`, and `PENDING` to `PENDING`. Successful metadata acceptance writes `MATCHED` through the repack repository.

## Consequences

- Scanner and repack catalog share decision logic while choosing thresholds at each call site.
- `REVIEW` remains repack API vocabulary; library `FLAGGED` and `ACCEPTED` statuses remain unchanged.
- Separate repack-specific environment thresholds can be added if policy needs diverge.
