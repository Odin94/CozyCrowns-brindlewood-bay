import assert from "node:assert/strict";
import test from "node:test";
import { generateNickname } from "../src/utils/nickname.js";

test("generated nicknames use a lowercase adjective-animal format", () => {
  for (let index = 0; index < 25; index += 1) {
    const nickname = generateNickname();

    assert.match(nickname, /^[a-z]+-[a-z]+$/);
    assert.ok(nickname.length >= 3 && nickname.length <= 30);
  }
});
