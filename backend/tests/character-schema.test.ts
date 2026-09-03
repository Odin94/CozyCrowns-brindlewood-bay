import assert from "node:assert/strict";
import test from "node:test";
import { createCharacterSchema, updateCharacterSchema } from "../src/schema/character.js";

test("create character validation supplies safe defaults", () => {
  const character = createCharacterSchema.parse({ name: "Mavis", data: {} });

  assert.equal(character.version, 1);
  assert.deepEqual(character.data, {
    name: "",
    style: "",
    activity: "",
    abilities: [],
    xp: 0,
    conditions: "",
    endOfSessionChecks: [],
    advancementChecks: [],
    mavenMoves: "",
    crownChecks: [],
    voidChecks: [],
    cozyItems: [],
  });
});

test("character updates require a positive integer version", () => {
  for (const version of [0, -1, 1.5]) {
    assert.equal(updateCharacterSchema.safeParse({ version }).success, false);
  }

  assert.equal(updateCharacterSchema.safeParse({ version: 2 }).success, true);
});
