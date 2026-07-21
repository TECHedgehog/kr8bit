#!/bin/sh
# kr8bit dev lifecycle manager
# Usage: ./scripts/dev.sh {start|stop|restart|status|logs [backend|web]}
#
# Spawns:
#   backend  -> npm run dev      (tsx watch, port $PORT, default 8080)
#   web      -> npm run web:dev  (vite, port 5173, proxies /api -> backend)
#
# Idempotent start. Stale PIDs detected and cleaned.
# Runtime files: var/dev/{pids, backend.log, web.log}

set -eu

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
RUN_DIR="$ROOT_DIR/var/dev"
PID_FILE="$RUN_DIR/pids"
BACKEND_LOG="$RUN_DIR/backend.log"
WEB_LOG="$RUN_DIR/web.log"

BACKEND_PORT=${PORT:-8080}
WEB_PORT=5173

mkdir -p "$RUN_DIR"

log()   { printf '[dev] %s\n' "$*"; }
err()   { printf '[dev][error] %s\n' "$*" >&2; }

require_env() {
  if [ ! -f "$ROOT_DIR/.env" ]; then
    err ".env missing. Copy .env.example and fill required vars:"
    err "  cp .env.example .env"
    err "Required: LIBRARY_ROOT, CACHE_DIR, DB_PATH"
    exit 1
  fi
}

# pid_alive <pid>
pid_alive() {
  [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null
}

read_pid() {
  [ -f "$PID_FILE" ] || { echo ""; return; }
  grep "^$1=" "$PID_FILE" 2>/dev/null | cut -d= -f2 || echo ""
}

write_pid() {
  line="$1=$2"
  if grep -q "^$1=" "$PID_FILE" 2>/dev/null; then
    # in-place replace (portable: rewrite file)
    tmp="$PID_FILE.tmp"
    grep -v "^$1=" "$PID_FILE" > "$tmp" || true
    echo "$line" >> "$tmp"
    mv "$tmp" "$PID_FILE"
  else
    echo "$line" >> "$PID_FILE"
  fi
}

clear_pid() {
  if [ -f "$PID_FILE" ] && grep -q "^$1=" "$PID_FILE" 2>/dev/null; then
    tmp="$PID_FILE.tmp"
    grep -v "^$1=" "$PID_FILE" > "$tmp" || true
    mv "$tmp" "$PID_FILE"
  fi
}

# spawn <name> <log> <cmd>
# Uses nohup + background; macOS has no setsid. Parent script exits quickly
# and children are reparented to init. nohup shields them from SIGHUP.
spawn() {
  name=$1
  logfile=$2
  cmd=$3
  nohup sh -c "cd \"$ROOT_DIR\" && exec $cmd" >"$logfile" 2>&1 <"/dev/null" &
  pid=$!
  write_pid "$name" "$pid"
  log "$name started (pid $pid, log $logfile)"
}

stop_pid() {
  name=$1
  pid=$(read_pid "$name")
  if [ -z "$pid" ]; then
    log "$name not running (no pid)"
    return 0
  fi
  if ! pid_alive "$pid"; then
    log "$name stale pid $pid (cleaning)"
    clear_pid "$name"
    return 0
  fi
  kill -TERM "$pid" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    pid_alive "$pid" || break
    sleep 0.3
  done
  if pid_alive "$pid"; then
    err "$name pid $pid did not exit; sending KILL"
    kill -KILL "$pid" 2>/dev/null || true
  fi
  clear_pid "$name"
  log "$name stopped (pid $pid)"
}

cmd_start() {
  require_env
  backend_pid=$(read_pid backend)
  web_pid=$(read_pid web)

  if pid_alive "$backend_pid"; then
    log "backend already running (pid $backend_pid)"
  else
    [ -n "$backend_pid" ] && clear_pid backend
    spawn backend "$BACKEND_LOG" "npm run dev"
  fi

  if pid_alive "$web_pid"; then
    log "web already running (pid $web_pid)"
  else
    [ -n "$web_pid" ] && clear_pid web
    spawn web "$WEB_LOG" "npm run web:dev"
  fi

  # brief settle window
  sleep 1
  cmd_status
}

cmd_stop() {
  stop_pid web
  stop_pid backend
  log "all stopped"
}

cmd_restart() {
  cmd_stop
  cmd_start
}

# reachable <port>
# Uses localhost (not 127.0.0.1) because vite v5 binds IPv6 [::1] by default.
reachable() {
  curl -s -o /dev/null -m 1 "http://localhost:$1" 2>/dev/null
}

cmd_status() {
  backend_pid=$(read_pid backend)
  web_pid=$(read_pid web)

  printf '[dev] backend pid=%s\n' "${backend_pid:-none}"
  if pid_alive "$backend_pid"; then
    if reachable "$BACKEND_PORT"; then
      printf '        url=http://localhost:%s (healthy)\n' "$BACKEND_PORT"
    else
      printf '        url=http://localhost:%s (starting)\n' "$BACKEND_PORT"
    fi
  else
    printf '        state=down\n'
  fi

  printf '[dev] web     pid=%s\n' "${web_pid:-none}"
  if pid_alive "$web_pid"; then
    if reachable "$WEB_PORT"; then
      printf '        url=http://localhost:%s (healthy)\n' "$WEB_PORT"
    else
      printf '        url=http://localhost:%s (starting)\n' "$WEB_PORT"
    fi
  else
    printf '        state=down\n'
  fi
}

cmd_logs() {
  which=${1:-all}
  case "$which" in
    backend) tail -n 50 "$BACKEND_LOG" 2>/dev/null || err "no backend log";;
    web)    tail -n 50 "$WEB_LOG" 2>/dev/null || err "no web log";;
    all)    echo '== backend =='; tail -n 20 "$BACKEND_LOG" 2>/dev/null || true
            echo '== web ==';     tail -n 20 "$WEB_LOG" 2>/dev/null || true;;
    *)      err "logs target: backend|web|all"; exit 2;;
  esac
}

usage() {
  cat >&2 <<EOF
kr8bit dev lifecycle
usage: $0 <command> [args]

commands:
  start           idempotent start of backend + web (default)
  stop            stop both
  restart         stop then start
  status          print pid + url + health per process
  logs [backend|web|all]   tail last lines (default: all)
EOF
  exit 2
}

cmd=${1:-start}
case "$cmd" in
  start)   cmd_start;;
  stop)    cmd_stop;;
  restart) cmd_restart;;
  status)  cmd_status;;
  logs)    shift; cmd_logs "${1:-all}";;
  -h|--help|help) usage;;
  *)       err "unknown command: $cmd"; usage;;
esac