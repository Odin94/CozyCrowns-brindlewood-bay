import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultCharacter,
  normalizeCharacter,
  toPersistedCharacter,
} from "../../frontend/src/lib/character_document.ts";

test("character document normalization provides one complete current shape", () => {
  const cases = [
    ["partial", { name: "Mavis" }],
    ["legacy empty collections", { crownChecks: [], voidChecks: [], cozyItems: [] }],
    ["valid values", { crownChecks: [true], voidChecks: [true], cozyItems: [{ checked: true, text: "Tea" }] }],
  ] as const;

  for (const [name, input] of cases) {
    const character = normalizeCharacter(input);
    assert.equal(character.schemaVersion, 1, name);
    assert.equal(character.crownChecks.length, 7, name);
    assert.equal(character.voidChecks.length, 5, name);
    assert.equal(character.cozyItems.length, 12, name);
  }
});

test("persisted characters omit format and record metadata", () => {
  const character = {
    ...createDefaultCharacter(),
    localId: "local-1",
    id: "remote-1",
    version: 4,
  };
  const persisted = toPersistedCharacter(character);

  assert.equal("schemaVersion" in persisted, false);
  assert.equal("localId" in persisted, false);
  assert.equal("id" in persisted, false);
  assert.equal("version" in persisted, false);
});
