# C01 — Remote reconciliation destroys an unsaved local draft

Severity: **High**. Confirmed using the running browser's actual store at `0cb664b`.

Revalidated on committed revision `7b88cb2` after incorporating the newer local performance work. Uncommitted architecture changes in the primary checkout were outside this review.

## Reproduction and evidence

1. A local Maven has remote ID R and confirmed version 1.
2. Edit its name to `LOCAL DRAFT` without saving it.
3. Supply a version 2 remote Maven through `mergeRemote`, as account initialization does.

The name becomes `REMOTE VERSION`. Only one character remains; the local draft is neither retained nor archived. This bypasses the API's otherwise useful 409 protection because reconciliation replaces the local document before a save.

## Cause

`frontend/src/lib/character_store.ts:mergeRemote` compares version numbers and unconditionally replaces the matching local record when the server version is higher. It stores neither a confirmed base nor a dirty flag. `useBackendCharactersSync` invokes this on sign-in and sheet remount.

## Suggested fix

Store the last confirmed document alongside each local ID and remote revision. Adopt a newer remote version only when the local document is clean; otherwise merge disjoint changes or retain both versions and surface the conflict. Keep a durable recovery snapshot before replacements.

Regression: edit offline, advance the cloud version elsewhere, then sign in or remount; both versions must remain recoverable.
