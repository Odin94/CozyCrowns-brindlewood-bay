#!/bin/bash
set -e

# Setup script for adding CozyCrowns to a server that has already run Progeny setupServer.sh.
# Uses a dedicated 'cozycrowns' user with home /opt/cozycrowns to avoid conflicts with other apps.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_USER="cozycrowns"
APP_DIR="/opt/cozycrowns"
BACKEND_DIR="$APP_DIR/backend"
LOG_DIR="/var/log/cozycrowns-backend"
REPO_URL="https://github.com/Odin94/CozyCrowns-brindlewood-bay.git"

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root.${NC}"
    exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
    echo -e "${RED}pnpm is not installed. Run the base server setup first.${NC}"
    exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
    echo -e "${RED}pm2 is not installed. Run the base server setup first.${NC}"
    exit 1
fi

echo -e "${YELLOW}Creating or updating user $APP_USER...${NC}"
mkdir -p "$APP_DIR"

if ! getent passwd "$APP_USER" >/dev/null 2>&1; then
    useradd -r -d "$APP_DIR" -s /bin/bash -c "CozyCrowns app" "$APP_USER"
    echo -e "${GREEN}Created user $APP_USER.${NC}"
else
    echo -e "${GREEN}User $APP_USER already exists.${NC}"
fi

chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo -e "${YELLOW}Creating log directory...${NC}"
mkdir -p "$LOG_DIR"
chown -R "$APP_USER:$APP_USER" "$LOG_DIR"

echo -e "${YELLOW}Setting up repository...${NC}"
if [ -d "$APP_DIR/.git" ]; then
    runuser -u "$APP_USER" -- git -C "$APP_DIR" pull
else
    runuser -u "$APP_USER" -- git clone "$REPO_URL" "$APP_DIR"
fi

echo -e "${YELLOW}Installing backend dependencies...${NC}"
runuser -u "$APP_USER" -- bash -lc "cd '$BACKEND_DIR' && pnpm install --frozen-lockfile"

echo -e "${YELLOW}Building backend...${NC}"
runuser -u "$APP_USER" -- bash -lc "cd '$BACKEND_DIR' && pnpm run build"

echo -e "${YELLOW}Setting up PM2 startup service...${NC}"
systemctl stop "pm2-$APP_USER" >/dev/null 2>&1 || true
systemctl disable "pm2-$APP_USER" >/dev/null 2>&1 || true
rm -f "/etc/systemd/system/pm2-$APP_USER.service"
systemctl daemon-reload

PM2_STARTUP=$(runuser -u "$APP_USER" -- bash -lc "pm2 startup systemd -u '$APP_USER' --hp '$APP_DIR'" | grep '^sudo env ' | tail -n 1)

if [ -z "$PM2_STARTUP" ]; then
    echo -e "${RED}Could not get PM2 startup command.${NC}"
    exit 1
fi

eval "$PM2_STARTUP"

echo -e "${YELLOW}Starting CozyCrowns with PM2 as $APP_USER...${NC}"
runuser -u "$APP_USER" -- bash -lc "cd '$BACKEND_DIR' && pm2 start ecosystem.config.cjs && pm2 save"

echo -e "${YELLOW}Handing PM2 daemon ownership to systemd...${NC}"
systemctl stop "pm2-$APP_USER" >/dev/null 2>&1 || true
systemctl reset-failed "pm2-$APP_USER" >/dev/null 2>&1 || true
runuser -u "$APP_USER" -- bash -lc "pm2 kill"
systemctl start "pm2-$APP_USER"

echo -e "${YELLOW}Checking status...${NC}"
systemctl status "pm2-$APP_USER" --no-pager
runuser -u "$APP_USER" -- bash -lc "pm2 status"

echo ""
echo -e "${GREEN}CozyCrowns setup complete.${NC}"
echo ""
echo "Next steps:"
echo "1. Create your env file:"
echo "   cp /opt/cozycrowns/backend/.env.sample /opt/cozycrowns/backend/.env"
echo "   vim /opt/cozycrowns/backend/.env"
echo ""
echo "2. Run database setup as the app user:"
echo "   sudo su - cozycrowns -c \"cd /opt/cozycrowns/backend && pnpm run db:generate && pnpm run db:migrate\""
echo ""
echo "3. Restart after env/database setup:"
echo "   sudo su - cozycrowns -c \"pm2 restart cozycrowns-backend && pm2 save\""
echo ""
echo "4. Verify:"
echo "   systemctl status pm2-cozycrowns"
echo "   sudo su - cozycrowns -c \"pm2 status\""
echo "   curl -fsS https://api-cozycrowns.odin-matthias.de/health"
