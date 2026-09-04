# CozyCrowns Backend

Fastify backend for CozyCrowns character management system.

## Features

- WorkOS authentication
- Character CRUD operations
- Character sharing between users
- SQLite database with Drizzle ORM

## Setup

1. Install dependencies:

```bash
pnpm install
```

`better-sqlite3` uses a native SQLite binding. This backend package is configured to allow the required install/build script via `pnpm.onlyBuiltDependencies`, so fresh installs on Node 24 should work without extra prompts.

If you installed with scripts disabled, or Drizzle Studio reports that it "Could not locate the bindings file", rebuild the native binding:

```bash
pnpm rebuild better-sqlite3
```

If the package cannot download a prebuilt binary and falls back to `node-gyp`, Windows machines need Python and the Visual Studio Build Tools C++ workload installed.

2. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

3. Configure your environment variables:
   - `WORKOS_API_KEY`: Your WorkOS API key
   - `WORKOS_CLIENT_ID`: Your WorkOS client ID
   - `WORKOS_COOKIE_PASSWORD`: A secure password (minimum 32 characters) for cookie encryption
   - `FRONTEND_URL`: URL of your frontend application
   - `PORT`: Backend server port (default: 3001)

4. Generate database migrations:

```bash
pnpm db:generate
```

5. Run migrations:

```bash
pnpm db:migrate
```

## Development

Start the development server:

```bash
pnpm dev
```

The server will start on `http://localhost:3001` (or your configured port).

## Database

The backend uses SQLite with Drizzle ORM. The database file (`db.sqlite`) will be created automatically when you run migrations.

### Schema

- `users`: User accounts synced from WorkOS
- `characters`: Character data stored as JSON
- `character_shares`: Sharing relationships between users and characters

### Database Studio

View and edit the database using Drizzle Studio:

```bash
pnpm db:studio
```

## API Routes

### Authentication

- `GET /auth/me` - Get current user
- `GET /auth/callback` - WorkOS OAuth callback
- `POST /auth/signout` - Sign out

### Characters

- `GET /characters` - List user's characters
- `GET /characters/:id` - Get character by ID
- `POST /characters` - Create new character
- `PUT /characters/:id` - Update character
- `DELETE /characters/:id` - Delete character

### Sharing

- `GET /characters/:id/shares` - List shares for a character
- `POST /characters/:id/shares` - Share character with user (by email)
- `DELETE /characters/:id/shares/:shareId` - Remove share
- `GET /shared-characters` - List characters shared with current user
- `GET /shared-characters/:id` - Get shared character by ID

## Production

Build the project:

```bash
pnpm build
```

Start the production server:

```bash
pnpm start
```

## Running on Hetzner server

- Set up caddy, pm2, dependencies etc. with `setupServer.sh` from progeny (includes caddyfile for reverse-proxying to cozycrowns at port 3001)
- Use scp to bring `./scripts/cozySetupServer.sh` to your server, (if you're on windows `dos2unix` it), `chmod +x` it if necessary and run it
- Follow final instructions printed by the script

### Automatic deployments

Pushing a change to `main` that touches `backend/**` runs the `Deploy backend`
GitHub Actions workflow. The workflow connects to `46.224.62.32` and runs
`updateCode.sh` for the exact pushed commit. The script creates a SQLite backup
before fetching that commit, building, migrating, restarting PM2, and checking
the local health endpoint. Deployments are queued rather than cancelled so a
database migration can finish safely. Every one of those operations must
succeed: its non-zero exit status is returned over SSH and marks the GitHub
Actions run as failed, so standard GitHub Actions notifications can alert
subscribed users.

Configure these repository settings before the first deployment:

- Secret `HETZNER_SSH_PRIVATE_KEY`: the complete private SSH key for the deploy
  account (including its `BEGIN` and `END` lines).
- Secret `HETZNER_KNOWN_HOSTS`: the pinned host-key entry for `46.224.62.32`.
  Obtain and verify this through a trusted channel, then store the resulting
  `known_hosts` line here. Do not have CI fetch the key during deployment.
- Optional repository variable `HETZNER_SSH_USER`: SSH account to use. It
  defaults to `github-deploy`.

Use a dedicated `github-deploy` user whose key is restricted to this purpose
and which can run only the update script without a password. Create the account
and its SSH directory if they do not already exist:

```bash
sudo useradd --create-home --user-group --shell /bin/sh github-deploy
sudo install -d -m 700 -o github-deploy -g github-deploy /home/github-deploy/.ssh
```

Then refresh the server checkout so it contains `deployCommand.sh`:

```bash
sudo -u cozycrowns git -C /opt/cozycrowns fetch --no-tags origin main
sudo -u cozycrowns git -C /opt/cozycrowns checkout --detach origin/main
```

Then add the public half of the deployment key to
`/home/github-deploy/.ssh/authorized_keys`, prefixed with these restrictions:

```
command="/opt/cozycrowns/backend/scripts/deployCommand.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty ssh-ed25519 AAAA... github-actions-cozycrowns
```

Finally, add this `sudoers` rule using `visudo` (adjust the command path only
if the checkout lives elsewhere):

```sudoers
github-deploy ALL=(root) NOPASSWD: /opt/cozycrowns/backend/scripts/updateCode.sh *
```
