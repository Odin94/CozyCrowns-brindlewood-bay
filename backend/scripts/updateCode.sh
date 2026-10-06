#!/bin/bash
set -e

APP_USER="cozycrowns"
APP_DIR="/opt/cozycrowns"
BACKEND_DIR="$APP_DIR/backend"
APP_NAME="cozycrowns-backend"
HEALTH_URL="http://127.0.0.1:3001/health"

if [ "$#" -ne 1 ] || ! [[ "$1" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Usage: $0 <40-character lowercase Git commit SHA>"
    exit 1
fi

DEPLOY_REVISION="$1"

if [ "$EUID" -ne 0 ]; then
    echo "Please run this script as root:"
    echo "  sudo $0"
    exit 1
fi

if ! getent passwd "$APP_USER" >/dev/null 2>&1; then
    echo "User $APP_USER does not exist."
    exit 1
fi

if [ ! -d "$BACKEND_DIR" ]; then
    echo "Backend directory does not exist: $BACKEND_DIR"
    exit 1
fi

# Previous manual updates may have created Git objects or dependencies as root.
# The service user must own the full application directory before it can update.
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

runuser -u "$APP_USER" -- bash -lc "
    set -e
    cd '$BACKEND_DIR'

    mkdir -p db_backups
    BACKUP_FILE=\"db_backups/db.sqlite.backup.\$(date +%Y%m%d_%H%M%S)\"

    if [ -f db.sqlite ]; then
        cp db.sqlite \"\$BACKUP_FILE\"
        echo \"Backed up db.sqlite to \$BACKUP_FILE\"
    elif [ -f database.sqlite ]; then
        BACKUP_FILE=\"db_backups/database.sqlite.backup.\$(date +%Y%m%d_%H%M%S)\"
        cp database.sqlite \"\$BACKUP_FILE\"
        echo \"Backed up database.sqlite to \$BACKUP_FILE\"
    else
        echo \"No SQLite database found to back up.\"
        exit 1
    fi

    git fetch --no-tags origin '$DEPLOY_REVISION'
    git cat-file -e '$DEPLOY_REVISION^{commit}'
    git checkout --detach --force '$DEPLOY_REVISION'
    if [ \"\$(git rev-parse HEAD)\" != '$DEPLOY_REVISION' ]; then
        echo \"Checked out revision does not match requested deployment revision.\"
        exit 1
    fi

    echo \"Checked out deployment revision $DEPLOY_REVISION\"

    pnpm install --frozen-lockfile
    echo \"Installed dependencies\"

    pnpm run build
    echo \"Built the code\"

    pnpm run db:migrate
    echo \"Migrated the database\"

    pm2 restart '$APP_NAME'
    pm2 save
    echo \"Restarted the backend and saved PM2 process list\"
"

echo "Waiting 5 seconds for backend to start..."
sleep 5

curl -fsS "$HEALTH_URL"
echo ""
echo "Use this for logs:"
echo "  sudo su - $APP_USER -c \"pm2 logs $APP_NAME\""
echo ""
