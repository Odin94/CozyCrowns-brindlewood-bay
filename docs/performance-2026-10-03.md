# Performance deep dive — 2026-10-03

Baseline: `0cb664be6f1bb835c82119b5a199ab161ba00fc7`.
Implementation: `bcc0b419d3ce0c591f52cfb2c3b11b86e446a727`.
Raw samples: [performance/2026-10-03](performance/2026-10-03).

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

The production typing samples use real keyboard events and a MutationObserver. Timing starts at `beforeinput` and ends when the displayed name changes; mutation count is measured to the next animation frame. The committed JSON stores all 13 samples for each build. These are local DOM commit measurements. Neither they nor the development `flushSync`/Profiler harness measure paint, INP or real-user latency. Cold network/FCP timing was not used as an improvement claim.

## Verification and remaining costs

Repository formatting, frontend/backend lint, both TypeScript builds and the test suite passed. Tests cover structural sharing, normalized partial edits, full imports, omitted local metadata, selected-Maven identity through remote updates, immediate persisted snapshots and rehydration. The production browser smoke test confirmed anonymous name and ability edits survive reload. No user-facing strings or styles changed.

The sheet still synchronously serializes local characters on every edit. That protects the local-first save contract; changing persistence scheduling would require separate durability design. Large Book Club responses still include full notes and clue lists; response reduction would need a compatible API/UI loading change. The 696 kB PDF chunk is already deferred to export. Measurements here establish reductions in actual work and local timings, not deployment-wide percentiles.
