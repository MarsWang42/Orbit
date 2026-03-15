#!/usr/bin/env bash
set -euo pipefail

# --- Resolve Orbit directory ---
# Works whether run from inside the repo or via curl pipe
ORBIT_DIR="${ORBIT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "$HOME/orbit")}"

if [ ! -f "$ORBIT_DIR/package.json" ] || ! grep -q '"name": "orbit"' "$ORBIT_DIR/package.json" 2>/dev/null; then
  echo "Error: Orbit not found at $ORBIT_DIR"
  echo "Set ORBIT_DIR to your Orbit installation path and try again."
  exit 1
fi

cd "$ORBIT_DIR"

echo "=== Orbit Upgrade ==="
echo ""

# --- Detect deployment mode ---
MODE="local"
if [ -f /.dockerenv ]; then
  echo "Error: Run upgrade.sh from the host, not inside a container."
  exit 1
fi
if docker compose ps --status running 2>/dev/null | grep -q "orbit"; then
  MODE="docker"
elif systemctl is-active orbit &>/dev/null; then
  MODE="systemd"
fi
echo "[mode] $MODE"

# --- Check current version ---
CURRENT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "[current] $CURRENT"

# --- Check for updates ---
git fetch origin main --quiet
LATEST=$(git rev-parse --short origin/main 2>/dev/null || echo "unknown")

if [ "$CURRENT" = "$LATEST" ]; then
  echo ""
  echo "Already up to date ($CURRENT)."
  exit 0
fi

echo "[latest]  $LATEST"
echo ""

# --- Show changelog ---
echo "Changes:"
git log --oneline "$CURRENT..origin/main" 2>/dev/null | head -20
echo ""

# --- Back up database ---
DB_FILE="data/orbit.db"
if [ -f "$DB_FILE" ]; then
  BACKUP="data/orbit.db.bak.$(date +%Y%m%d-%H%M%S)"
  cp "$DB_FILE" "$BACKUP"
  echo "[backup] $DB_FILE -> $BACKUP"
fi

# --- Pull latest ---
echo "[pull] Updating code..."
if ! git pull --ff-only origin main; then
  echo ""
  echo "Error: git pull failed. You may have local changes."
  echo "Stash or commit them first: git stash && bash upgrade.sh"
  exit 1
fi

# --- Upgrade per mode ---
case "$MODE" in
  docker)
    echo "[docker] Rebuilding and restarting..."
    docker compose up -d --build --remove-orphans
    echo "[docker] Waiting for container to start..."
    sleep 3
    if docker compose ps --status running 2>/dev/null | grep -q "orbit"; then
      echo "[ok] Container is running."
    else
      echo "[warn] Container may not have started. Check: docker compose logs"
    fi
    ;;

  systemd)
    echo "[deps] Installing dependencies..."
    bun install --frozen-lockfile
    echo "[restart] Restarting orbit service..."
    sudo systemctl restart orbit
    sleep 2
    if systemctl is-active orbit &>/dev/null; then
      echo "[ok] Service is running."
    else
      echo "[warn] Service may not have started. Check: journalctl -u orbit -n 20"
      echo "[rollback] To revert: git checkout $CURRENT && bun install --frozen-lockfile && sudo systemctl restart orbit"
    fi
    ;;

  local)
    echo "[deps] Installing dependencies..."
    bun install --frozen-lockfile
    echo ""
    echo "[ok] Code updated. Restart the bot manually:"
    echo "  bun run start"
    ;;
esac

NEW=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo ""
echo "=== Upgraded: $CURRENT -> $NEW ==="
