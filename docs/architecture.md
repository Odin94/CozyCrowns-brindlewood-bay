# Architecture

## Purpose
CozyCrowns is a Brindlewood Bay character sheet that works offline in the browser first, then layers optional account-backed sync on top. The frontend owns the editing experience and local persistence; the backend mainly handles identity, stored copies of characters, and sharing metadata.

## Runtime Boundaries

### Frontend
- Entry point: `frontend/src/main.tsx`
- App shell: `frontend/src/App.tsx`
- Main screen: `frontend/src/pages/CharacterSheet.tsx`
- Local character state: `frontend/src/lib/character_store.ts`
- Settings state: `frontend/src/lib/settings_store.ts`
- API client and token storage: `frontend/src/utils/api.ts`
- Auth/query orchestration: `frontend/src/hooks/useAuth.ts`
- Backend pull-once sync: `frontend/src/hooks/useBackendCharactersSync.ts`
- Save-to-backend flow: `frontend/src/hooks/useCharacterSave.ts`
- JSON validation: `frontend/src/types/characterSchema.ts`
- PDF export: `frontend/src/lib/pdf_generator.ts`

### Backend
- Server bootstrap: `backend/src/index.ts`
- Auth routes: `backend/src/routes/auth.ts`
- Character CRUD routes: `backend/src/routes/characters.ts`
- Share routes: `backend/src/routes/shares.ts`
- Auth middleware: `backend/src/middleware/auth.ts`
- Database schema: `backend/src/db/schema.ts`
- SQLite/Drizzle setup: `backend/src/db/index.ts`
- Request validation: `backend/src/schema/character.ts`, `backend/src/schema/share.ts`, `backend/src/schemas/user.ts`

## App Flow

### Startup Flow
1. `frontend/src/main.tsx` loads the saved locale from Zustand, loads Lingui translations, and only then imports `App`.
2. PostHog is initialized only if a public key is present in the frontend env.
3. `App` chooses between the auth callback screen and the character sheet based on `window.location.pathname`.

### Local Editing Flow
1. `CharacterSheet` renders the sheet sections and mounts the auth/sync hooks.
2. `useCharacterStore` keeps the active character in a persisted Zustand store.
3. The store intentionally mirrors the current character into top-level fields so components rerender without selectors for every nested access.
4. JSON import/export and PDF export are initiated from `frontend/src/components/MenuDialog/MenuDialog.tsx`.

### Auth And Session Flow
1. The frontend stores the WorkOS sealed session token in `localStorage` via `tokenStorage` in `frontend/src/utils/api.ts`.
2. `useAuth` uses React Query to fetch `/auth/me` when a token exists.
3. Backend auth lives in `backend/src/middleware/auth.ts` and `backend/src/routes/auth.ts`.
4. If a session is stale but refreshable, the backend returns `X-New-Token`; `handleResponse()` in the frontend saves it automatically.
5. Login starts with a redirect to `/auth/login`, callback handling happens in `/auth/callback`, and logout asks the backend for a WorkOS logout URL.
6. Local testing can opt into a loopback-only session via `LOCAL_AUTH_ENABLED=true` in the backend. The frontend shows the local sign-in control only on a loopback hostname. It uses `local-development-user`, has an in-memory eight-hour token, and must stay disabled outside local development.

### Backend Sync Flow
1. `useBackendCharactersSync` runs once per authenticated user session.
2. It fetches `/characters`, keeps only `owned` characters, and merges them into the local store.
3. `useCharacterSave` saves only when the user is authenticated and the current character has a non-empty name.
4. Existing backend IDs trigger `PUT /characters/:id`; otherwise the frontend creates a new backend row with `POST /characters`.

## Data Model Notes

### Character Shape
- The editable shape is defined in `frontend/src/lib/character_store.ts`.
- JSON import/export validation is defined in `frontend/src/types/characterSchema.ts`.
- Backend request validation is defined in `backend/src/schema/character.ts`.
- The backend stores `characters.data` as a JSON string instead of normalizing individual fields into SQL columns.

