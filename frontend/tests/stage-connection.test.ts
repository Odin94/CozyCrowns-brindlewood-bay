import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseStageConnection,
  readStageConnection,
  saveStageConnection,
} from "../src/lib/stage_connection.ts";
const cache = new Map<string, string>();
Object.defineProperty(globalThis, "sessionStorage", {
  value: {
    getItem: (key: string) => cache.get(key) ?? null,
    setItem: (key: string, value: string) => cache.set(key, value),
    removeItem: (key: string) => cache.delete(key),
  },
});
const params = (url: string, state = "a".repeat(64)) =>
  new URLSearchParams({ redirect_uri: url, state }).toString();
test("Stage handoff only accepts a nonce-bound native loopback receiver and expires across WorkOS redirects", () => {
  const valid = parseStageConnection(params("http://127.0.0.1:43123/cozycrowns/callback"), 1000)!;
  assert(valid);
  saveStageConnection(valid);
  assert.equal(readStageConnection(2000)?.state, valid.state);
  assert.equal(readStageConnection(181000), null);
  for (const url of [
    "https://evil.test/cozycrowns/callback",
    "http://localhost:43123/cozycrowns/callback",
    "http://127.0.0.1:80/cozycrowns/callback",
    "http://user:password@127.0.0.1:43123/cozycrowns/callback",
    "http://127.0.0.1:43123/cozycrowns/callback?token=bad",
    "http://127.0.0.1:43123/elsewhere",
  ])
    assert.equal(parseStageConnection(params(url)), null);
  assert.equal(
    parseStageConnection(params("http://127.0.0.1:43123/cozycrowns/callback", "invalid")),
    null,
  );
});
