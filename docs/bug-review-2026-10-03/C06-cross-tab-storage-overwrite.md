# C06 — A second tab overwrites newer browser-only character edits

Severity: **High**. Confirmed using two real anonymous tabs at `0cb664b`; reproduction: `../../../harness/cross-tab.js`.

Revalidated on committed revision `cd74477` after incorporating the newer local performance work. Uncommitted architecture changes in the primary checkout were outside this review.

## Reproduction and evidence

Open one local Maven in two tabs. Add a condition in A; B remains stale. Change the name in B. Reload A: its condition is gone. The final localStorage payload contains B's name and the original empty conditions. No account or cloud requests are involved.

## Cause

`frontend/src/lib/character_store.ts` rewrites the complete `cozycrowns-character-storage` collection through Zustand persistence without cross-tab synchronization, a shared write lock, or per-document conflict detection.

## Suggested fix

Use stable local IDs with transactional per-record persistence and coordinate cross-tab changes. Reconcile incoming records against a confirmed local base and preserve dirty divergent versions. Apply the same protection to Dark Conspiracy storage.

Regression: disjoint edits in two tabs, simultaneous character creation/import, and deletion; a stale tab must never overwrite newer records or the entire collection.
