import { createTokenStorage } from "../../frontend/src/lib/auth_token.ts";
import assert from "node:assert/strict";
import test from "node:test";
import {
  createCharacterStorage,
  MAX_RECOVERABLE_CHARACTERS,
} from "../../frontend/src/lib/character_storage.ts";
import { createCharacterCoordinator } from "../../frontend/src/lib/character_sync.ts";
import {
  loadMysteryDrafts,
  persistMysteryDraft,
  recoverMysteryDraft,
  completeMysteryRecovery,
} from "../../frontend/src/lib/mystery_drafts.ts";
import { normalizeCharacter } from "../../frontend/src/lib/character_document.ts";
import {
  sourceClues,
  readSourceClueIds,
  normalizeSourceClueIds,
  reconcileSourceClues,
} from "../src/lib/sourceClues.ts";
import type { Mystery } from "../../frontend/src/utils/api.ts";
const memory = (): Storage => {
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
const mystery = (id = "mystery", version = 1, title = "Draft"): Mystery => ({
  id,
  version,
  title,
  createdAt: "2026-10-03",
  updatedAt: "2026-10-03",
  data: {
    schemaVersion: 1,
    title,
    intro: "UNSAVED PRIVATE TEXT",
    complexity: 6,
    locations: [],
    suspects: [],
    clues: [],
    voidClues: [],
    moments: [],
    establishingQuestions: [],
  },
});

test("legacy source deletions and category changes never transfer discovery to another entry", () => {
  const old = {
    clues: [
      { title: "Letter", description: "found" },
      { title: "Key", description: "not found" },
    ],
    voidClues: [],
  };
  const before = sourceClues(old);
  const rows = before.map((clue, index) => ({ ...clue, id: `club${index}`, checked: index === 0 }));
  const normalized = normalizeSourceClueIds({ clues: [old.clues[1]], voidClues: [] }, old);
  const result = reconcileSourceClues(rows, before, sourceClues(normalized));
  assert.equal(result.updates[0].id, "club1");
  assert.equal(result.updates[0].checked, false);
  assert.equal(result.retained[0].id, "club0");
  const changed = reconcileSourceClues(rows, before, [{ ...before[0], isVoid: true }]);
  assert.equal(changed.updates[0].id, "club0");
  assert.equal(changed.updates[0].checked, true);
  assert.equal(changed.updates[0].isVoid, true);
  const duplicate = { clues: [old.clues[0], old.clues[0]], voidClues: [] };
  const reduced = normalizeSourceClueIds({ clues: [old.clues[0]], voidClues: [] }, duplicate);
  assert.ok(!sourceClues(duplicate).some((clue) => clue.sourceClueId === reduced.clues[0].id));
});

test("failed mystery recovery remains owner-scoped, retryable and idempotent", async () => {
  const storage = memory();
  const draft = { ownerId: "A", mystery: mystery(), baseContent: "saved", baseVersion: 1 };
  persistMysteryDraft(storage, draft);
  let calls = 0;
  const failure = async () => {
    calls++;
    throw new Error("503");
  };
  await assert.rejects(recoverMysteryDraft(storage, "A", draft, "Recovered", failure));
  const resumed = loadMysteryDrafts(storage, "A", new Set()).drafts[0];
  assert.equal(resumed.mystery.data.intro, "UNSAVED PRIVATE TEXT");
  assert.ok(resumed.recoveryId);
  assert.equal(loadMysteryDrafts(storage, "B", new Set()).drafts.length, 0);
  await assert.rejects(recoverMysteryDraft(storage, "B", resumed, "Recovered", failure));
  assert.equal(calls, 1);
  let release!: (value: Mystery) => void;
  const pending = new Promise<Mystery>((resolve) => {
    release = resolve;
  });
  const create = async () => {
    calls++;
    return pending;
  };
  const first = recoverMysteryDraft(storage, "A", resumed, "Recovered", create),
    second = recoverMysteryDraft(storage, "A", resumed, "Recovered", create);
  release(mystery("recovered", 1, "Recovered"));
  const recovered = await first;
  await second;
  assert.equal(calls, 2);
  completeMysteryRecovery(storage, "A", resumed, recovered);
  assert.equal(
    loadMysteryDrafts(storage, "A", new Set(["recovered"])).selected?.mystery.id,
    "recovered",
  );
  storage.setItem("cozycrowns-mystery-draft", JSON.stringify(mystery("foreign")));
  assert.equal(loadMysteryDrafts(storage, "B", new Set()).drafts.length, 0);
});

test("a failed recovery draft survives viewing and persisting its canonical copy", () => {
  const storage = memory(),
    dirty = mystery();
  persistMysteryDraft(storage, {
    ownerId: "A",
    mystery: dirty,
    baseContent: "old",
    baseVersion: 1,
  });
  const canonical = mystery("mystery", 2, "Canonical");
  canonical.data.intro = "SERVER";
  persistMysteryDraft(storage, {
    ownerId: "A",
    mystery: canonical,
    baseContent: JSON.stringify({ title: canonical.title, data: canonical.data }),
    baseVersion: 2,
  });
  assert.equal(
    loadMysteryDrafts(storage, "A", new Set(["mystery"])).drafts[0].mystery.data.intro,
    "UNSAVED PRIVATE TEXT",
  );
});

test("deletion waits for cloud creation and retries an orphan cleanup without resurrection", async () => {
  const storage = memory();
  let record = {
    ...normalizeCharacter({ name: "Maven" }),
    localId: "a",
    creationId: crypto.randomUUID(),
  } as ReturnType<typeof normalizeCharacter> & {
    localId: string;
    creationId: string;
    id?: string;
    version?: number;
  };
  let release!: (result: { id: string; version: number }) => void;
  const pending = new Promise<{ id: string; version: number }>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const createStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const calls: string[] = [];
  let fail = true;
  const coordinator = createCharacterCoordinator({
    storage,
    record: () => record,
    creationId: () => record?.creationId,
    acknowledge: (_localId, id, version) => {
      if (record) record = { ...record, id, version };
    },
    remove: () => {
      record = undefined as never;
    },
    create: async () => {
      calls.push("create");
      started();
      return pending;
    },
    update: async () => {
      throw Error("unexpected");
    },
    delete: async (id) => {
      calls.push(`delete:${id}`);
      if (fail) throw Error("503");
    },
  });
  const saving = coordinator.save("A", "a", { name: "Maven", data: record }, () => true);
  await createStarted;
  const deleting = coordinator.delete("A", "a");
  release({ id: "remote", version: 1 });
  await saving;
  await assert.rejects(deleting);
  assert.ok(record);
  assert.equal(coordinator.pending("A")[0].remoteId, "remote");
  fail = false;
  await coordinator.delete("A", "a");
  assert.equal(record, undefined);
  assert.equal(coordinator.pending("A").length, 0);
  assert.deepEqual(calls, ["create", "delete:remote", "delete:remote"]);
});

test("corrupt checkpoints cannot hide valid journal drafts", () => {
  const storage = memory(),
    key = "cozycrowns-character-storage";
  storage.setItem(key, "{broken");
  storage.setItem(
    `${key}:writer:valid`,
    JSON.stringify({
      version: 2,
      selectedCharacterId: "a",
      records: {
        a: { name: { clock: 1, value: "Recovered" }, conditions: { clock: 2, value: "Private" } },
      },
    }),
  );
  const restored = JSON.parse(createCharacterStorage(storage).getItem(key) as string);
  assert.equal(restored.state.characters[0].name, "Recovered");
  assert.equal(restored.state.characters[0].conditions, "Private");
  assert.equal(storage.getItem(`${key}:corrupt-checkpoint`), "{broken");
});

test("compaction bounds recoverable deleted payloads and retains tombstones for full late-edit recovery", async () => {
  const storage = memory(),
    key = "cozycrowns-character-storage";
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { locks: { request: async (_name: string, task: () => void) => task() } },
  });
  try {
    storage.setItem(
      key,
      JSON.stringify({
        version: 2,
        state: {
          characters: [{ localId: "initial", name: "Old", conditions: "old notes" }],
          selectedCharacterId: "initial",
        },
      }),
    );
    const stale = createCharacterStorage(storage),
      old = JSON.parse(stale.getItem(key) as string);
    const writer = createCharacterStorage(storage);
    writer.getItem(key);
    for (let index = 0; index < 30; index++) {
      const record = { localId: `a${index}`, name: `Name${index}`, conditions: `PRIVATE-${index}` };
      writer.setItem(
        key,
        JSON.stringify({
          version: 2,
          state: { characters: [record], selectedCharacterId: record.localId },
        }),
      );
      await Promise.resolve();
    }
    const restored = JSON.parse(createCharacterStorage(storage).getItem(key) as string);
    assert.ok(restored.state.archivedCharacters.length <= MAX_RECOVERABLE_CHARACTERS);
    assert.equal(restored.deletedRecords.initial, undefined);
    assert.ok(restored.tombstones.initial !== undefined);
    assert.ok(!storage.getItem(key)!.includes("old notes"));
    old.state.characters[0].name = "Late full draft";
    stale.setItem(key, JSON.stringify(old));
    const late = JSON.parse(
      createCharacterStorage(storage).getItem(key) as string,
    ).state.characters.find((record: { name: string }) => record.name === "Late full draft");
    assert.equal(late.conditions, "old notes");
    assert.equal(late.id, undefined);
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});