### Versioning
- `version` increments when the backend sees a name change or a data change.
- `characterVersion` increments only when the backend sees a data payload change.
- If you change how saves are merged or compared, verify both counters still behave intentionally.

### Database Tables
- `users`: WorkOS-backed account metadata plus app nickname
- `characters`: owner, name, JSON data, version counters, soft-delete timestamp
- `character_shares`: who shared which character with whom

## Important Architectural Constraints
- The sheet must remain usable without signing in.
- Character schema changes are usually cross-cutting even though the database stores JSON; update all validation/default layers together.
- The frontend uses the `@/` alias for `frontend/src`.

## Verification Contracts

### Frontend UI Or State Changes
- Run `cd frontend && pnpm lint`
- Run `cd frontend && pnpm build`
- Manually smoke-test the edited flow in the browser if the change affects interaction or rendering

### Character Schema Or Serialization Changes
- Run `cd frontend && pnpm lint`
- Run `cd frontend && pnpm build`
- Run `cd backend && pnpm build`
- Manually test JSON import/export and, if relevant, PDF export

### Backend Route Or Auth Changes
- Run `cd backend && pnpm build`
- If frontend behavior changed too, also run `cd frontend && pnpm build`
- If WorkOS behavior is involved and credentials are unavailable, leave a concrete manual verification note


### Conflict-safe local persistence

Maven records retain `remoteContent`, the last confirmed payload. Server revision
updates never mark newer in-flight edits as confirmed. A divergent newer cloud
copy preserves the local draft under a new local identity before adopting the
remote revision. Dark Conspiracies use the same confirmed-content convention.

Maven browser persistence uses a checkpoint and one field journal per browser
tab. Tabs hydrate each other's operations rather than overwriting whole
collections. Conflicting fields become independent local recovery records;
deleted records retain tombstones so late edits cannot restore their server ID.
Web Locks serialize checkpoint compaction, and writer frontiers prevent replay.
Storage write failures leave the editable document in memory and show an export
warning. The original storage key remains a legacy-compatible checkpoint.

Mystery drafts persist their confirmed content baseline. Equal-revision dirty
drafts resume autosave; drafts that diverge from a newer cloud revision are
preserved before creating a separate recovered mystery.

Linked Book Club clues retain a nullable source entry ID. Migration 0011 is
additive and accepts existing rows without backfill. The first source edit maps
legacy links against the previous source document, consuming duplicate display
strings once in deterministic clue order. Truly identical historical duplicates
have no recoverable source ordering. Removed source clues remain Book Club
history so discoveries and theory-board connections are retained.

PDF exports use Helvetica for supported text and lazily fetch the licensed Noto
CJK font only for Unicode text that requires it. The Unicode font is embedded in full because fontkit subsets dropped composite CJK glyphs in common readers. This increases Unicode exports to approximately 6.7 MB; Latin exports keep their original size. Unsupported symbols show a warning, with original text retained in the
editable PDF form fields.


### Recovery and deletion follow-up guarantees

Mystery drafts are scoped by owner and document ID. Missing unscoped legacy
IDs are never automatically uploaded to a different account. Pending conflicting
drafts remain visible with retry/export controls. Stable recovery request IDs
make recovery creation idempotent, including Strict Mode and reload retries.
Obsolete account loads cannot select or overwrite the current account's drafts.

Maven save/delete operations share one per-owner document queue. Deletion intents
persist before waiting for a create acknowledgement; orphaned late creates are
removed or retained as a pending cloud deletion. Both account generation and
live bearer identity gate queued mutations and completion. An idempotent create
retry compares the actual accepted baseline before updating a newer local draft.

Deleted payload recovery is bounded to the latest 20 documents for 30 days and
available through the menu. Compaction prunes older payloads while retaining
small identity tombstones. A stale tab editing a pruned deletion contributes a
full anonymous recovery snapshot rather than resurrecting the cloud identity.
Invalid checkpoints are quarantined without blocking valid journal replay.

Legacy source entries use content-derived identities until a source save
persists explicit IDs. Ambiguous idless duplicate deletions conservatively keep
prior progress and create a new source identity. Category changes update the
same Book Club clue and theory node in place.
