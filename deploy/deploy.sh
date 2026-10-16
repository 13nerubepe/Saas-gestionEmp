#!/usr/bin/env bash
# Deploy main to the server. Run FROM YOUR PC (Git Bash), at the repository root:
#   deploy/deploy.sh 13.37.42.1
#
# 1. Builds the Angular app locally (the 1 GB server cannot build it).
# 2. Updates the code on the server to origin/main.
# 3. Uploads the Angular build, then rebuilds and restarts the containers.
# 4. Checks that the site answers.
set -euo pipefail

HOST="${1:?Usage: deploy/deploy.sh <server-ip>}"
KEY="${SSH_KEY:-$HOME/.ssh/saas-gestionemp-key.pem}"
SSH_BIN=ssh
# On Windows, Git Bash's ssh rejects keys stored on NTFS ("bad permissions"):
# use Windows' own OpenSSH, which honours the icacls restriction, with a Windows path.
if [ -x /c/Windows/System32/OpenSSH/ssh.exe ]; then
    SSH_BIN=/c/Windows/System32/OpenSSH/ssh.exe
    KEY="$(cygpath -w "$KEY")"
fi
SSH=("$SSH_BIN" -i "$KEY" -o StrictHostKeyChecking=accept-new "ubuntu@$HOST")
APP_DIR="saas-gestionemp"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -n "$(git -C "$ROOT" status --porcelain -- web-erpemployes)" ]; then
    echo "web-erpemployes has uncommitted changes: commit them, or the server would get code that is not on main." >&2
    exit 1
fi

echo "==> Building the Angular app (production)"
(cd "$ROOT/web-erpemployes" && npm ci --no-audit --no-fund && npx ng build --configuration production)

echo "==> Updating the code on the server"
"${SSH[@]}" "cd $APP_DIR && git fetch --quiet origin && git checkout --quiet main && git reset --quiet --hard origin/main"
"${SSH[@]}" "test -f $APP_DIR/deploy/.env" || { echo "deploy/.env is missing on the server (see deploy/README.md)." >&2; exit 1; }

echo "==> Uploading the Angular build"
tar -czf - -C "$ROOT/web-erpemployes/dist/sakai-ng/browser" . |
    "${SSH[@]}" "rm -rf $APP_DIR/deploy/frontend.new && mkdir -p $APP_DIR/deploy/frontend.new && tar -xzf - -C $APP_DIR/deploy/frontend.new && rm -rf $APP_DIR/deploy/frontend.old && (mv $APP_DIR/deploy/frontend $APP_DIR/deploy/frontend.old 2>/dev/null || true) && mv $APP_DIR/deploy/frontend.new $APP_DIR/deploy/frontend"

echo "==> Rebuilding and restarting the containers"
"${SSH[@]}" "cd $APP_DIR/deploy && docker compose -f docker-compose.prod.yml up -d --build --remove-orphans && docker image prune -f >/dev/null"

SITE="$("${SSH[@]}" "grep -E '^APP_DOMAIN=' $APP_DIR/deploy/.env | cut -d= -f2-" | tr -d '\r')"
echo "==> Checking https://$SITE"
for _ in $(seq 1 30); do
    if curl -fsS "https://$SITE/api/v1/health/" >/dev/null 2>&1; then
        echo "OK: https://$SITE is up."
        exit 0
    fi
    sleep 5
done
echo "The site does not answer yet. Logs: ssh to the server, then: cd $APP_DIR/deploy && docker compose -f docker-compose.prod.yml logs --tail 100" >&2
exit 1