test("an obsolete account cannot delete or acknowledge a late cloud create", async () => {
  const storage = memory();
  let record = {
    ...normalizeCharacter({ name: "Maven" }),
    localId: "a",
    creationId: crypto.randomUUID(),
  };
  let started!: () => void, release!: (result: { id: string; version: number }) => void;
  const createStarted = new Promise<void>((resolve) => {
      started = resolve;
    }),
    pending = new Promise<{ id: string; version: number }>((resolve) => {
      release = resolve;
    });
  const deletions: string[] = [];
  let acknowledgements = 0;
  const coordinator = createCharacterCoordinator({
    storage,
    record: () => record,
    creationId: () => record.creationId,
    acknowledge: () => {
      acknowledgements++;
    },
    remove: () => {
      record = undefined as never;
    },
    create: async () => {
      started();
      return pending;
    },
    update: async () => {
      throw Error("unexpected");
    },
    delete: async (id) => {
      deletions.push(id);
    },
  });
  coordinator.setOwner("A");
  const saving = coordinator.save("A", "a", { name: "Maven", data: record }, () => true);
  await createStarted;
  const deleting = coordinator.delete("A", "a");
  coordinator.setOwner("B");
  release({ id: "remote-A", version: 1 });
  assert.equal(await saving, false);
  await assert.rejects(deleting);
  assert.equal(acknowledgements, 0);
  assert.deepEqual(deletions, []);
  assert.equal(coordinator.pending("A")[0].remoteId, "remote-A");
  coordinator.setOwner("A");
  await coordinator.retryPending("A");
  assert.deepEqual(deletions, ["remote-A"]);
  assert.equal(coordinator.pending("A").length, 0);
});

