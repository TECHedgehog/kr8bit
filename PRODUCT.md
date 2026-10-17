# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are self-hosters who keep PC game installers in local libraries and want to browse and organize them through a web UI. Project documentation targets Unraid, Docker Compose, Portainer, Proxmox, and TrueNAS SCALE. The product is community-oriented; adoption and user feedback inform its direction.

## Product Purpose

kr8bit scans local game-installer folders, matches entries to game metadata, retrieves artwork, and provides a web UI for browsing and organizing the resulting library. It is intended to make a self-hosted game library manageable from one Docker container. Success includes reliable library organization and community adoption shaped by user feedback.

## Positioning

The project describes itself as “Jellyfin for games.” Its mechanism is a self-hosted library manager that scans existing local installer files and enriches them with metadata and artwork from configured providers.

## Operating Context

- Users run kr8bit in a home-lab or self-hosted environment, primarily as a Docker container.
- A library can contain `.7z` archives (one game per archive) and directories containing `setup.exe`.
- Persistent storage holds the SQLite database and artwork cache; the library mount can be read-only.
- Steam metadata is supported; IGDB and SteamGridDB require user-provided credentials for relevant integrations.
- Demo mode supports evaluation without a real library.

## Capabilities and Constraints

- Scans local installer libraries, matches game names against provider data, retrieves metadata and artwork, and supports library browsing, filtering, and search.
- Match scores are handled explicitly: scores of 85 or higher are auto-accepted, 70–84 are flagged for review, and scores below 70 remain pending.
- The optional FitGirl repack catalog is disabled by default and is not the product's headline use case.
- Runs as a single Docker container; persistence uses SQLite.
- Authentication and the single-user versus multi-user model are undecided (roadmap O-9).
- Download-source modeling and behavior are undecided (roadmap O-6).

## Evidence on Hand

- Product purpose, supported installer formats, deployment targets, and setup instructions: `README.md`.
- Current capabilities and planned work: `docs/roadmap.md`, `docs/api.md`.
- Deployment and architecture details: `docs/architecture.md`.
- Product decisions and open questions: `docs/decisions.md` and `docs/adr/`.
- Existing app icon: `web/public/icon.svg`. It is an existing asset, not a binding brand requirement.
- MIT license is declared in `README.md` and `package.json`; no standalone root `LICENSE` file is present.
- No testimonials, case studies, benchmark results, or customer counts are documented; future work must not fabricate them.

## Product Principles

- Keep self-hosted deployment practical for the documented home-lab platforms.
- Start from users' existing local installer libraries.
- Make uncertain metadata matches reviewable rather than presenting them as certain.
- Keep the core library-manager purpose clear; optional catalog features remain optional.
- Let community adoption and user feedback inform product direction.
