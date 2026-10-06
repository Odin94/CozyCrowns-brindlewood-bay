import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createServer } from "vite";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Use Vite's actual alias and Lingui transforms, rather than a copied store.
let fixture;
if (process.env.BENCHMARK_REF) {
  fixture = mkdtempSync(join(tmpdir(), "cozycrowns-store-benchmark-"));
  const archive = execFileSync("git", ["archive", process.env.BENCHMARK_REF, "frontend"], {
    cwd: resolve(".."),
    maxBuffer: 20 * 1024 * 1024,
  });
  execFileSync("tar", ["-x", "-C", fixture], { input: archive });
  symlinkSync(resolve("node_modules"), join(fixture, "frontend/node_modules"), "dir");
}
const cacheDir = mkdtempSync(join(tmpdir(), "cozycrowns-store-vite-"));
const server = await createServer({
  logLevel: "error",
  cacheDir,
  root: fixture ? join(fixture, "frontend") : process.cwd(),
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { i18n } = await import("@lingui/core");
  i18n.load("en", {});
  i18n.activate("en");
  const persisted = new Map();
  globalThis.localStorage = {
    getItem: (key) => persisted.get(key) ?? null,
    setItem: (key, value) => persisted.set(key, value),
    removeItem: () => {},
  };
  globalThis.window = { localStorage: globalThis.localStorage };
  const { useCharacterStore: store } = await server.ssrLoadModule("/src/lib/character_store.ts");
  const fields = [
    "name",
    "style",
    "activity",
    "abilities",
    "xp",
    "conditions",
    "endOfSessionChecks",
    "advancementChecks",
    "mavenMoves",
    "crownChecks",
    "voidChecks",
    "cozyItems",
  ];
  let notifications = 0;
  let invalidations = 0;
  const unsubscribe = store.subscribe((next, previous) => {
    notifications++;
    for (const field of fields) {
      if (
        !Object.is(
          next.selected()[field],
          previous.characters.find((record) => record.localId === previous.selectedCharacterId)[
            field
          ],
        )
      )
        invalidations++;
    }
  });
  const samples = [];
  for (let sample = 0; sample < 8; sample++) {
    notifications = 0;
    invalidations = 0;
    const start = performance.now();
    for (let index = 0; index < 2000; index++) store.getState().setName(`Mavis ${sample}-${index}`);
    samples.push(performance.now() - start);
  }
  assert.equal(store.getState().selected().name, "Mavis 7-1999");
  unsubscribe();
  if (process.argv.includes("--check")) {
    const original = store.getState().selected();
    store.getState().setStyle("A cardigan");
    assert.equal(store.getState().selected().abilities, original.abilities);
    assert.equal(store.getState().selected().cozyItems, original.cozyItems);
    const secondId = store.getState().create();
    store.getState().setName("Second Maven");
    // A response for a previously selected Maven must update only that Maven.
    store.getState().updateRemoteVersion(original.localId, "remote-first", 3);
    assert.equal(store.getState().selected().localId, secondId);
    assert.equal(store.getState().selected().id, undefined);
    assert.equal(store.getState().record(original.localId).id, "remote-first");
    store
      .getState()
      .mergeRemote([{ id: "remote-first", version: 4, data: { name: "Remote Maven" } }]);
    assert.equal(store.getState().record(original.localId).localId, original.localId);
    assert.equal(store.getState().record(original.localId).name, "Remote Maven");
    assert.equal(store.getState().selected().name, "Second Maven");
    const saved = JSON.parse(persisted.get("cozycrowns-character-storage"));
    assert.equal(saved.state.selectedCharacterId, secondId);
    // No saved baseline was supplied above, so the divergent local sheet must
    // survive as its own Maven when a newer cloud version arrives.
    assert.equal(saved.state.characters.length, 3);
    const preserved = saved.state.characters.find(
      (record) => record.localId !== original.localId && record.localId !== secondId,
    );
    assert.equal(preserved.name, original.name);
    assert.equal(preserved.style, "A cardigan");
    assert.equal(preserved.id, undefined);
    assert.equal(preserved.version, undefined);
    await store.persist.rehydrate();
    assert.equal(store.getState().selected().localId, secondId);
    assert.equal(store.getState().selected().name, "Second Maven");
    assert.equal(store.getState().record(original.localId).version, 4);
    assert.equal(store.getState().record(preserved.localId).name, original.name);
    assert.equal(store.getState().record(preserved.localId).style, "A cardigan");
  }
  const sorted = samples.slice(1).toSorted((a, b) => a - b);
  console.log(
    JSON.stringify(
      {
        benchmark: "2000 real store name edits, in-memory storage sink",
        medianMs: sorted[3],
        notifications,
        fieldSelectorInvalidations: invalidations,
        samplesMs: samples,
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
  if (fixture) rmSync(fixture, { recursive: true, force: true });
}