test("idempotent create retries confirm the accepted payload before saving newer local edits", async () => {
  const storage = memory();
  let record = {
    ...normalizeCharacter({ name: "Maven", conditions: "NEW" }),
    localId: "a",
    creationId: crypto.randomUUID(),
    version: undefined as number | undefined,
    id: undefined as string | undefined,
  };
  const baselines: string[] = [];
  const coordinator = createCharacterCoordinator({
    storage,
    record: () => record,
    creationId: () => record.creationId,
    acknowledge: (_local, id, version, content) => {
      record = { ...record, id, version };
      baselines.push(content);
    },
    remove: () => {},
    create: async () => ({
      id: "remote",
      version: 1,
      data: normalizeCharacter({ name: "Maven", conditions: "OLD" }),
    }),
    update: async (id, payload) => ({ id, version: 2, data: payload.data }),
    delete: async () => {},
  });
  await coordinator.save("A", "a", { name: "Maven", data: record }, () => true);
  assert.equal(JSON.parse(baselines[0]).conditions, "OLD");
  assert.equal(JSON.parse(baselines[1]).conditions, "NEW");
  assert.equal(record.version, 2);
});

test("duplicated session storage never shares writer keys before a handshake", () => {
  const storage = memory();
  const first = createCharacterStorage(storage);
  const second = createCharacterStorage(storage);
  const initial = {
    version: 2,
    state: {
      characters: [{ localId: "a", name: "Original", conditions: "" }],
      selectedCharacterId: "a",
    },
  };
  storage.setItem("characters", JSON.stringify(initial));
  first.getItem("characters");
  second.getItem("characters");
  first.setItem(
    "characters",
    JSON.stringify({
      ...initial,
      state: {
        ...initial.state,
        characters: [{ ...initial.state.characters[0], name: "First tab" }],
      },
    }),
  );
  second.setItem(
    "characters",
    JSON.stringify({
      ...initial,
      state: {
        ...initial.state,
        characters: [{ ...initial.state.characters[0], conditions: "Second tab" }],
      },
    }),
  );
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (key) => key?.startsWith("characters:writer:"),
  );
  assert.equal(keys.length, 2);
  const merged = JSON.parse(first.getItem("characters") as string).state.characters[0];
  assert.equal(merged.name, "First tab");
  assert.equal(merged.conditions, "Second tab");
});

