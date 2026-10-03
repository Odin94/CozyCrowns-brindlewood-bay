# Performance deep dive — 2026-10-03

Baseline: `0cb664be6f1bb835c82119b5a199ab161ba00fc7`.
Implementation: `bcc0b419d3ce0c591f52cfb2c3b11b86e446a727`.
Raw samples: [performance/2026-10-03](performance/2026-10-03).

Follow-up review preserves the shared save queue between autosave and character switching. Delayed analytics identification is cancelled when the auth effect changes, and logout resets the initialized client before navigating. The final bundle snapshot includes these corrections; the mounted/production interaction measurements describe the initial implementation above.

The Vercel React best practices were applied with rendering and rerendering treated as critical. Measurements ran on macOS arm64, Node 24.15.0, pnpm 10.33.0, React 19.2.6 and Chrome 152 in the shared T3 browser. Both sources use the same locked dependencies. No production database or service was accessed.

## Results

| Measurement | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Real sheet-section commits for 100 name edits | 900 | 100 | 88.9% |
| React actual render duration, median of 3 runs | 124.8 ms | 10.0 ms | 92.0% |
| Synchronous 100-edit harness, median of 3 runs | 193.8 ms | 16.9 ms | 91.3% |
| Production DOM mutations per real keystroke, median of 13 samples | 33 | 5 | 84.8% |
| Production beforeinput-to-name DOM commit, median of 13 samples | 2.6 ms | 0.9 ms | 65.4% |
| JS loaded by anonymous production sheet, 3 matching runs | 914,920 bytes | 621,936 bytes | 32.0% |
| Changed field-selector snapshots for 2,000 name edits | 14,000 | 2,000 | 85.7% |
| Actual store edit CPU including serialization, median of 7 measured batches | 21.94 ms | 15.48 ms | 29.4% |
| Authenticated GET /book-clubs, median of 3 run medians | 23.05 ms | 9.59 ms | 58.4% |

Browser production samples precede the final nonfunctional formatting cleanup, so final chunk hashes and byte counts can differ slightly. The bundle snapshots record the final implementation build. The early backend run observed 54.38 ms before and 9.48 ms after while other work was running; the table uses three later alternating baseline/after runs to reduce contention bias.

## Frontend findings and changes

Every character edit previously normalized the entire document. That cloned the abilities, all checkbox arrays and every cozy item even when only the name changed. Zustand correctly observed those new references and rerendered unrelated sections. The real mounted-component benchmark showed Abilities and Crown of the Void also producing additional commits from their own effects.

`applyCharacterChange` retains the normalization contract for supplied fields and preserves untouched references. Text edits now only invalidate their own field subscription. Full imports still normalize every supplied field, discard unknown fields, and provide complete defaults. Local synchronous persistence remains in place.

The sheet layout, save hook, deletion hook and closed menu previously subscribed to the complete character store. Autosave now lives in a small component with its own subscription. Save and deletion read the current store at interaction time. The save callback stays stable across local edits, retains the serialized save queue, and captures the intended Maven before waiting. Tabs subscribe only to names and local identities, and use stable local IDs as React keys.

PostHog was eagerly included in the startup entry even when analytics had no configured key. A shared lazy initializer now loads the SDK only when configured; analytics initialization and consent lookup do not gate sheet rendering. Identification, reset and consent decisions use that same initialized singleton. There were no PostHog context consumers, so the eager provider was removed. PDF generation and the additional app routes were already lazy and remain so.

## Backend findings and changes

Book Club overview already batched most database reads, avoiding a broad N+1 problem. Its roll query still ranked the complete history for every requested club just to return the most recent 30 events. The replacement issues indexed, bounded lookups using the existing `(book_club_id, created_at)` index. UNION batches contain at most 250 clubs to stay below SQLite's default 500-term compound-query bound. This imposes no new account or club limit.

Overview assembly repeatedly filtered all members, character assignments, mysteries, rolls and clues for each club. It now groups each result once, then looks up the relevant group. Output ordering and the complete response shape remain intact. No migration or cross-request cache is introduced; membership authentication, deleted-character filtering and fresh data are preserved.

The backend fixture contains 20 clubs, 8 members per club, 6 mysteries per club, 30 clues per mystery, and 1,000 historical rolls per club. Each authenticated response returns the same 749,678-byte payload. The benchmark asserts the 30-roll cap and newest event, hidden soft-deleted sheets, active clues and per-mystery void clues. A 501-club fixture with one roll per club also passes, exercising multiple UNION batches.

