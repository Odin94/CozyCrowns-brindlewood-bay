import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeCharacter,
  toPersistedCharacter,
} from "../../frontend/src/lib/character_document.ts";
import { characterDataSchema } from "../src/schema/character.ts";
import { createCharacterStorage } from "../../frontend/src/lib/character_storage.ts";
import { reconcileSourceClues, sourceClues } from "../src/lib/sourceClues.ts";

const memoryStorage = (): Storage => {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    clear: () => data.clear(),
  };
};
const key = "cozycrowns-character-storage";
const initial = {
  version: 2,
  state: {
    selectedCharacterId: "a",
    characters: [{ localId: "a", name: "Maven", conditions: "old", id: "remote" }],
  },
};
const read = (adapter: ReturnType<typeof createCharacterStorage>) =>
  JSON.parse(adapter.getItem(key) as string) as typeof initial;

test("short, reordered and localized abilities normalize to five safe slots shared with server", () => {
  const partial = normalizeCharacter({ abilities: [{ name: "Reason", value: 2 }] });
  assert.equal(partial.abilities.length, 5);
  assert.deepEqual(partial.abilities[2], { name: "Reason", value: 2 });
  assert.equal(characterDataSchema.safeParse(toPersistedCharacter(partial)).success, true);
  assert.equal(
    characterDataSchema.safeParse({ abilities: [{ name: "Reason", value: 2 }] }).success,
    false,
  );
  const localized = normalizeCharacter({
    abilities: Array.from({ length: 5 }, (_, index) => ({
      name: `translated${index}`,
      value: index - 2,
    })),
  });
  assert.deepEqual(
    localized.abilities.map((ability) => ability.value),
    [-2, -1, 0, 1, 2],
  );
  assert.equal(
    normalizeCharacter({ abilities: [{ name: "Reason", value: NaN }] }).abilities[2].value,
    1,
  );
});

test("independent stale tab writes and simultaneous conflicts survive durable reload", () => {
  const storage = memoryStorage();
  storage.setItem(key, JSON.stringify(initial));
  const a = createCharacterStorage(storage),
    b = createCharacterStorage(storage);
  const first = read(a),
    second = read(b);
  first.state.characters[0].conditions = "private notes";
  second.state.characters[0].name = "Renamed";
  a.setItem(key, JSON.stringify(first));
  b.setItem(key, JSON.stringify(second));
  const restored = read(createCharacterStorage(storage));
  assert.equal(restored.state.characters[0].conditions, "private notes");
  assert.equal(restored.state.characters[0].name, "Renamed");
  const c = createCharacterStorage(storage),
    d = createCharacterStorage(storage);
  const third = read(c),
    fourth = read(d);
  third.state.characters[0].name = "C";
  fourth.state.characters[0].name = "D";
  c.setItem(key, JSON.stringify(third));
  d.setItem(key, JSON.stringify(fourth));
  const conflicted = read(createCharacterStorage(storage));
  assert.ok(conflicted.state.characters.some((record) => record.name === "C"));
  assert.ok(conflicted.state.characters.some((record) => record.name === "D"));
  const recovery = conflicted.state.characters.find((record) =>
    record.localId.includes(":recovery:"),
  )!;
  assert.equal(recovery.id, undefined);
});

test("deletion plus a stale edit retains a recovery without restoring server identity", () => {
  const storage = memoryStorage();
  storage.setItem(key, JSON.stringify(initial));
  const a = createCharacterStorage(storage),
    b = createCharacterStorage(storage);
  const first = read(a),
    second = read(b);
  first.state.characters = [];
  a.setItem(key, JSON.stringify(first));
  second.state.characters[0].name = "Late edit";
  b.setItem(key, JSON.stringify(second));
  const restored = read(createCharacterStorage(storage));
  assert.equal(
    restored.state.characters.some((record) => record.localId === "a"),
    false,
  );
  assert.equal(
    restored.state.characters.find((record) => record.name === "Late edit")?.id,
    undefined,
  );
});

test("malformed journals cannot prevent hydration and one writer stays bounded over edits", () => {
  const storage = memoryStorage();
  storage.setItem(key, JSON.stringify(initial));
  storage.setItem(
    `${key}:writer:broken`,
    JSON.stringify({ version: 2, selectedCharacterId: "a", records: null }),
  );
  const a = createCharacterStorage(storage);
  const document = read(a);
  for (let i = 0; i < 100; i++) {
    document.state.characters[0].name = `Edit ${i}`;
    a.setItem(key, JSON.stringify(document));
  }
  assert.equal(storage.length, 3);
  assert.equal(read(createCharacterStorage(storage)).state.characters[0].name, "Edit 99");
});

test("old source links, including duplicate descriptions, keep stable board identity on correction", () => {
  const old = sourceClues({
    clues: [
      { id: "sourceA", title: "Letter", description: "old" },
      { id: "sourceB", title: "Letter", description: "old" },
    ],
    voidClues: [],
  });
  const existing = old.map((entry, index) => ({
    id: `club${index}`,
    text: entry.text,
    isVoid: false,
    sourceClueId: null,
    checked: true,
  }));
  const revised = old.map((entry, index) =>
    index === 0 ? { ...entry, text: "Letter — corrected" } : entry,
  );
  const result = reconcileSourceClues(existing, old, revised);
  assert.equal(result.inserts.length, 0);
  assert.deepEqual(
    result.updates.map((entry) => entry.id),
    ["club0", "club1"],
  );
  assert.equal(result.updates[0].checked, true);
  assert.equal(result.updates[0].sourceClueId, "sourceA");
  const removed = reconcileSourceClues(result.updates, revised, []);
  assert.equal(removed.retained.length, 2);
});

test("checkpoint compaction retains conflicts and late deletion edits from stale writers", async () => {
  const storage = memoryStorage();
  storage.setItem(key, JSON.stringify(initial));
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { locks: { request: async (_name: string, callback: () => void) => callback() } },
  });
  try {
    const stale = createCharacterStorage(storage),
      staleDocument = read(stale);
    for (let i = 0; i < 8; i++) {
      const writer = createCharacterStorage(storage),
        current = read(writer);
      current.state.characters[0].name = `Current ${i}`;
      writer.setItem(key, JSON.stringify(current));
    }
    await Promise.resolve();
    assert.ok(storage.length < 8);
    staleDocument.state.characters[0].name = "Stale conflicting edit";
    stale.setItem(key, JSON.stringify(staleDocument));
    const restored = read(createCharacterStorage(storage));
    assert.ok(restored.state.characters.some((record) => record.name === "Current 7"));
    assert.ok(restored.state.characters.some((record) => record.name === "Stale conflicting edit"));
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});
