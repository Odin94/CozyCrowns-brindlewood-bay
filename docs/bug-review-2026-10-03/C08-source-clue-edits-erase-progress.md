# C08 — Editing a source clue erases discovery and theory-board connections

Severity: **High**. Confirmed against the actual local API at `0cb664b`.

Revalidated on committed revision `cd74477` after incorporating the newer local performance work. Uncommitted architecture changes in the primary checkout were outside this review.

## Reproduction and evidence

Create a source mystery containing clue ID `stable-clue-1`, title `Letter`, description `A signed letter`. Add it to a Book Club and activate the mystery. Mark the clue discovered; connect its theory node to a suspect with edge label `signed by`.

Correct only the source clue description, retaining its ID. The linked Book Club gets a new clue ID with `checked: false`. The old theory node and its edge are deleted, and a new unconnected clue node appears. The text correction destroys player progress.

Evidence: `cozycrowns-linked-clue.js`, `cozycrowns-linked-clue-result.json`, and `browser-results.json:C08`. The before snapshot records `checked: true`; the after board has no edges.

## Cause

`backend/src/routes/mysteries.ts` reconciles linked clues by exact combined display text and `isVoid`. Although source clues carry stable IDs, Book Club clues do not retain that identity. Editing text is interpreted as deleting one clue and inserting another; cascading deletion removes the theory node and its connections.

## Suggested fix

Persist the source entry ID on Book Club clues and reconcile by that identity. Update text in place, preserve discovery state, and update the existing theory node's title/version without replacing its ID or connections. Provide a conservative migration for existing text-matched clues. Destructive removal should happen only for a genuinely removed source entry, with a recovery policy for player-created board data.

Regression: edit/reorder clues and void clues, including duplicate descriptions. Keep discovery flags, tags, node positions, and edges for entries whose identities survive.
