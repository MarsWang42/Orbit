#!/usr/bin/env bash
set -euo pipefail

echo "=== Orbit Installer ==="
echo ""

# Detect OS
OS="$(uname -s)"
ARCH="$(uname -m)"

if [ "$OS" != "Linux" ] && [ "$OS" != "Darwin" ]; then
  echo "Unsupported OS: $OS"
  exit 1
fi

# --- 1. Bun ---
if command -v bun &>/dev/null; then
  echo "[ok] bun $(bun --version)"
else
  # Bun installer requires unzip
  if ! command -v unzip &>/dev/null; then
    echo "[install] unzip (required by bun)..."
    if [ "$OS" = "Linux" ]; then
      sudo apt-get update && sudo apt-get install -y unzip
    fi
  fi
  echo "[install] bun..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

# --- 2. Git ---
if command -v git &>/dev/null; then
  echo "[ok] git $(git --version | cut -d' ' -f3)"
else
  echo "[install] git..."
  if [ "$OS" = "Linux" ]; then
    sudo apt-get update && sudo apt-get install -y git
  else
    xcode-select --install 2>/dev/null || true
  fi
fi

# --- 3. GitHub CLI (needed by Claude Code for PR operations) ---
if command -v gh &>/dev/null; then
  echo "[ok] gh $(gh --version | head -1 | cut -d' ' -f3)"
else
  echo "[install] gh CLI..."
  if [ "$OS" = "Linux" ]; then
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
    sudo apt-get update && sudo apt-get install -y gh
  else
    brew install gh 2>/dev/null || echo "[skip] install gh manually: https://cli.github.com"
  fi
fi

# --- 4. Claude Code CLI ---
if command -v claude &>/dev/null; then
  echo "[ok] claude code CLI installed"
else
  echo "[install] Claude Code CLI..."
  curl -fsSL https://claude.ai/install.sh | bash
fi

# --- 5. Clone Orbit ---
INSTALL_DIR="${ORBIT_DIR:-$HOME/orbit}"

if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/package.json" ]; then
  echo "[ok] Orbit already at $INSTALL_DIR"
  echo "     To upgrade, run: bash $INSTALL_DIR/upgrade.sh"
  cd "$INSTALL_DIR"
  git pull --ff-only 2>/dev/null || echo "[skip] git pull (not a clean state)"
else
  echo "[clone] Orbit -> $INSTALL_DIR"
  git clone https://github.com/MarsWang42/Orbit.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# --- 6. Install dependencies ---
echo "[install] bun dependencies..."
bun install --frozen-lockfile

# --- 7. Create .env if missing ---
if [ ! -f .env ]; then
  cat > .env <<'ENVEOF'
BOT_TOKEN=
ALLOWED_USER_ID=
GH_TOKEN=
DEFAULT_CWD=~/my-vault
DAILY_HOUR=8
ENVEOF
  echo ""
  echo "[action required] Edit $INSTALL_DIR/.env with your config:"
  echo "  - BOT_TOKEN: from @BotFather on Telegram"
  echo "  - ALLOWED_USER_ID: your Telegram user ID"
  echo "  - GH_TOKEN: GitHub personal access token (optional)"
else
  echo "[ok] .env exists"
fi

# --- 8. Create data/workspaces dirs ---
mkdir -p data workspaces

# --- 9. systemd service (Linux only) ---
if [ "$OS" = "Linux" ] && [ -d /etc/systemd/system ]; then
  SERVICE_FILE="/etc/systemd/system/orbit.service"
  if [ ! -f "$SERVICE_FILE" ]; then
    echo "[setup] systemd service..."
    sudo tee "$SERVICE_FILE" > /dev/null <<SVCEOF
[Unit]
Description=Orbit Telegram Bot
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$HOME/.bun/bin/bun run src/index.ts
Restart=unless-stopped
RestartSec=5
EnvironmentFile=$INSTALL_DIR/.env

[Install]
WantedBy=multi-user.target
SVCEOF
    sudo systemctl daemon-reload
    echo "[ok] systemd service created (not started)"
  else
    echo "[ok] systemd service exists"
  fi
fi

# --- Done ---
echo ""
echo "=== Installation complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit $INSTALL_DIR/.env"
echo "  2. Run: claude login"
echo "  3. Run: cd $INSTALL_DIR && bun run start"
if [ "$OS" = "Linux" ] && [ -d /etc/systemd/system ]; then
  echo "  Or use systemd:"
  echo "     sudo systemctl enable --now orbit"
fi
echo ""
echo "To upgrade later:"
echo "  bash $INSTALL_DIR/upgrade.sh"
echo ""
