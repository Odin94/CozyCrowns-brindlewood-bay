# Codebase Design Report

## Scope and lens

This review examines CozyCrowns with the **codebase-design** vocabulary: a
**module** should place substantial behaviour behind a small **interface** at a
deliberate **seam**. The goal is **depth** (caller leverage) and **locality**
(one place to change and verify), rather than merely reducing file sizes.

The application already has a sensible top-level seam: the frontend remains
local-first and the backend adds optional identity and persistence. Preserve
that. The recommendations below make the feature seams inside each tier more
explicit; they do not move editing into the backend or require a server for
anonymous use.

## Executive summary

The most valuable improvement is to make the character data contract a single
deep module. Today, defaults, validation, and serialization rules are spread
across the Zustand store, JSON-import schema, save hook, and backend schema.
That is an explicit repository invariant, but it has already drifted in
observable ways.

Next, collapse each document's selection, merge, and save lifecycle behind
small interfaces. The current character store exposes both the whole selected
document and a second, mirrored copy of every field; save/sync logic is also
implemented separately for characters, dark conspiracies, and mysteries.
Those interfaces make every new field and every sync rule cross-cutting.

Finally, split the Book Club route module along its actual responsibilities.
It is a 1,239-line mix of HTTP registration, permissions, read-model assembly,
WebSocket lifecycle, and theory-board state transitions. The read model and
theory-board rules earn their own deep modules; route handlers should remain
thin adapters.

## Prioritized findings

### P0 — Establish one character-document contract

**Evidence.** The editable shape and game-specific defaults live in
`frontend/src/lib/character_store.ts`; JSON import defaults live in
`frontend/src/types/characterSchema.ts`; backend request validation is a third
copy in `backend/src/schema/character.ts`; and `useCharacterSave` manually
builds a fourth outbound representation. The import schema currently gives
`crownChecks` the Void-crown length, while the store gives it the Queen-crown
length. The backend defaults all collection fields to empty arrays rather than
the browser's game-specific defaults. The store's default also omits
`schemaVersion`, while the import schema supplies it.

This is a shallow cluster: callers must know which representation to use,
which defaults to merge, and which fields are local metadata. A character field
therefore changes at four or more sites and is easy to validate differently on
import, sync, and save.

**Recommended module.** Introduce a pure `character-document` module in a
shared workspace location that neither imports React nor Lingui. Its interface
should be no wider than:

```ts
createDefaultCharacter(): CharacterData
normalizeCharacter(input: unknown): CharacterData
parseImportedCharacter(input: unknown): CharacterData
toPersistedCharacter(character: CharacterData): PersistedCharacter
```

`CharacterData` should contain editable data only. Keep identity, remote
version, and local selection state in a separate `CharacterRecord` wrapper.
Have both frontend and backend use the same structural Zod schema and the same
normalization rules; inject or locally define only the translated presentation
labels needed by the UI. The backend can still enforce request-specific rules
such as a required non-empty `name` for creation.

**Why this is deep.** Callers provide an unknown/partial document and receive a
complete, compatible editable document. Array lengths, schema evolution,
legacy imports, and local-vs-persisted field selection disappear behind one
interface.

**Verification at the interface.** Add table-driven contract tests that pass
legacy, partial, valid, and invalid documents through `normalizeCharacter` and
`toPersistedCharacter`. Assert identical normalized results in the frontend
and backend build. Include a regression test for Queen and Void array lengths,
schema version, and all 12 cozy-item defaults. This is more useful than tests
of individual Zod declarations.

### P1 — Make the character collection one source of truth

**Evidence.** `CharacterState` exposes `characters` plus twelve mirrored
top-level selected-field values and twelve field-specific setters. Selecting,
adding, removing, merging, and editing each repeat the mirror operation.
Several UI modules read the mirrored values while save/sync modules read the
collection. The comments in the store explicitly describe this as a rerender
workaround.

**Recommended module.** Replace the dual representation with a
`character-collection` module whose external interface is based on selection
and document operations, for example:

```ts
select(id: CharacterId): void
create(): CharacterId
updateSelected(change: Partial<CharacterData>): void
remove(id: CharacterId): void
mergeRemote(records: RemoteCharacterRecord[]): void
selected(): CharacterRecord
```

Zustand selectors can subscribe a field module to
`selected()?.name`, `selected()?.abilities`, and so on; a duplicate top-level
copy is not required for selective rerenders. Use stable character IDs, with a
generated local ID before remote creation, rather than collection indexes as
identity. Keep the rules for preserving unsynced local records and accepting a
newer remote version inside `mergeRemote`.

**Why this is deep.** Every selected-document transition is implemented and
tested once. Callers ask for the selected document or change it; they no longer
need to know the synchronization rules between two representations.

**Migration constraint.** Do this after the P0 contract exists. It is a
behavioral refactor: retain the persisted storage key or add an explicit
persisted-state migration so current browser data is normalized rather than
discarded.

### P1 — Deepen local-first synchronization into a document lifecycle module

**Evidence.** Characters split initial pull, queueing, payload construction,
and debounced auto-save among `useBackendCharactersSync`, `useCharacterSave`,
and `CharacterSheet`. Dark conspiracies repeat pull and auto-save in one hook,
but have different queue/conflict behavior. `MysteriesPage` contains another
save queue, snapshot comparison, version map, debounce, and conflict handling.

