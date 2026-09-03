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
    abilities: [
      { name: "Vitality", value: 0 },
      { name: "Composure", value: 1 },
      { name: "Reason", value: 1 },
      { name: "Presence", value: 0 },
      { name: "Sensitivity", value: -1 },
    ],
    xp: 0,
    conditions: "",
    endOfSessionChecks: [false, false, false, false, false, false, false],
    advancementChecks: [false, false, false, false, false],
    mavenMoves: "",
    crownChecks: [false, false, false, false, false, false, false],
    voidChecks: [false, false, false, false, false],
    cozyItems: Array.from({ length: 12 }, () => ({ checked: false, text: "" })),
  });
});

test("character updates require a positive integer version", () => {
  for (const version of [0, -1, 1.5]) {
    assert.equal(updateCharacterSchema.safeParse({ version }).success, false);
  }

  assert.equal(updateCharacterSchema.safeParse({ version: 2 }).success, true);
});

test("character data rejects malformed collection lengths", () => {
  const malformedData = {
    abilities: [],
    endOfSessionChecks: [],
    advancementChecks: [],
    crownChecks: [],
    voidChecks: [],
    cozyItems: [],
  };

  assert.equal(createCharacterSchema.safeParse({ name: "Mavis", data: malformedData }).success, false);
});
