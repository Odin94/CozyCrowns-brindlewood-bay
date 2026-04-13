# Change Map

## Purpose
This file is the on-demand guide for where changes usually belong. Use it when a task spans multiple layers and you want the shortest path to the right files.

## Changing The Character Data Shape
- Update defaults, TypeScript types, and persisted local state in `frontend/src/lib/character_store.ts`.
- Update JSON import/export validation in `frontend/src/types/characterSchema.ts`.
- Update the backend request schema in `backend/src/schema/character.ts`.
- Update any affected UI sections under `frontend/src/components/character/`.
- Update `frontend/src/lib/pdf_generator.ts` if the new field should appear in the exported PDF.
- Usually no SQL migration is needed for JSON-only field changes. A migration is only needed if table columns or indexes change.
- Verify with:
  - `cd frontend && npm run lint`
  - `cd frontend && npm run build`
  - `cd backend && npm run build`
  - a manual JSON import/export round-trip

## Changing Auth Or User Profile Behavior
- Frontend files:
  - `frontend/src/hooks/useAuth.ts`
  - `frontend/src/utils/api.ts`
  - `frontend/src/pages/AuthCallback.tsx`
  - `frontend/src/components/AuthButton.tsx`
  - `frontend/src/components/MenuDialog/MeView.tsx`
- Backend files:
  - `backend/src/routes/auth.ts`
  - `backend/src/middleware/auth.ts`
  - `backend/src/config/env.ts`
  - `backend/src/config/workos.ts`
- Watch for token refresh behavior through `X-New-Token`; it is easy to break silently if only one side changes.
- Verify with `cd backend && npm run build` and a manual login/logout/profile smoke test when credentials are available.

## Changing Save Or Sync Behavior
- Frontend save/sync code lives in:
  - `frontend/src/hooks/useCharacterSave.ts`
  - `frontend/src/hooks/useBackendCharactersSync.ts`
  - `frontend/src/lib/character_store.ts`
- Backend save/read rules live in:
  - `backend/src/routes/characters.ts`
- Important behavior to preserve:
  - unauthenticated users should not be blocked from local editing
  - authenticated sync only merges owned characters into the local store
  - empty character names are skipped by the save hook
- Verify with frontend and backend builds plus a short manual save/switch-character smoke test.

## Changing Database Schema
- Update `backend/src/db/schema.ts`.
- Generate migration SQL with `cd backend && npm run db:generate`.
- Review the SQL under `backend/src/db/migrations/` before applying it.
- Apply locally with `cd backend && npm run db:migrate`.
- If the change affects API payloads or validation, update the matching route/schema files in the same pass.

## Changing Translations Or User-Facing Copy
- Wrap UI text with Lingui macros instead of hardcoding plain strings in components.
- After copy changes run:
  - `cd frontend && npm run extract`
  - `cd frontend && npm run compile`
  - `cd frontend && npm run build`
- Translation catalogs live under `frontend/src/locales/`.

## Changing PDF Export
- Main implementation: `frontend/src/lib/pdf_generator.ts`
- The exported PDF is based on `frontend/src/resources/brindlewoodbay-charactersheet_fillable.base64`.
- Field names in the PDF form are stringly typed, so small naming mistakes surface only at runtime.
- Verify by downloading a PDF and opening it, not just by building the app.

## Sharing Work
- Backend sharing API exists in `backend/src/routes/shares.ts` and the `character_shares` table.
- There is no matching frontend API helper or full sharing UI yet, so sharing tasks usually require both new frontend work and existing backend integration.
