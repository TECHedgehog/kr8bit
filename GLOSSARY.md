# Game Library

The game library tracks discovered game entries and their metadata. Library scans discover entries under a configured root and reconcile them with the library.

## Language

**Library scan**:
An attempt to discover game entries under a configured library root and reconcile them with the game library.

**Scan run**:
A recorded execution of a library scan, with a status and summary counts.

**Scan progress**:
Live account of a scan run's discovered, processed, added, updated, and failed entries.

**Demo session**:
An isolated library namespace rooted at a session-specific path. Demo sessions use the production scanner with in-memory filesystem and metadata-provider adapters.