## Reproduction

From `frontend/`, compare the same actual Zustand store using Vite's production aliases and Lingui transform:

```fish
env BENCHMARK_REF=0cb664be6f1bb835c82119b5a199ab161ba00fc7 pnpm benchmark:store
pnpm benchmark:store
pnpm test
```

Each run performs eight batches of 2,000 distinct name edits, discards the first timing batch, and reports the median of the remaining seven. The storage sink keeps serialized strings in memory: it includes Zustand persistence serialization and excludes browser storage I/O. Selector invalidations are actual reference changes, not estimates of React commits. Historical sources and Vite caches live in disposable directories.

From `backend/`, benchmark the real Fastify route, local auth middleware and Drizzle queries:

```fish
env BENCHMARK_REF=0cb664be6f1bb835c82119b5a199ab161ba00fc7 pnpm benchmark:book-clubs
pnpm benchmark:book-clubs
env BENCHMARK_CLUBS=501 BENCHMARK_ROLLS=1 BENCHMARK_ITERATIONS=1 pnpm benchmark:book-clubs
```

Each regular run migrates and seeds a disposable SQLite file, warms up five requests and measures 30 requests using `Fastify.inject`. Fixture setup and response assertions occur outside request timing. Three baseline/after pairs were alternated, each in a fresh process; raw per-request samples are retained. This measures application request processing and serialization without TCP, remote WorkOS latency or deployment hardware effects.

For the mounted React benchmark, run `pnpm dev --host 127.0.0.1 --port 5193 --strictPort` in `frontend/` and open `/benchmarks/render.html`. Click the benchmark button or call `window.runCharacterRenderingBenchmark()` three times. It renders the real 12 sheet sections inside Query and Lingui providers, then performs 100 unbatched name edits with `flushSync`, recording React Profiler commits and actual durations. To compare the baseline, archive the baseline frontend, copy the same benchmark harness into it, link the same dependency installation, and run on another port with a separate Vite cache. Locale activation must precede importing the store and sheet sections.

For production resource measurements, build and serve each dist on separate origins, clear browser storage, reload, and sum the `.js` resource `decodedBodySize` values after the anonymous sheet settles. No analytics key was configured. With an analytics key the SDK remains an eventual download; it no longer blocks rendering. `node benchmarks/bundle.mjs dist` records entry and chunk bytes/gzip sizes, and accepts a historical dist path as its argument.

The supplementary production typing samples use real keyboard events and a MutationObserver over the application root. Timing starts at `beforeinput` and ends at the first observer delivery containing a mutation to the name input; mutation records are counted in that observer batch. The committed JSON stores all 13 samples for each build. These are local smoke measurements without interleaved baseline/after trials. Neither they nor the development `flushSync`/Profiler harness measure paint, INP or real-user latency. Cold network/FCP timing was not used as an improvement claim.

## Verification and remaining costs

Repository formatting, frontend/backend lint, both TypeScript builds and the test suite passed. Tests cover structural sharing, normalized partial edits, full imports, omitted local metadata, selected-Maven identity through remote updates, immediate persisted snapshots and rehydration. Delayed-initializer tests cover stale analytics identities during user transitions, cancellation on logout, reset-before-navigation ordering and failed/disabled analytics. The production browser smoke test confirmed anonymous name and ability edits survive reload. No user-facing strings or styles changed.

The sheet still synchronously serializes local characters on every edit. That protects the local-first save contract; changing persistence scheduling would require separate durability design. Large Book Club responses still include full notes and clue lists; response reduction would need a compatible API/UI loading change. The 696 kB PDF chunk is already deferred to export. Measurements here establish reductions in actual work and local timings, not deployment-wide percentiles.

## Second pass: all routes and major views

This pass compares the completed first pass, `7b88cb2512fac15c920723d81e0a9cec10962e81`, with the all-views changes in this report. It does not reuse the original sheet baseline to inflate the new gains. Rendering/rerender work was treated as critical under the Vercel React best-practices guidance. Baseline source and production dist were retained outside git before changes.

