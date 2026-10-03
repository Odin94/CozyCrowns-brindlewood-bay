import assert from "node:assert/strict";
import { createServer } from "vite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const cacheDir = mkdtempSync(join(tmpdir(), "cozy-review-tests-"));
const server = await createServer({
  cacheDir,
  logLevel: "error",
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
    removeItem: (key) => persisted.delete(key),
  };
  globalThis.window = { localStorage };
  const { useCharacterStore: store } = await server.ssrLoadModule("/src/lib/character_store.ts");
  const { CharacterDataSchema } = await server.ssrLoadModule("/src/types/characterSchema.ts");
  assert.equal(CharacterDataSchema.safeParse({}).success, false);
  assert.equal(
    CharacterDataSchema.safeParse({ abilities: [{ name: "Reason", value: 2 }] }).data.abilities
      .length,
    5,
  );
  const id = store.getState().selected().localId;
  store.getState().setName("Local Maven");
  store.getState().updateRemoteVersion(id, "remote", 1);
  store.getState().setConditions("UNSAVED PRIVATE EDIT");
  store.getState().mergeRemote([
    {
      id: "remote",
      version: 2,
      data: { ...store.getState().record(id), conditions: "REMOTE EDIT" },
    },
  ]);
  assert.equal(store.getState().record(id).conditions, "REMOTE EDIT");
  assert.equal(store.getState().selected().conditions, "UNSAVED PRIVATE EDIT");
  assert.equal(store.getState().selected().id, undefined);
  await store.persist.rehydrate();
  assert.equal(store.getState().selected().conditions, "UNSAVED PRIVATE EDIT");
  const count = store.getState().characters.length;
  store.getState().mergeRemote([
    {
      id: "remote",
      version: 3,
      data: { ...store.getState().record(id), conditions: "CLEAN REMOTE UPDATE" },
    },
  ]);
  assert.equal(store.getState().characters.length, count);
  const beforeImportId = store.getState().selected().localId;
  store.getState().create();
  store
    .getState()
    .updateSelected(
      CharacterDataSchema.parse({ name: "Imported", abilities: [{ name: "Reason", value: 1 }] }),
    );
  assert.equal(store.getState().record(beforeImportId).conditions, "UNSAVED PRIVATE EDIT");
  assert.equal(store.getState().selected().abilities.length, 5);
  const { useDarkConspiracyStore: dc, conspiracyContent } = await server.ssrLoadModule(
    "/src/lib/dark_conspiracy_store.ts",
  );
  dc.getState().updateCurrentDarkConspiracy({ firstVoidClue: "base" });
  const localId = dc.getState().current.localId;
  const submitted = conspiracyContent(dc.getState().current);
  dc.getState().updateCurrentDarkConspiracy({ firstVoidClue: "pending while request runs" });
  dc.getState().updateCurrentDarkConspiracyIdAndVersion("remote-dc", 1, localId, submitted);
  assert.notEqual(conspiracyContent(dc.getState().current), dc.getState().current.remoteContent);
  dc.getState().syncDarkConspiraciesFromBackend([
    { id: "remote-dc", version: 2, data: { ...dc.getState().current, firstVoidClue: "remote" } },
  ]);
  assert.ok(
    dc
      .getState()
      .darkConspiracies.some(
        (record) => record.firstVoidClue === "pending while request runs" && !record.id,
      ),
  );
  console.log(
    "Maven and conspiracy remote conflicts, confirmed baselines, safe import and hydration regressions passed",
  );
} finally {
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
}
