import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";

const cache = mkdtempSync(join(tmpdir(), "cozy-auth-regressions-"));
const server = await createServer({
  cacheDir: cache,
  logLevel: "error",
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});
const values = new Map();
const originalFetch = globalThis.fetch;
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
const response = (token) =>
  new Response(JSON.stringify({ success: true, logoutUrl: null }), {
    headers: { "Content-Type": "application/json", ...(token ? { "X-New-Token": token } : {}) },
  });
try {
  const { api, tokenStorage } = await server.ssrLoadModule("/src/utils/api.ts");
  for (const status of [200, 503]) {
    tokenStorage.set("A");
    let release;
    globalThis.fetch = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    const pending = api.logout();
    const rejected = assert.rejects(pending, { status: 409 });
    tokenStorage.set("B");
    release(new Response(JSON.stringify({ success: true }), { status }));
    // eslint-disable-next-line no-await-in-loop -- Each case replaces the shared browser session.
    await rejected;
    assert.equal(tokenStorage.get(), "B");
  }
  tokenStorage.set("A");
  const epoch = tokenStorage.sessionKey();
  globalThis.fetch = async () => response("A-renewed");
  await api.deleteCharacter("cloud");
  assert.equal(tokenStorage.get(), "A-renewed");
  assert.equal(tokenStorage.sessionKey(), epoch);
  let release;
  globalThis.fetch = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const stale = api.deleteCharacter("cloud");
  tokenStorage.set("B");
  release(response("stale-A"));
  await stale;
  assert.equal(tokenStorage.get(), "B");
  globalThis.fetch = async () => response();
  const completed = await api.logout();
  assert.equal(tokenStorage.get(), null);
  assert.equal(completed.sessionEpoch, tokenStorage.sessionKey());
  console.log("Actual API logout and captured-request renewal regressions passed");
} finally {
  globalThis.fetch = originalFetch;
  await server.close();
  rmSync(cache, { recursive: true, force: true });
}
