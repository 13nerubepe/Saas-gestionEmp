#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 server. Run ON THE SERVER, as ubuntu:
#   curl -fsSL https://raw.githubusercontent.com/13nerubepe/Saas-gestionEmp/main/deploy/server-setup.sh | bash
# Safe to run again: every step checks whether it is already done.
set -euo pipefail

REPO_URL="https://github.com/13nerubepe/Saas-gestionEmp.git"
APP_DIR="$HOME/saas-gestionemp"

echo "==> System updates"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo apt-get install -y git curl ca-certificates unattended-upgrades

echo "==> Docker"
if ! command -v docker >/dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER"

echo "==> 2 GB swap (the server has 1 GB of RAM)"
if ! sudo swapon --show | grep -q /swapfile; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Application code"
if [ ! -d "$APP_DIR/.git" ]; then
    git clone "$REPO_URL" "$APP_DIR"
fi
mkdir -p "$APP_DIR/deploy/frontend" "$HOME/backups"

echo "==> Daily database backup at 03:00"
CRON_LINE="0 3 * * * $APP_DIR/deploy/backup.sh >> $HOME/backups/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'deploy/backup.sh' || true; echo "$CRON_LINE" ) | crontab -

echo
echo "Done. Next:"
echo "  1. Log out and back in (docker group)."
echo "  2. cp $APP_DIR/deploy/.env.example $APP_DIR/deploy/.env and fill it in."
echo "  3. From your PC: deploy/deploy.sh <server-ip>"