The editable character sheet is now loaded only by routes that use it. Book Club cards and scenery retain their rendered subtrees during unrelated edits, navigation and unchanged fresh HTTP JSON responses. Club refresh/socket callbacks remain stable across panel navigation. Mystery collection editors retain their subtrees during metadata edits. Theory board scenes retain nodes, edge editors and tooltips during viewport and unrelated dialog edits. Dark Conspiracy fields subscribe to their own values. Library browsing uses an optional approved-summary response, while copying, moderation and the existing full-library API retain complete documents. Public and moderation requests start together; each successful result renders independently even if the other request is slow or fails.

### Mounted React workloads

Three interleaved baseline/after pairs ran in the same native Chromium tab. The harness mounts the actual pages with Lingui, Query and deterministic API fixtures, including fresh JSON decoding. Each edit workload performs 30 separate `flushSync` updates. React Profiler records committed render duration; the React commit hook counts components actually executed, excluding skipped fibers carrying stale flags. These are development React measurements, not production paint, INP or deployment latency. Concurrent builds on this machine make deterministic work counts the stronger evidence.

| Actual mounted view/workload | Component executions before → after | Median React duration before → after | Median synchronous elapsed before → after |
| --- | --- | --- | --- |
| Mystery, 100 collection entries, title edits | MysteryField 7,320 → 120 | 138.1 → 50.8 ms | 207.8 → 61.0 ms |
| Book Club, 24 Mavens, invite nickname edits | MavenCard 720 → 0 | 48.7 → 8.3 ms | 82.8 → 13.8 ms |
| Theory, 80 notes/100 edges, new-note title edits | Tooltip 4,800 → 0 | 379.8 → 11.6 ms | 631.7 → 26.3 ms |
| Theory, same scene, 30 viewport zoom events | Tooltip 4,800 → 0 | 269.4 → 5.1 ms | 510.3 → 10.9 ms |
| Dark Conspiracy, first Void Clue edits | KeeperTextarea 330 → 30; root 30 → 0 | 9.2 → 0.2 ms | 14.5 → 1.7 ms |
| Book Club, 10 unchanged full-JSON refreshes | MavenCard 240 → 0 | 53.3 → 19.4 ms | Settling waits excluded from claims |

The Dark Conspiracy duration is close to timer resolution; the execution count is more informative. Theory tooltip counts include nested commits. Fresh-refresh runs disable background polling during mount so only the ten explicit refreshes count; responses still clone their complete JSON and all eleven initial/refresh API calls occur. Version-only changes, changed timestamps/names, membership, GM/nickname changes, removals and reordered members remain fresh.

The six Book Club panel navigations previously restarted seven overview reads and seven websocket connections including initial mount; they now require one overview read and one connection. Notes still fetch their separate note document. The Library fixture uses an artificial 80 ms delay per request: request start separation falls from roughly 87 ms to zero. This verifies removal of a request waterfall, not live backend latency. A mounted regression check holds moderation unresolved and verifies all 24 public cards render, then rejects moderation and verifies they remain visible.

Raw reproducible evidence is in [all-views](performance/2026-10-03/all-views/): `react-views.json`, `fresh-json-refresh.json` and `view-contracts.json` retain workload results and correctness assertions.

### Production route loading

`route-bundles-before.json` and `route-bundles-after.json` measure the built Vite static import closure of entry, App, English locale and each actual route. They exclude previous-route cache, conditional analytics/PDF imports and conditional editable sheets. This is decoded minified JS, not compressed transfer or a cold-network latency prediction. Native no-store production checks independently sampled three complete navigations per public route: sign-in fell from 622,934 to approximately 427 kB; anonymous sheet and Dark Conspiracy remain approximately 621 kB. Final exact route totals are in the committed JSON.

The biggest route savings come from removing the eager sheet from the common App chunk. Own-Maven navigation still downloads the editable sheet and is essentially unchanged. Keeping existing shared libraries avoids unnecessary splitting overhead; anonymous sheet/Dark bundle size is flat while their render workloads improve.

| Route closure | Before JS bytes | Final JS bytes |
| --- | ---: | ---: |
| `/` | 621,688 | 621,496 |
| `/dark-conspiracy` | 621,688 | 621,496 |
| `/sign-in` | 622,934 | 427,307 |
| `/auth/callback` | 622,701 | 426,504 |
| `/mysteries` | 638,428 | 480,804 |
| `/library` | 625,744 | 430,639 |
| `/book-clubs (list,overview,6panels)` | 658,116 | 518,478 |
| `/book-clubs/:id/mavens/:id (readonly)` | 625,064 | 439,195 |
| `/book-clubs/:id/mavens/:id (own)` | 625,064 | 625,707 |
| `/book-clubs/:id/mysteries/:id/theorize` | 647,588 | 524,875 |

