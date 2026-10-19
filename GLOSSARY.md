# Game Library

The game library tracks discovered game entries and their metadata. Library scans discover entries under a configured root and reconcile them with the library.

## Language

**Library scan**:
An attempt to discover game entries under a configured library root and reconcile them with the game library.

**Scan run**:
A recorded execution of a library scan, with a status and summary counts.

**Scan progress**:
Live account of a scan run's discovered, processed, added, updated, and failed entries.

**Match decision**:
Shared classification of metadata search results as pending, flagged, accepted, or rejected. Callers supply matching thresholds and map decisions into their own status vocabulary.

**Demo session**:
An isolated library namespace rooted at a session-specific path. Demo sessions use the production scanner with in-memory filesystem and metadata-provider adapters.

**Settings spec**:
Static declaration owned by a domain module describing a setting's key, kind, default, constraints, and internal status. Settings validation composes owner specs; domain endpoints manage domain-specific updates.

**Naming format**:
Template used to generate game entry names. Supported tags come from the library naming endpoint; custom format is validated and persisted by that domain endpoint.

**Rename preview**:
Per-game projection of a proposed naming-format application, including readiness, unchanged paths, conflicts, and unavailable entries.

**Release name**:
Name attached to a game distribution, including identifying title and release-specific details.

**Normalized name**:
Canonical title representation used to identify the same game across release variants.

**Match key**:
Comparison-friendly form of a normalized name, used to group or recognize equivalent titles.

**Group tag**:
Release marker identifying the group that prepared or distributed a game release.

**Edition phrase**:
Release-name phrase that distinguishes a game edition, such as Deluxe Edition or Game of the Year.

**Base game name**:
Game title without release-specific edition, version, bundle, or distribution details.
