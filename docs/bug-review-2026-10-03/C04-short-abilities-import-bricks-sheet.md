# C04 — A schema-valid partial import overwrites the draft and bricks the sheet

Severity: **High**. Confirmed through the real file chooser, import, and reload at `0cb664b`; screenshot: `../../../evidence/cozycrowns-import-crash.png`.

Revalidated on committed revision `cd74477` after incorporating the newer local performance work. Uncommitted architecture changes in the primary checkout were outside this review.

## Reproduction and evidence

1. Give an anonymous Maven a name and other valuable local edits.
2. Menu → Load from save file; select `{"name":"Imported partial Maven","abilities":[{"name":"Reason","value":1}]}`.
3. The import validator accepts the file and overwrites the existing Maven.

The page becomes blank with `Cannot read properties of undefined (reading 'value')`. Reloading produces the same blank page because the one-element abilities array is persisted. The previous draft is gone from the store. `CharacterDataSchema.safeParse({})` also succeeds and silently resets the document to defaults.

## Cause

`frontend/src/types/characterSchema.ts` accepts any abilities array length. `character_document.ts:normalizeCharacter` keeps a nonempty short array. `components/character/Abilities.tsx` renders five fixed entries and unconditionally reads each array element's `.value`. The importer replaces the active record without retaining a recovery copy. The backend likewise accepts an abilities array of length one.

## Suggested fix

Validate the full contract before replacing any record. Normalize legacy abilities by canonical ability name into five complete entries, with explicit rules for duplicates, unknown names, and ranges. Reject unrelated JSON or require an explicit legacy migration. Import into a new stable local identity, or retain a durable pre-import snapshot. Add a recovery screen so malformed stored data cannot permanently blank the app.

Regression: missing, short, reordered, duplicate, and oversized ability lists; anonymous existing draft survives a rejected import; refresh remains usable.
