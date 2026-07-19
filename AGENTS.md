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

# Scope

Do not modify unrelated modules.

Stay inside requested scope.

---

# Extensibility

Adding a new provider should require creating a new provider.

Adding a new download source should require creating a new download source.

Avoid modifying existing implementations whenever possible.
