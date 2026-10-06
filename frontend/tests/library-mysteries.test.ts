import { test } from "node:test";
import assert from "node:assert/strict";
import { ownedMysteryLibrary } from "../src/lib/library_mysteries.ts";
import type { Mystery } from "../src/utils/api.ts";

const mystery = (id: string): Mystery => ({
  id,
  title: "Saved mystery",
  version: 4,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-02",
  data: {
    schemaVersion: 1,
    title: "Saved mystery",
    intro: "Saved introduction",
    complexity: 6,
    establishingQuestions: [],
    locations: [],
    suspects: [],
    clues: [],
    voidClues: [],
    moments: [],
  },
});
const storage = (entries: Record<string, unknown>) => ({
  getItem: (key: string) => (key in entries ? JSON.stringify(entries[key]) : null),
});

test("owned library displays unsaved local content while retaining canonical metadata", () => {
  const saved = mystery("private");
  const draft = {
    ...saved,
    title: "Local title",
    data: { ...saved.data, title: "Local title", intro: "Unsaved introduction" },
    version: 1,
  };
  const [card] = ownedMysteryLibrary(
    [saved],
    "alice",
    storage({ "cozycrowns-mystery-draft:alice:private": draft }),
  );
  assert.equal(card.title, "Local title");
  assert.equal(card.data.intro, "Unsaved introduction");
  assert.equal(card.version, saved.version);
});

test("owned library never adds unowned drafts or reads another account's drafts", () => {
  const saved = mystery("private");
  const draft = { ...saved, title: "Other account draft" };
  const cards = ownedMysteryLibrary(
    [saved],
    "alice",
    storage({
      "cozycrowns-mystery-draft:bob:private": draft,
      "cozycrowns-mystery-draft:alice:unowned": mystery("unowned"),
      "cozycrowns-mystery-draft": draft,
    }),
  );
  assert.deepEqual(cards, [saved]);
});

test("malformed or mismatched local drafts leave owned cards usable", () => {
  const saved = mystery("private");
  for (const draft of [
    { ...saved, id: "another-mystery" },
    { ...saved, data: { ...saved.data, locations: null } },
    { ...saved, title: null },
  ]) {
    assert.deepEqual(
      ownedMysteryLibrary(
        [saved],
        "alice",
        storage({ "cozycrowns-mystery-draft:alice:private": draft }),
      ),
      [saved],
    );
  }
  assert.deepEqual(ownedMysteryLibrary([saved], "alice", { getItem: () => "invalid json" }), [
    saved,
  ]);
  assert.deepEqual(
    ownedMysteryLibrary([saved], "alice", {
      getItem: () => {
        throw new Error("Storage blocked");
      },
    }),
    [saved],
  );
});
