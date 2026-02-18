#!/bin/bash
set -e

# Setup script for adding cozycrowns to a server (e.g. one that has already run Progeny setupServer.sh).
# Uses a dedicated 'cozycrowns' user with home /opt/cozycrowns to avoid conflicts with other apps.

APP_USER="cozycrowns"
APP_DIR="/opt/cozycrowns"

if ! getent passwd "$APP_USER" >/dev/null 2>&1; then
    echo -e "${YELLOW}👤 Creating user $APP_USER...${NC}"
    mkdir -p "$APP_DIR"
    useradd -r -d "$APP_DIR" -s /bin/bash -c "CozyCrowns app" "$APP_USER"
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
else
    echo -e "${YELLOW}👤 User $APP_USER already exists.${NC}"
    mkdir -p "$APP_DIR"
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

# Create log directory
LOG_DIR="/var/log/cozycrowns-backend"
mkdir -p "$LOG_DIR"
chown -R "$APP_USER:$APP_USER" "$LOG_DIR"

# Clone or update repository
echo -e "${YELLOW}📥 Setting up repository...${NC}"
if [ -d "$APP_DIR/.git" ]; then
    echo -e "${YELLOW}Repository already exists, pulling latest changes...${NC}"
    runuser -u "$APP_USER" -- git -C "$APP_DIR" pull
else
    echo -e "${YELLOW}Cloning repository...${NC}"
    runuser -u "$APP_USER" -- git clone https://github.com/Odin94/CozyCrowns-brindlewood-bay.git "$APP_DIR"
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
runuser -u "$APP_USER" -- bash -c "cd $APP_DIR/backend && npm install"

# Build backend
echo -e "${YELLOW}🔨 Building backend...${NC}"
runuser -u "$APP_USER" -- bash -c "cd $APP_DIR/backend && npm run build"

# Create systemd service for PM2 (uses $HOME/.pm2 = $APP_DIR/.pm2)
echo -e "${YELLOW}⚙️  Setting up PM2 startup script...${NC}"
PM2_STARTUP=$(runuser -u "$APP_USER" -- pm2 startup systemd -u "$APP_USER" --hp "$APP_DIR" | grep -v "PM2" | tail -n 1)
eval "$PM2_STARTUP"


echo "Please create your .env from /opt/cozycrowns/backend/.env.sample"
echo "Then run npm run db:generate && npm run db:migrate in /opt/cozycrowns/backend/"
echo "Finally, start the service with pm2 start ecosystem.config.cjs and pm2 save"
