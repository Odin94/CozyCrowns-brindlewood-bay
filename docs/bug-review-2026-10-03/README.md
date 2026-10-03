# CozyCrowns deep bug review — 2026-10-03

**All 9 findings are fixed and verified locally.** The original review found 5 high and 4 medium severity bugs. Each report preserves its reproduction, impact and proposed fix, followed by implementation status. Independent review of final source revision `171a372` found no remaining actionable feedback.

Initial committed snapshot: `0cb664b`. Final revalidation: `cd74477` plus documentation-only review commits. The original review used `chore/odin/deep-bug-review`; fixes are now on `fix/odin/review-bug-fixes`. The primary checkout's uncommitted architecture work was not reviewed or changed. Nothing was pushed and no PR was created.

## Findings

| ID                                                | Severity | Observed bug                                                            |
| ------------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| [C01](C01-remote-merge-destroys-local-draft.md)   | High     | Remote reconciliation destroys an unsaved local draft                   |
| [C02](C02-pdf-extra-xp.md)                        | Medium   | PDF exports mark one extra XP box                                       |
| [C03](C03-pdf-unicode-fails.md)                   | Medium   | Unicode accepted by the sheet can prevent PDF export                    |
| [C04](C04-short-abilities-import-bricks-sheet.md) | High     | A schema-valid partial import overwrites the draft and bricks the sheet |
| [C05](C05-idle-dark-conspiracy-save-loop.md)      | Medium   | Dark Conspiracy autosave sends endless writes while idle                |
| [C06](C06-cross-tab-storage-overwrite.md)         | High     | A second tab overwrites newer browser-only character edits              |
| [C07](C07-mystery-draft-recovery-loss.md)         | High     | Mystery recovery suppresses unsaved drafts or discards them             |
| [C08](C08-source-clue-edits-erase-progress.md)    | High     | Editing a source clue erases discovery and theory-board connections     |
| [C09](C09-failed-delete-resurrects-character.md)  | Medium   | Failed cloud deletion appears successful, then the Maven returns        |

## Verification and scope

Original review baseline: 15 backend tests. Final fix verification: **39 backend tests**, frontend store/conflict/import regressions, the 2,000-edit store benchmark, XP/Unicode PDF form and Poppler raster regressions, and actual API auth-session regression checks all pass. Formatting, lint, both production builds/typechecks and migration validation pass. Actual Maven PDF output was checked for XP values 0–5. Mystery save-revision control returned 409 for a stale manual save.

All three apps were launched locally against disposable SQLite databases. Browser/API probes cover anonymous persistence, cross-tab editing, import/export, authenticated sync, conflicts, reload/recovery, character switching, and the reported interaction bugs. Default sheets were inspected at 390 × 844 with no horizontal overflow or page errors. Passing existing tests did not prevent the reported bugs.

Progeny authentication verification uses fixture users at the WorkOS boundary; Hiveborn and CozyCrowns use their built-in local sign-in. Live WorkOS login, real multi-device networks, production data, and production latency were not tested. Fixtures and failure injection are identified in the individual reports. They do not change app source or reset any limits.

## Evidence

Shared [browser results](../../../evidence/browser-results.json), [screenshots](../../../evidence/), [check logs](../../../evidence/), and [reproduction scripts](../../../harness/) live outside the app repositories, under the common review directory. Scripts call actual stores/APIs to prepare some fixtures; the reports distinguish those from direct UI actions.

- [Screenshot: primary reproduction](../../../evidence/cozycrowns-import-crash.png)
- [Screenshot: second reproduction](../../../evidence/cozycrowns-clue-connections-lost.png)

## Fix implementation

All nine findings have local implementations and regression checks on `fix/odin/review-bug-fixes`. Independent review and browser validation are recorded in [the completed review-loop report](FIX_REVIEW.md).

Native browser follow-up checks confirm queued saves, idle request counts, safe
partial imports, mystery recovery after an injected 503 and its retry, independent
stale-tab edits, failed deletion and successful retry, and preserved clue/category
changes with discovery and theory edges. Evidence includes
[stale tabs](../../../evidence/fixes/cozycrowns-two-tab.json),
[failed deletion](../../../evidence/fixes/cozycrowns-delete-failed.json),
[deletion retry](../../../evidence/fixes/cozycrowns-delete-final.json),
[mystery recovery](../../../evidence/fixes/cozycrowns-recovery-retry.json), and
[clue category change](../../../evidence/fixes/cozycrowns-clue-category.json).