This creates divergent conflict behavior: character saves serialize requests,
whereas dark-conspiracy saves rely on debounce alone. All three flows use
optimistic versioning, but their interfaces are not shared.

**Recommended module.** Create a generic, UI-agnostic `synced-document`
module. Its external interface should express lifecycle, not transport details:

```ts
loadForUser(userId): Promise<void>
scheduleSave(id): void
saveNow(id): Promise<SaveOutcome>
resolveConflict(id, choice): Promise<void>
```

Internally it owns snapshots, debouncing, per-record queues, version updates,
and the rule that local editing always remains available. Supply each document
type with a small codec (normalization, meaningful-content predicate, payload
mapping, and conflict message) and a repository adapter (list/create/update).
The production adapter calls the existing HTTP client; a fake adapter supports
deterministic lifecycle tests. This is a real seam once those two adapters
exist. Do not expose queues, timers, or raw HTTP responses to React modules.

**Verification at the interface.** Test remote-first merge, local-first merge,
create-then-update, rapid edits, retried failure, and a 409 conflict through
the lifecycle interface with a fake repository and fake clock. Delete tests
that only assert implementation timers or hook internals once these tests
cover the behavior.

### P1 — Split Book Club rules from the Fastify route adapter

**Evidence.** `backend/src/routes/bookClubs.ts` contains approximately 20 HTTP
and WebSocket entry points. In addition to parsing requests, it owns member and
GM checks, overview assembly, invitation behavior, character assignment,
clue-to-node synchronization, edit locks, transactions, and realtime
notification coordination. Its overview builder alone performs five primary
queries plus follow-up joins and presentation shaping.

**Recommended modules.** Extract three modules, retaining Fastify route
registration as a thin adapter:

1. `book-club-overview`: `forUser(userId)` and `forClub(clubId)` return the
   complete read model, including the bounded recent-roll policy.
2. `book-club-membership`: operations such as `invite`, `acceptInvitation`,
   `assignCharacter`, and `grantGameMaster`, including authorization and
   notification rules.
3. `theory-board`: `read`, `addNode`, `updateNode`, `lockNode`, `releaseNode`,
   and edge operations, including clue-node synchronization and optimistic
   version checks.

Each module may use the database directly at first. SQLite is a
local-substitutable dependency, so test these modules against a disposable
database instead of adding a database port with only one production adapter.
The WebSocket connection lifecycle is a separate adapter concern; it should
call membership/read-model operations, not contain domain transitions.

**Why this is deep.** HTTP and WebSocket callers receive stable outcomes,
while permission checks, transactions, write notifications, and read-model
assembly have locality. A theory-board change then does not require navigating
through unrelated club endpoints.

### P2 — Narrow the frontend transport interface by domain

**Evidence.** `frontend/src/utils/api.ts` is 778 lines and combines auth-token
storage, response/error conversion, WebSocket connection behavior, domain
types, and every endpoint for characters, conspiracies, mysteries, library,
and Book Clubs. Many resource payloads use `any`.

**Recommended module layout.** Keep one deep browser `http-client` module for
authorization headers, token rotation, JSON decoding, standardized errors,
and request IDs. Give it a deliberately small internal interface such as
`request<T>(path, options)`. Build domain modules on top:

```
http-client
├── auth-repository
├── character-repository
├── dark-conspiracy-repository
├── mystery-repository
└── book-club-repository (+ live-update adapter)
```

Move types next to the domain contract that owns them and replace `any` at the
repository interface. This is primarily a locality improvement; do not create
a public transport port until a fake adapter is needed by the lifecycle tests.

### P2 — Separate page orchestration from large page layout modules

`BookClubOverview.tsx` (1,125 lines) mixes polling, reconnect/backoff,
selection, every mutation, local character navigation, and rendered layout.
`MysteriesPage.tsx` (756 lines) similarly owns data loading, local draft
recovery, auto-save, conflict handling, and the editing layout. Once the P1
lifecycle and Book Club modules exist, expose focused React-facing modules
such as `useBookClubSession` and `useMysteryEditor`. Their interfaces should
return view state plus intent-level commands; page modules should arrange UI
and translate user gestures only.

Do not split by visual card merely to shorten files: a layout-only module with
all state threaded through props is shallow. Split where a module can hide a
complete behavior, such as reconnection or draft recovery.

## Suggested implementation sequence

1. Add P0 shared character normalization and contract tests. Fix the existing
   default drift as part of that change.
2. Refactor the character collection behind its new selection interface and
   add a persisted-state migration plus selection/merge tests.
3. Extract the document lifecycle with the character repository first; then
   migrate dark conspiracies and mysteries only where their behavior can share
   the same interface.
4. Extract Book Club overview and theory-board modules with disposable SQLite
   integration tests, then make route handlers thin.
5. Split the browser transport by domain while migrating the corresponding
   callers. Avoid a flag-day rewrite.

## Guardrails

- Preserve the local-first interface: authentication and network failures must
  never block local edit, import/export, or PDF export.
- Use a seam only when it has two adapters. The proposed synchronization seam
  qualifies with production HTTP and fake-test adapters; the current database
  access does not yet need a port because disposable SQLite provides the test
  substitute.
- Treat normalization and serialization as the test surface. Do not test past
  the module interface by asserting Zustand internals, debounce timers, or
  route-local queries.
- Ship the work in vertical slices. The character contract is a small,
  high-confidence slice; the Book Club redesign should not block it.

