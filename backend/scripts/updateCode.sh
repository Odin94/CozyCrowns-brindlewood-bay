#!/bin/bash
set -e

APP_USER="cozycrowns"
APP_DIR="/opt/cozycrowns"
BACKEND_DIR="$APP_DIR/backend"
APP_NAME="cozycrowns-backend"
HEALTH_URL="https://api-cozycrowns.odin-matthias.de/health"

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

    git pull
    echo \"Pulled latest code from git\"

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
