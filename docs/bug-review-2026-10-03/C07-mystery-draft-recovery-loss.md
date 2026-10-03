# C07 — Mystery recovery suppresses unsaved drafts or discards them

Severity: **High**. Both paths confirmed in the running editor/API at `0cb664b`.

Revalidated on committed revision `cd74477` after incorporating the newer local performance work. Uncommitted architecture changes in the primary checkout were outside this review.

## Reproduction and evidence

1. Create a mystery with introduction `SERVER BASE`. Persist an offline draft for its ID with `UNSAVED OFFLINE DRAFT`, retaining the confirmed `updatedAt`.
2. Reload `/mysteries`. After 3.2 seconds, the local draft is visible but there are **zero PUT requests** and the server still has `SERVER BASE`.
3. Repeat with a cloud edit made later than the local draft's confirmed timestamp. Reloading selects the cloud version and overwrites `cozycrowns-mystery-draft`; `PRECIOUS UNSAVED LOCAL DRAFT` disappears and storage contains `NEWER REMOTE EDIT`.

Evidence: `cozycrowns-mystery-draft.js`, `cozycrowns-mystery-newer-server.js`, `browser-results.json:C07/C07newerServer`, and `cozycrowns-mystery-unsaved-restored-draft.png`.

## Cause

`frontend/src/pages/MysteriesPage.tsx:choose` marks any selected document as server-confirmed in `lastSavedById`, including recovered dirty drafts. The loading flow uses `updatedAt` to choose draft versus server, but editing does not update that server timestamp. A newer server timestamp therefore wins without preserving the local branch, while an equal timestamp marks local changes as saved and suppresses autosave.

## Suggested fix

Persist draft identity, dirty content, and the last server-confirmed content/revision separately. Recovering a dirty draft must keep it queued for save. If the server also changed, preserve both documents and offer a conflict decision. Never replace the only draft based solely on timestamps.

Regression: crash/reload and offline/reconnect with unchanged and changed remote content. Verify eventual saving in the first case and durable recovery of both branches in the second.
