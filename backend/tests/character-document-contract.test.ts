import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultCharacter,
  applyCharacterChange,
  normalizeCharacter,
  toPersistedCharacter,
} from "../../frontend/src/lib/character_document.ts";

test("character document normalization provides one complete current shape", () => {
  const cases = [
    ["partial", { name: "Mavis" }],
    ["legacy empty collections", { crownChecks: [], voidChecks: [], cozyItems: [] }],
    [
      "valid values",
      { crownChecks: [true], voidChecks: [true], cozyItems: [{ checked: true, text: "Tea" }] },
    ],
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

test("editing text preserves every unrelated collection reference", () => {
  const current = createDefaultCharacter();
  const next = applyCharacterChange(current, { name: "Mavis" });
  assert.equal(next.name, "Mavis");
  for (const field of [
    "abilities",
    "endOfSessionChecks",
    "advancementChecks",
    "crownChecks",
    "voidChecks",
    "cozyItems",
  ] as const) {
    assert.equal(next[field], current[field], field);
  }
  assert.equal(current.name, "");
});

test("partial edits normalize supplied collections and discard unknown fields", () => {
  const current = createDefaultCharacter();
  const next = applyCharacterChange(current, {
    crownChecks: [true],
    cozyItems: [{ checked: true, text: "Tea" }],
    unknown: "discarded",
  } as Partial<typeof current>);
  assert.equal(next.crownChecks.length, 7);
  assert.equal(next.crownChecks[0], true);
  assert.equal(next.cozyItems.length, 12);
  assert.deepEqual(next.cozyItems[0], { checked: true, text: "Tea" });
  assert.equal(next.voidChecks, current.voidChecks);
  assert.equal("unknown" in next, false);
  assert.equal(current.crownChecks[0], false);
  assert.equal(current.cozyItems[0].text, "");
});

test("a full imported document replaces fields while retaining normalization", () => {
  const current = applyCharacterChange(createDefaultCharacter(), { name: "Old name", xp: 5 });
  const imported = normalizeCharacter({ name: "Imported", crownChecks: [true] });
  const next = applyCharacterChange(current, imported);
  assert.deepEqual(next, imported);
  assert.notEqual(next.crownChecks, imported.crownChecks);
});
