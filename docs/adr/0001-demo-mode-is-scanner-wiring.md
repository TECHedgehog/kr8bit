# ADR 0001: Demo mode is scanner wiring

## Status

Accepted

## Decision

Demo mode runs the production scanner with demo-specific `ScannerDeps` adapters. The scanner owns scan-run lifecycle, discovery, matching, persistence, and canonical progress events. Demo adapters provide a virtual filesystem, seeded metadata search, metadata refresh, and pacing.

Library scoping is bound when creating repository and service instances. HTTP handlers create scoped library services per request; scanner scope remains at scan start and status boundaries.

Demo path prefixes are owned by `src/http/demo-session.ts`.

## Consequences

- Demo and normal scans share scanner behavior and lifecycle.
- Demo metadata remains pending when no seeded metadata exists.
- Per-session library queries cannot read or mutate other sessions' rows.
- Demo behavior changes with production scanner matching and recovery behavior.
