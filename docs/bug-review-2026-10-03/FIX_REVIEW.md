# Fix review loop

## Initial implementation

Commit `c52fddf` implements C01–C09. Builds, lint, formatting, focused frontend
regressions and 22 backend tests passed. Unicode PDF validation includes actual
Poppler raster output; full TrueType embedding avoids missing composite glyphs.

## Independent review round 1

Seven actionable findings were implemented:

1. Legacy source identities now follow content and persist on saves instead of following array positions; ambiguous duplicate changes retain previous progress.
2. Failed mystery recovery remains an owner-scoped pending draft with visible retry/download controls.
3. Draft envelopes scope ownership, cancel obsolete account loads, preserve unowned legacy documents and use idempotent recovery request IDs.
4. Maven creation/save/deletion share one document queue; durable deletion intents and late-create cleanup prevent resurrection. Queued work checks account generation and bearer identity.
5. Normal/void changes preserve the same source clue, discovery flag and theory node identity.
6. Invalid checkpoints are quarantined while validated journals continue to recover editable drafts.
7. Deleted payloads have an accessible latest-20/30-day recovery archive; compaction removes older payloads while retaining identity tombstones and full late-edit recovery.

Regression checks cover all seven paths, same-account request ordering, account
changes during a queued create/delete, idempotent-create payload comparison,
duplicate source descriptions and pre-migration theory connections. Each browser document also receives a fresh writer identity before any storage writes, including duplicated tabs; checkpoint compaction bounds reload journals. The next independent review evaluates this resulting implementation.

A subsequent review preflight found quota failure followed by external hydration
could discard an unsaved edit. Failed journals now remain as a memory overlay,
merge incoming durable operations, and retry persistence on the next write. The
focused test covers failed local write, another tab's edit and durable reload.

Recovery completion also checks the source content and recovery request identity,
keeping newer edits and selection changes made while its POST is in flight.

Verified HTTP/WebSocket token renewal now retains a login identity epoch and
rejects obsolete response tokens after another sign-in. Legacy mystery reads
expose their stable identities before the first text correction.

## Frozen review follow-up

Logged-out deletion now archives/removes only the browser's cached Maven and
retains its cloud row. An obsolete logout response and its hook cleanup cannot
clear another login's token, user cache or navigation.

Logout's delayed analytics initialization also rechecks the completed session
epoch before resetting identity and before navigation, preserving a later login.
