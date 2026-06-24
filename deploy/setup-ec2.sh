#!/usr/bin/env bash
# ============================================================================
# Brahm Estate — one-shot EC2 setup script (Ubuntu 22.04 / 24.04)
# Idempotent: safe to re-run any time to update the app + redeploy.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/varadthakre9/Brahm-Realty/main/deploy/setup-ec2.sh | bash
# or, after cloning:
#   bash deploy/setup-ec2.sh
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/brahm-estate}"
REPO_URL="${REPO_URL:-https://github.com/varadthakre9/Brahm-Realty.git}"
BRANCH="${BRANCH:-main}"

log() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }

log "Updating apt cache"
sudo apt-get update -y

log "Installing prerequisites (curl, git, nginx, ufw, ca-certificates)"
sudo apt-get install -y curl ca-certificates gnupg git nginx ufw

# --- Node.js 20 (via NodeSource) ---
NODE_MAJOR="$(node -v 2>/dev/null | sed -E 's/v([0-9]+).*/\1/' || echo 0)"
if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
    log "Installing Node.js 20.x"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
log "Node $(node -v)  /  npm $(npm -v)"

# --- PM2 (process manager) ---
if ! command -v pm2 >/dev/null 2>&1; then
    log "Installing PM2 globally"
    sudo npm install -g pm2
fi

# --- Clone or update the repo ---
if [ ! -d "$APP_DIR/.git" ]; then
    log "Cloning $REPO_URL -> $APP_DIR"
    sudo mkdir -p "$APP_DIR"
    sudo chown -R "$USER":"$USER" "$APP_DIR"
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
    log "Pulling latest from $BRANCH"
    git -C "$APP_DIR" fetch --all
    git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi

cd "$APP_DIR"

# --- Install production dependencies ---
log "Installing npm dependencies (production only)"
if [ -f package-lock.json ]; then
    npm ci --omit=dev
else
    npm install --omit=dev
fi

# --- .env scaffold (only if missing — never overwritten) ---
if [ ! -f "$APP_DIR/.env" ]; then
    log "Creating .env from .env.example (you MUST fill in real values)"
    cp .env.example .env
    chmod 600 .env
    NEED_ENV_EDIT=1
else
    NEED_ENV_EDIT=0
fi

# --- Nginx reverse proxy (port 80 -> Node app on 127.0.0.1:5500) ---
log "Configuring nginx reverse proxy"
sudo cp deploy/nginx-brahm-estate.conf /etc/nginx/sites-available/brahm-estate
sudo ln -sf /etc/nginx/sites-available/brahm-estate /etc/nginx/sites-enabled/brahm-estate
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl enable nginx >/dev/null

# --- Firewall ---
log "Opening firewall ports (22 SSH, 80 HTTP, 443 HTTPS)"
sudo ufw allow 22/tcp >/dev/null
sudo ufw allow 80/tcp >/dev/null
sudo ufw allow 443/tcp >/dev/null
sudo ufw --force enable >/dev/null

# --- Start / reload the app under PM2 ---
log "Starting Brahm Estate under PM2"
pm2 startOrReload deploy/ecosystem.config.js
pm2 save

# --- Auto-start on reboot ---
log "Configuring PM2 to start on system boot"
STARTUP_CMD="$(pm2 startup systemd -u "$USER" --hp "$HOME" | tail -n 1)"
if [[ "$STARTUP_CMD" == sudo* ]]; then
    eval "$STARTUP_CMD"
fi
pm2 save

PUBLIC_IP="$(curl -fsSL http://checkip.amazonaws.com 2>/dev/null || echo "<your-ec2-public-ip>")"

cat <<EOF

================================================================
 Brahm Estate deployment complete.

   Website:  http://${PUBLIC_IP}/
   Admin:    http://${PUBLIC_IP}/admin/

EOF

if [ "$NEED_ENV_EDIT" -eq 1 ]; then
    cat <<EOF
 ACTION REQUIRED — fill in your environment variables now:

   nano $APP_DIR/.env
   # paste your CLOUDINARY_URL, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN,
   # and admin credentials, then save (Ctrl+O, Enter, Ctrl+X).

   pm2 restart brahm-estate

EOF
fi

cat <<EOF
 Day-to-day commands:
   pm2 status                  — list running processes
   pm2 logs brahm-estate       — tail live application logs
   pm2 restart brahm-estate    — restart the app
   sudo systemctl status nginx — nginx status
   bash deploy/setup-ec2.sh    — re-run to pull latest code + redeploy
================================================================
EOF
