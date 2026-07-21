---
description: Manage kr8bit dev server lifecycle (start, stop, restart, status, logs).
agent: build
---

You are managing the local kr8bit dev server. The user passed `$ARGUMENTS` as the subcommand (default: `start`).

# What runs

`./scripts/dev.sh` spawns two processes in the background (via `setsid` + `nohup`):

| name    | command              | port | reload mechanism           |
|---------|----------------------|------|----------------------------|
| backend | `npm run dev`        | 8080 | tsx watch (auto on change) |
| web     | `npm run web:dev`    | 5173 | Vite HMR  (auto on change) |

- UI URL: `http://localhost:5173` (Vite proxies `/api` → 8080, see `web/vite.config.ts:11`). Vite v5 binds IPv6 `[::1]`; `localhost` (not `127.0.0.1`) is required to reach it.
- API URL: `http://localhost:8080/api/`.
- Runtime files: `var/dev/{pids, backend.log, web.log}` (gitignored).

# Subcommands

Pass `$ARGUMENTS` (default `start`) directly to `./scripts/dev.sh`:

- `start`    — idempotent. If already running, prints URLs and exits.
- `stop`     — SIGTERM both, SIGKILL after 3s, clears pidfile.
- `restart`  — stop then start.
- `status`   — prints pid + url + per-process health. Read-only.
- `logs [backend|web|all]` — tail last lines. Read-only.

# When to invoke /dev yourself (agent-initiated)

You are authorized to fully manage the dev server. Invoke the script via the Bash tool whenever the following changes happen in the SAME edit session you just made:

| Edit                                                                 | Required action |
|----------------------------------------------------------------------|-----------------|
| `prisma/schema.prisma` (any change)                                  | Tell user a manual `npm run prisma:migrate` is needed, THEN `/dev restart`. Do not auto-run migrations. |
| `package.json` or `package-lock.json` (dep added/removed/upgraded)   | Tell user to run `npm install`, THEN `/dev restart`. |
| `web/package.json` or `web/package-lock.json`                        | Tell user to run `npm --prefix web install`, THEN `/dev restart`. |
| `vite.config.ts` `server` block (port/proxy change)                  | `/dev restart` (web only needs reload, but a full restart is simplest). |
| `src/main.ts` or `src/config/index.ts` (env schema or bootstrap)     | `/dev restart`. |
| Port collision detected (process won't bind)                         | `/dev stop`, suggest cleaning with `lsof -nP -iTCP:5173 -sTCP:LISTEN` / `:8080`, then `/dev start`. |

# When NOT to invoke /dev

Source changes to files under `src/` (excluding `src/main.ts` and `src/config/index.ts`) or `web/src/` do NOT need any /dev call:

- tsx watch reloads backend in ~1s.
- Vite HMR hot-swaps UI in the browser without refresh.

So after editing a controller, route, service, repository, provider, React component, CSS, etc. — just report what changed and stop. Do not call the script.

# Behavior when running

After ANY subcommand that starts processes, verify by running `./scripts/dev.sh status` and report both URLs to the user. If `status` shows `state=down` or `starting` after a `start`, wait 5 seconds, run `status` again. If still down, run `./scripts/dev.sh logs backend` and `./scripts/dev.sh logs web` to diagnose, then report the failure and the most recent log lines.

Never print the full logs unless asked or unless something failed. The `status` output is the canonical "all good" proof.

# First-run gotcha

If `./scripts/dev.sh start` fails with `.env missing`, instruct the user:
```
cp .env.example .env
# then edit .env to set LIBRARY_ROOT, CACHE_DIR, DB_PATH to real local paths
```
Do NOT auto-generate `.env`. It is gitignored for safety.