# ADR 0003: Domain settings use domain endpoints

## Status

Accepted

## Decision

Each owning module declares static settings specs with key, kind, default, constraints, and internal status. The settings module remains a generic key/value persistence and validation layer; it does not own domain setting names or orchestration.

Domain-specific settings are read and updated through the owning module's API. Repack catalog settings use `GET` and `PUT /api/repack-catalog/settings`, with typed request values and job reconfiguration handled by the repack catalog job.

Internal settings remain unavailable to generic user updates. Domain prefixes are reserved from `PUT /api/settings`.

## Consequences

- New settings must be declared by their owner and composed into settings validation.
- Domain endpoints can expose typed values, defaults, and constraints without coupling the generic settings API to domain behavior.
- Existing repack catalog updates move from `PUT /api/settings` to `PUT /api/repack-catalog/settings`.
