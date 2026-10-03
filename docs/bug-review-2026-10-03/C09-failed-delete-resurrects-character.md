# C09 — Failed cloud deletion is presented as success and the Maven returns

**Status: fixed and verified.** Final source revision `171a372`; [completed review loop](FIX_REVIEW.md).

Severity: **Medium**. Confirmed through the actual delete controls at committed revision `cd74477`.

## Reproduction and evidence

Sign in locally, create a cloud Maven, and use its tab's delete button. Make the DELETE request return a temporary 503. Confirm **Delete Character**.

The app removes the local Maven and closes the confirmation dialog without a visible failure or a queued retry. Restore normal responses and reload: cloud reconciliation adds the supposedly deleted Maven back. The confirmation had explicitly promised deletion from the backend too.

Evidence: `cozycrowns-failed-delete.js` and `browser-results.json:C09`, with `removedLocallyDespite503: true` and `returnedAfterReload: true`. Only the DELETE response is injected; creation, authentication, UI controls, and the subsequent cloud load are real.

## Cause

`frontend/src/hooks/useDeleteConfirmation.ts:confirmDelete` logs the request error and then unconditionally calls `removeCharacter`. There is no durable deletion intent and no visible failed-save state. `useBackendCharactersSync` therefore treats the still-live server row as a missing local character and imports it on reload.

## Suggested fix

Either keep the record and show a retryable deletion failure, or persist a local tombstone and retry the cloud deletion before marking it complete. Reconciliation must honor pending deletion intent while retaining a recovery copy. Do not close the dialog as though a rejected request completed successfully.

Regression: 503, offline failure, and eventual success; a pending deletion must not silently resurrect after reload, and a failure must remain visible and retryable.

## Implementation

Implemented localId-bound deletion, a stable confirmation name, disabled pending buttons and double-submit protection, and visible retryable failure. Authenticated cloud deletion removes the local record only after success; logged-out deletion removes and archives only the browser copy, preserving its cloud row. Shared save/delete ordering and durable owner-bound intents also handle late creation acknowledgements.

Regression validation is recorded in the repository tests and the final review-loop report.
