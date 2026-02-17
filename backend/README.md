# CozyCrowns Backend

Fastify backend for CozyCrowns character management system.

## Features

- WorkOS authentication
- Character CRUD operations
- Character sharing between users
- CSRF protection
- SQLite database with Drizzle ORM

## Setup

1. Install dependencies:
```bash
npm install
```

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
npm run db:generate
```

5. Run migrations:
```bash
npm run db:migrate
```

## Development

Start the development server:
```bash
npm run dev
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
npm run db:studio
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
npm run build
```

Start the production server:
```bash
npm start
```
