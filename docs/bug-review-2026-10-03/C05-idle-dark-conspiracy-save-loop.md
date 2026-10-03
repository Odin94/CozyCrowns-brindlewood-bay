# C05 — Dark Conspiracy autosave sends endless writes while idle

Severity: **Medium**. Confirmed through local sign-in and real HTTP requests at `0cb664b`; screenshot: `../../../evidence/cozycrowns-dark-conspiracy.png`.

## Reproduction and evidence

Sign in and add one first Void Clue, then stop editing. In a 6.5-second window the browser sends one POST and **five successful PUTs** to `/dark-conspiracies/:id`. The server revision remains 1 because the data has not changed. Requests continue approximately every 950 ms, even when the Maven sheet is the active view.

## Cause

`frontend/src/hooks/useBackendDarkConspiraciesSync.ts` runs its save effect on `current` and its JSON signature, including remote metadata. Each response calls `updateCurrentDarkConspiracyIdAndVersion`, which constructs a fresh `current` object and triggers the effect again. There is no confirmed content signature or no-op acknowledgement guard.

## Suggested fix

Compare an editable-content-only signature against the last server-confirmed content, skip no-op metadata updates, and serialize outstanding saves. Prefer one app-level sync worker so remounting views cannot create independent save queues.

Regression: one edit produces the required save and then zero writes during an idle period; metadata-only acknowledgements do not reschedule; genuine edits made during a request are saved once afterward.