### Coverage matrix

“Profiled” means the actual mounted page has a before/after workload above. “Smoke” means production UI correctness was checked against a disposable local migrated SQLite/Fastify backend. An audited small view has no claimed measured render improvement.

| Route or major view | Evidence and resulting work | Remaining scope / unchanged rationale |
| --- | --- | --- |
| `/`, unknown-route fallback; character tabs, recovery, reset/delete, dice, export | First-pass actual section Profiler and production persistence evidence retained; second-pass route closure measured | Already optimized in first pass; local-first synchronous persistence retained. PDF remains deferred. |
| `/dark-conspiracy`; all three pages, clue/check fields, trackers, import/export/reset | Profiled field editing, persisted remount contract, production three-page/17-textarea smoke | Independent field subscriptions implemented; scalar updates retain unrelated arrays. Backend read unchanged. |
| `/sign-in`; local sign-in and provider entry | Production route bytes measured; real local sign-in smoke | Small form audited; auth SDK/provider flow unchanged. No real external OAuth session attempted. |
| `/auth/callback` | Production closure measured; missing-code branch inspected | Cheap one-shot view unchanged; existing missing-code branch shows Redirecting. Provider exchange is audited, not live-tested. |
| `/mysteries`, club-filtered list, search/select, title/intro/metadata editor | Profiled 100-entry editor; production edit/save/manual-version restore smoke | Full private documents needed for immediate editing remain eagerly loaded. Save/version semantics retained. |
| Mystery locations, suspects, moments, normal/Void clues; add/remove, focus; publish/delete dialogs; manual versions/recovery | Cached collection subtrees; mounted location update + persisted draft contract; production full 20-clue document copy and manual-version restore | Dialogs audited; no useful independent optimization of small confirmations. |
| `/library`; approved list, copy and moderation panels/actions | Parallel independent fetches + summary payload benchmark; real 24-card browse, full-document copy and approve smoke | Pending moderation still receives full documents because reviewers use them. |
| `/book-clubs` list, creation/incoming invitation controls, club picker | Route closure; source audit; production fixture includes three clubs | Small list/control views retain existing behavior; no separately claimed list render gain. |
| `/book-clubs/:id` overview; card summaries, invite station, quick navigator, scenery | Profiled edits and fresh-JSON refreshes; production seven visible Mavens, deleted sheet excluded | Member identities preserved only inside the matching club/member; club metadata remains incoming. |
| Book Club Mystery panel | Native production active-mystery mount; six-panel lifecycle workload | Existing active-clue data uses club response; no extra reads introduced. |
| Book Club Rolls panel, dice/options/history | Native production custom 2d6/history mount; lifecycle workload | First-pass indexed capped history read retained. Actual roll write not benchmarked. |
| Book Club Characters panel, save/assignment controls | Native production mount + own/shared Maven navigation | Selection/autosave correctness retained from first pass. |
| Book Club Settings panel, GM/member/owner controls | Native production owner/GM/member mount; helper metadata tests | Changed permission and nickname data invalidates affected member cards. |
| Book Club Notes panel, shared/private editors | Native production shared/private save; lifecycle workload retains one notes fetch | Existing note conflict/version protocol remains intact. |
| Book Club Clues panel, current clues/canvas | Native production drawer mount; lifecycle workload | Board scene is optimized separately. |
| `/book-clubs/:id/mavens/:id`, shared read-only and own editable sheet | Production first-use smoke: 12 read-only sections/no inputs and own editable 17 inputs; separate route closures | Own editing lazily loads full sheet; shared route avoids it. No claim of faster own-sheet total download. |
| `/book-clubs/:id/mysteries/:id/theorize`, visibility/filter/viewport | Profiled zoom and dialog edits; mounted filter 80→40 contract; real 30 auto-clue-node board | Pan/zoom transforms remain current outside cached scene. |
| Theory note/clue cards, hover descriptions, drag, connect, inline edge editor; create/edit/tag/layout dialogs | Cached scene dependencies audited; production create-note action adds 31st node | Node/edge/hover/drag/connect changes invalidate scene; expensive drag/layout remains intentional work. Not every dialog action has a separate benchmark. |
| Main/profile/locale/settings menus, credits and confirmations | Source audit; macro contexts retained, locale included in cached Theory dependencies | Small occasional views unchanged; no standalone timing claim. |

