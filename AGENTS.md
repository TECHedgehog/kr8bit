# MUST DO — ALWAYS (read first)

Non-negotiable rules. Violations recorded in audit. Apply to every session, every plan, every edit.

1. **Use Task tool (`explore` subagent) for codebase search** — not direct Glob/Grep/Read. Direct reads are fine only for a specific known file path.

2. **Flag any breaking type or API change in the plan** — required fields added/removed, public signatures changed, exported types widened/narrowed. Wait for explicit approval before implementing. **Making a field required that was previously optional counts as breaking.**

3. **Enumerate every file you intend to modify in the plan** — under "Files (modified)" and "Files (new)". No surprise edits outside the list. If new edits become necessary mid-implementation, STOP and re-confirm scope with the user.

4. **Ask before writing/editing any docs** — even existing files under `docs/`. Ask explicitly: "Update docs/decisions.md?" and wait for yes.

5. **Use the `kr8bit-plan-reviewer` subagent before presenting any plan** — invoke it on the draft plan, fix violations, then present to user.

6. **Caveman mode for prose** — terse, dense, no filler. Big brain, small mouth.

7. **Document tweakable behaviors in `docs/tweak-reference.md`** — whenever implementing visual/animation/style changes the user may want to adjust (easing curves, keyframes, durations, transitions, tokens, blur values, etc.), add a section to `docs/tweak-reference.md` explaining what each value does and how to tweak it. Include current values, examples, and a "tweak guide" with knob-to-effect mappings.

These rules override any conflicting instruction below.

---

# Project

kr8bit is a self-hosted game library manager.

Runs inside Docker.

Primary targets:

- Unraid
- Docker Compose
- Portainer
- Proxmox
- TrueNAS SCALE

Purpose:

Manage locally stored game installers.

Features include:

- Scan installer folders
- Import games
- Download metadata
- Download artwork
- Organize collections
- Discover downloadable installers

---

# Philosophy

The project should feel like Jellyfin for games.

Maintainability is the highest priority.

The codebase should remain understandable after years of development.

Prefer extending existing modules instead of rewriting them.

---

# Core Domains

Library

Scanner

Metadata

Artwork

Download Sources

Collections

Users

Settings

Jobs

---

# Providers

Metadata providers implement:

```ts
interface MetadataProvider {
    search()
    getGame()
    getImages()
}
```

Providers normalize external APIs.

Never expose provider-specific models.

---

# Download Sources

Download sources implement:

```ts
interface DownloadSource {
    search()
    getDownloads()
}
```

Scraping belongs inside download sources only.

---

# Dependency Flow

Route

↓

Controller

↓

Service

↓

Repository / Provider

↓

Database

Never skip layers.

---

# Docker

Everything must work inside Docker.

Never assume localhost.

Never assume filesystem paths.

Everything configurable through environment variables.

---

# Persistence

Repositories only persist data.

Business logic belongs inside services.

---

# Logging

Log:

- Scanning
- Imports
- Metadata
- Artwork
- Provider failures
- Retries

---

# Naming

Good:

GameMetadataService

SteamProvider

LibraryScanner

ArtworkCache

Bad:

Helper

Utils

Manager

Generic

Misc

Data

---

# New Features

Before implementation:

1. Explore existing code.
2. Ask questions.
3. Present implementation plan.
4. Wait for approval.

---

# Non-Regression

When implementing a new feature or modifying code:

- Previously working code is frozen unless the task explicitly requests change
- Do NOT modify existing UI styling: padding, centering, colors, spacing, button styles, layout, or component structure
- Do NOT refactor, rename, or restructure existing functions, modules, or types outside the feature's direct scope
- Do NOT change existing feature behavior, even if inconsistent with the new feature
- If integration requires touching existing code, STOP and ask first
- Treat existing decisions as intentional unless the user says otherwise

---

# Scope

Do not modify unrelated modules.

Stay inside requested scope.

---

# Extensibility

Adding a new provider should require creating a new provider.

Adding a new download source should require creating a new download source.

Avoid modifying existing implementations whenever possible.