test("quota failures preserve local edits through another tab's external hydration", () => {
  const storage = memory();
  let failWrites = false;
  const localStorage = {
    ...storage,
    get length() {
      return storage.length;
    },
    setItem: (key: string, value: string) => {
      if (failWrites && key.includes(":writer:")) throw Error("Quota exceeded");
      storage.setItem(key, value);
    },
  };
  const first = createCharacterStorage(localStorage),
    second = createCharacterStorage(storage);
  const initial = {
    version: 2,
    state: {
      characters: [{ localId: "a", name: "Original", conditions: "" }],
      selectedCharacterId: "a",
    },
  };
  storage.setItem("characters", JSON.stringify(initial));
  first.getItem("characters");
  second.getItem("characters");
  failWrites = true;
  first.setItem(
    "characters",
    JSON.stringify({
      ...initial,
      state: {
        ...initial.state,
        characters: [{ ...initial.state.characters[0], name: "UNSAVED" }],
      },
    }),
  );
  second.setItem(
    "characters",
    JSON.stringify({
      ...initial,
      state: {
        ...initial.state,
        characters: [{ ...initial.state.characters[0], conditions: "OTHER TAB" }],
      },
    }),
  );
  const hydrated = JSON.parse(first.getItem("characters") as string);
  assert.equal(hydrated.state.characters[0].name, "UNSAVED");
  assert.equal(hydrated.state.characters[0].conditions, "OTHER TAB");
  failWrites = false;
  first.setItem("characters", JSON.stringify(hydrated));
  const reloaded = JSON.parse(createCharacterStorage(storage).getItem("characters") as string);
  assert.equal(reloaded.state.characters[0].name, "UNSAVED");
  assert.equal(reloaded.state.characters[0].conditions, "OTHER TAB");
});

test("late recovery completion preserves newer edits to its source document", async () => {
  const storage = memory();
  const original = { ownerId: "A", mystery: mystery(), baseContent: "old" };
  persistMysteryDraft(storage, original);
  let release!: (value: Mystery) => void;
  const pending = new Promise<Mystery>((resolve) => {
    release = resolve;
  });
  const recovery = recoverMysteryDraft(storage, "A", original, "Recovered", () => pending);
  const edited = {
    ...original,
    recoveryId: undefined,
    mystery: { ...original.mystery, data: { ...original.mystery.data, intro: "NEWER UNSAVED" } },
  };
  persistMysteryDraft(storage, edited);
  release(mystery("recovered", 1, "Recovered"));
  const recovered = await recovery;
  assert.equal(completeMysteryRecovery(storage, "A", original, recovered), false);
  const loaded = loadMysteryDrafts(storage, "A", new Set(["mystery", "recovered"]));
  assert.equal(loaded.selected?.mystery.data.intro, "NEWER UNSAVED");
  assert.equal(
    loaded.drafts.find((draft) => draft.mystery.id === "mystery")?.mystery.data.intro,
    "NEWER UNSAVED",
  );
  assert.ok(loaded.drafts.some((draft) => draft.mystery.id === "recovered"));
});

test("verified token renewal keeps queued mutations live and rejects stale session responses", async () => {
  const storage = memory(),
    tokens = createTokenStorage(storage);
  tokens.set("A");
  const firstEpoch = tokens.sessionKey();
  const record = {
    ...normalizeCharacter({ name: "Maven" }),
    localId: "a",
    id: "cloud",
    version: 1,
  };
  let removed = false;
  const coordinator = createCharacterCoordinator({
    storage,
    sessionKey: tokens.sessionKey,
    record: () => record,
    creationId: () => undefined,
    acknowledge: () => {},
    remove: () => {
      removed = true;
    },
    create: async () => {
      throw Error("unexpected");
    },
    update: async () => {
      throw Error("unexpected");
    },
    delete: async () => {
      assert.equal(tokens.rotate("A-renewed", "A", firstEpoch), true);
    },
  });
  coordinator.setOwner("A");
  await coordinator.delete("A", "a");
  assert.equal(removed, true);
  assert.equal(coordinator.pending("A").length, 0);
  assert.equal(tokens.sessionKey(), firstEpoch);
  tokens.set("B");
  assert.equal(tokens.rotate("stale-A", "A-renewed", firstEpoch), false);
  assert.equal(tokens.get(), "B");
  assert.notEqual(tokens.sessionKey(), firstEpoch);
});

test("a legacy clue's first text correction keeps its prior discovery identity", () => {
  const raw = { clues: [{ title: "Letter", description: "Old wording" }], voidClues: [] };
  const read = readSourceClueIds(raw);
  assert.deepEqual(readSourceClueIds(raw), read);
  const edited = { ...read, clues: [{ ...read.clues[0], description: "Corrected wording" }] };
  const existing = [
    {
      id: "club-clue",
      text: sourceClues(raw)[0].text,
      isVoid: false,
      sourceClueId: null,
      checked: true,
    },
  ];
  const reconciled = reconcileSourceClues(
    existing,
    sourceClues(raw),
    sourceClues(normalizeSourceClueIds(edited, raw)),
  );
  assert.equal(reconciled.inserts.length, 0);
  assert.equal(reconciled.retained.length, 0);
  assert.equal(reconciled.updates[0].id, "club-clue");
  assert.equal(reconciled.updates[0].checked, true);
});