### Backend paths supporting all views

The fixture benchmark runs the real authenticated Fastify routes against a migrated disposable database, with five warmups and 30 measured injections per path. It verifies response statuses, approved/private scoping, deleted-character filtering and unique theory clue nodes. It includes three clubs/eight members, 28 private mysteries, 24 approved and four pending library documents with 100 entries each, 100 rolls per club and a Dark Conspiracy document. It never opens production data. `backend-pages.json` and `backend-pages-after.json` retain timings and response bytes.

| Read path | Baseline median / bytes | Final median / bytes | Decision |
| --- | --- | --- | --- |
| Private mysteries | 1.553 ms / 447,827 | 1.556 ms / 447,827 | Full documents support immediate editor selection; unchanged. |
| Full approved Library API | 1.285 ms / 383,131 | 1.314 ms / 383,131 | Compatible full response retained. |
| Approved summary consumed by Library | Full response above | 0.173 ms / 3,355 | 99.1% fewer response bytes; SQL projects only fields/cards need, copy still fetches full snapshot. |
| Pending moderation | 0.370 ms / 63,943 | 0.369 ms / 63,943 | Reviewer needs full documents; unchanged. |
| Dark Conspiracy | 0.067 ms / 797 | 0.061 ms / 797 | Already a tiny one-document read; no backend edit justified. |
| Three-club overview | 1.633 ms / 111,910 | 1.566 ms / 111,910 | First-pass indexed bounded queries retained; no new backend claim. |
| Notes | 0.098 ms / 74 | 0.091 ms / 74 | Tiny isolated read, version protocol retained. |
| Theory, 30 ensured clue nodes | 0.340 ms / 10,978 | 0.339 ms / 10,978 | Ensure/read consistency retained; measured cost did not justify changing write-on-read semantics. |

The summary/full comparison uses the same final backend fixture. Timing is Fastify injection latency, excluding network, browser decoding and paint. Mystery/Library serialization was audited; only Library has a compatible summary consumer that avoids loading documents the visible cards never use.

### Reproduction and verification

Run `pnpm --dir backend exec tsx benchmarks/views.ts`; set `BENCHMARK_REF=7b88cb2` for the historical backend. `BENCHMARK_SERVE=3313` starts the same disposable auth/API fixture for browser smoke. To run the mounted harness, serve `frontend` with `pnpm exec vite --config benchmarks/vite.config.ts --host 127.0.0.1 --port 5343 --strictPort`, open `/benchmarks/views.html`, await `document.body.dataset.ready === 'true'`, and call `runViewBenchmark(view, workload)` for `mysteries`, `clubs`, `theory` or `dark`; Theory viewport uses workload `pan`. Call `runFreshOverviewBenchmark()`, `runPanelNavigationBenchmark()` and `checkViewContracts()` for refresh/navigation/correctness evidence. Use the same harness copied to archived baseline frontend, same dependencies, a distinct Vite cache/port, and alternate baseline/after runs. Real OAuth/websocket transports are replaced only in the lifecycle fixture, explicitly separate from production smoke.

Build with `VITE_API_URL=http://127.0.0.1:3313 pnpm --dir frontend build`; then `VITE_API_URL=http://127.0.0.1:3313 pnpm --dir frontend exec vite build --manifest` and run `node frontend/benchmarks/route-bundles.mjs frontend/dist` for static closure metrics. Production smoke runs the built app against the local disposable API, including real keyboard edits, saved notes, full-document copy, approval and revision restore. Screenshots cover Library, Mystery editor, Book Club overview, Theory and Dark Conspiracy; artifact paths are retained in `production-smoke.json`.

Repository formatting, lint, frontend/backend TypeScript checks, store checks and backend tests are required before commit. The new pure-helper tests cover full JSON sharing, version-only edits, fresh role/nickname/club metadata, deletion, reassignment and ordering. Mounted Library regressions cover unresolved/rejected moderation. Independent review identified and corrected the moderation failure/waterfall regression; review also checks scene invalidation, lazy-route boundaries and fresh response semantics. No visual design or user-facing strings changed.
