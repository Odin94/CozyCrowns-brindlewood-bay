# AGENTS.md

## Project Map
- `frontend/`: Vite + React 19 character sheet app. Main startup is `frontend/src/main.tsx`; the primary screen is `frontend/src/pages/CharacterSheet.tsx`.
- `backend/`: Fastify + WorkOS + Drizzle/SQLite API. Main startup is `backend/src/index.ts`; HTTP routes live in `backend/src/routes/`.
- Deeper docs live in `docs/architecture.md` and `docs/change-map.md`.

## Commands
- Package manager: `pnpm` (workspace at repo root). `npm` is no longer used.
- Install dependencies: `pnpm install` from the repo root (installs both workspaces).
- Frontend dev server: `cd frontend && pnpm dev`
- Frontend checks: `cd frontend && pnpm lint` (oxlint) and `cd frontend && pnpm build`
- Frontend translations: `cd frontend && pnpm extract && pnpm compile`
- Backend dev server: `cd backend && pnpm dev`
- Backend checks: `cd backend && pnpm build`
- Database workflow: `cd backend && pnpm db:generate` after schema changes, then `cd backend && pnpm db:migrate`
- Linting/formatting is handled by [oxlint](https://oxc.rs/docs/guide/usage/linter) (config at `frontend/.oxlintrc.json`). Use `pnpm format` in `frontend/` to autofix.
- Full smoke verification for most changes: frontend lint + frontend build + backend build

## Non-Negotiable Invariants
- CozyCrowns is local-first. Anonymous users can still edit, import/export JSON, and export PDF. Authentication only adds cloud sync and account features.
- The character payload has three sources of truth that must stay aligned:
  - local editable state in `frontend/src/lib/character_store.ts`
  - JSON import/export validation in `frontend/src/types/characterSchema.ts`
  - backend request validation in `backend/src/schema/character.ts`
- Backend character rows are soft-deleted through `deletedAt`; routes that fetch live characters should keep filtering deleted rows out.
- Auth uses a WorkOS sealed session stored in frontend `localStorage` as a bearer token. Backend auth may rotate the token through `X-New-Token`, so frontend and backend auth changes usually span both sides.
- User-facing text should use Lingui macros. If copy changes, regenerate catalogs before finishing.

## Workflow Triggers
- If you change character fields or defaults, read `docs/change-map.md#changing-the-character-data-shape`.
- If you touch auth, account state, or backend sync, read `docs/architecture.md#auth-and-session-flow`.
- If you change database tables or indexes, update `backend/src/db/schema.ts`, generate a migration, and document compatibility assumptions for existing data.
- If you add dependencies, large UI restyling, or deployment assumptions, confirm first.

## Known Gaps
- There is currently no automated test suite. Default verification is targeted builds/lint plus a short manual smoke plan.
- Sharing endpoints exist in the backend, but the frontend does not yet have a matching API client or full sharing UI flow.
