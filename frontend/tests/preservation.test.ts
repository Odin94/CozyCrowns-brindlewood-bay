import { test } from "node:test";
import assert from "node:assert/strict";
import { MavenPersistence, reconcileMavenRecords } from "../src/lib/maven_persistence.ts";
import { MysteryPreservation } from "../src/lib/mystery_preservation.ts";
import { createDefaultCharacter, toPersistedCharacter } from "../src/lib/character_document.ts";
import type { CharacterRecord } from "../src/lib/character_store.ts";
import type { Mystery, MysteryData } from "../src/utils/api.ts";
import type { AccountScope } from "../src/lib/account_scope.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function mavenFixture() {
  let scope: AccountScope = { accountId: "alice", generation: 1 };
  const records = new Map<string, CharacterRecord>([
    ["local", { ...createDefaultCharacter(), name: "Alice's Maven", localId: "local" }],
  ]);
  const calls: Array<{ id?: string; version: number; name: string }> = [];
  let remoteVersion = 0;
  let gate: ReturnType<typeof deferred<void>> | null = null;
  let fail = false;
  const remote = async (id: string | undefined, payload: { version: number; name: string }) => {
    calls.push({ id, version: payload.version, name: payload.name });
    if (gate) await gate.promise;
    if (fail) throw Object.assign(new Error("Conflict"), { status: 409 });
    return { id: id ?? "remote", version: ++remoteVersion };
  };
  const errors: unknown[] = [];
  const receipts = new Map<string, string>();
  const ports: ConstructorParameters<typeof MavenPersistence>[0] = {
    storage: {
      getItem: (key) => receipts.get(key) ?? null,
      setItem: (key, value) => {
        receipts.set(key, value);
      },
    },
    scope: () => scope,
    record: (id) => records.get(id),
    claim: (id, ownerId) => {
      const record = records.get(id)!;
      records.set(id, { ...record, ownerId });
    },
    acknowledge: (id, result, ownerId, syncedContent) => {
      records.set(id, { ...records.get(id)!, ...result, ownerId, syncedContent });
    },
    merge: () => {},
    list: async () => ({ characters: [] }),
    create: (payload) => remote(undefined, payload),
    update: remote,
    failed: (error) => errors.push(error),
  };
  const owner = new MavenPersistence(ports);
  return {
    owner,
    recreate: () => new MavenPersistence(ports),
    ports,
    records,
    calls,
    errors,
    revalidate: () => {
      scope = { ...scope, generation: scope.generation + 1, revalidating: true };
    },
    verify: () => {
      scope = { ...scope, revalidating: false };
    },
    changeAccount: (accountId: string | null) => {
      scope = { accountId, generation: scope.generation + 1 };
    },
    pause: () => {
      gate = deferred<void>();
      return gate;
    },
    fail: (value: boolean) => {
      fail = value;
    },
  };
}

test("Maven callers share creation and version ordering, preserving newer edits", async () => {
  const f = mavenFixture();
  const gate = f.pause();
  const autosave = f.owner.save("local");
  await tick();
  f.records.set("local", { ...f.records.get("local")!, name: "menu import pending" });
  const menuSave = f.owner.save("local");
  await tick();
  assert.equal(f.calls.length, 1);
  gate.resolve();
  assert.equal(await autosave, true);
  assert.equal(await menuSave, true);
  assert.deepEqual(
    f.calls.map(({ id, version }) => ({ id, version })),
    [
      { id: undefined, version: 1 },
      { id: "remote", version: 1 },
    ],
  );
  assert.equal(f.records.get("local")!.name, "menu import pending");
  assert.equal(f.records.get("local")!.version, 2);
});
test("Maven rejects old-account acknowledgements and queued work", async () => {
  const f = mavenFixture();
  const gate = f.pause();
  const first = f.owner.save("local");
  await tick();
  const queued = f.owner.save("local");
  f.changeAccount("bob");
  gate.resolve();
  assert.equal(await first, false);
  assert.equal(await queued, false);
  assert.equal(f.calls.length, 1);
  assert.equal(f.records.get("local")!.id, undefined);
  assert.equal(await f.owner.save("local"), false);
});
test("Maven imported document cannot inherit an in-flight remote identity", async () => {
  const f = mavenFixture();
  const gate = f.pause();
  const saved = f.owner.save("local");
  await tick();
  f.records.delete("local");
  f.records.set("import", { ...createDefaultCharacter(), name: "Imported", localId: "import" });
  gate.resolve();
  assert.equal(await saved, false);
  assert.equal(f.records.get("import")!.id, undefined);
});
test("Maven failure keeps local content and permits retry", async () => {
  const f = mavenFixture();
  f.fail(true);
  assert.equal(await f.owner.save("local"), false);
  assert.equal(f.records.get("local")!.name, "Alice's Maven");
  f.fail(false);
  assert.equal(await f.owner.save("local"), true);
  assert.equal(f.errors.length, 1);
});
test("Maven verifies legacy ids before writing instead of adopting another account's document", async () => {
  const f = mavenFixture();
  f.records.set("local", { ...f.records.get("local")!, id: "foreign", version: 2 });
  assert.equal(await f.owner.save("local"), false);
  assert.equal(f.calls.length, 0);
});

const data = (title = "Mystery"): MysteryData => ({
  schemaVersion: 1,
  title,
  intro: "",
  establishingQuestions: [],
  complexity: 6,
  locations: [],
  suspects: [],
  clues: [],
  voidClues: [],
  moments: [],
});
const mystery = (id = "one"): Mystery => ({
  id,
  title: "Mystery",
  data: data(),
  version: 1,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
});
function mysteryFixture(seed = [mystery()], storage = new Map<string, string>()) {
  let scope: AccountScope = { accountId: "alice", generation: 1 };
  let gate: ReturnType<typeof deferred<void>> | null = null;
  let deletionGate: ReturnType<typeof deferred<void>> | null = null;
  let fail = false;
  const rows = new Map(seed.map((row) => [row.id, row]));
  const deletedRows = new Map<string, Mystery>();
  const calls: Array<{ id: string; title: string; version: number; kind: string }> = [];
  const publications: Array<{ id: string; title: string }> = [];
  const timers = new Map<number, () => void>();
  let nextTimer = 0;
  const errors: unknown[] = [];
  const owner = new MysteryPreservation({
    scope: () => scope,
    storage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        storage.set(key, value);
      },
      removeItem: (key) => {
        storage.delete(key);
      },
    },
    remote: {
      getMysteries: async () => ({ mysteries: [...rows.values()] }),
      createMystery: async (input) => {
        const row = { ...mystery("created"), ...input };
        rows.set(row.id, row);
        return row;
      },
      updateMystery: async (id, input) => {
        calls.push({ id, title: input.title, version: input.version, kind: input.saveKind });
        if (gate) await gate.promise;
        if (fail || rows.get(id)!.version !== input.version)
          throw Object.assign(new Error("Conflict"), { status: 409 });
        const saved = {
          ...rows.get(id)!,
          title: input.title.trim(),
          data: structuredClone(input.data),
          version: input.version + 1,
          updatedAt: "2026-02-01",
        };
        rows.set(id, saved);
        return saved;
      },
      getMysteryVersions: async () => ({ versions: [] }),
      deleteMystery: async (id) => {
        if (deletionGate) await deletionGate.promise;
        deletedRows.set(id, rows.get(id)!);
        rows.delete(id);
      },
      restoreMystery: async (id) => {
        const row = deletedRows.get(id)!;
        rows.set(id, row);
        return row;
      },
      publishMystery: async (id) => {
        publications.push({ id, title: rows.get(id)!.title });
        return {};
      },
    },
    untitled: () => "Untitled Mystery",
    failed: (error) => errors.push(error),
    later: (callback) => {
      const id = ++nextTimer;
      timers.set(id, callback);
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    cancel: (id) => {
      timers.delete(id as unknown as number);
    },
  });
  return {
    owner,
    storage,
    rows,
    calls,
    publications,
    errors,
    timers,
    revalidate: () => {
      scope = { ...scope, generation: scope.generation + 1, revalidating: true };
    },
    verify: () => {
      scope = { ...scope, revalidating: false };
    },
    pauseDeletion: () => {
      deletionGate = deferred<void>();
      return deletionGate;
    },
    pause: () => {
      gate = deferred<void>();
      return gate;
    },
    fail: (value: boolean) => {
      fail = value;
    },
    changeAccount: () => {
      scope = { accountId: "bob", generation: 2 };
    },
  };
}

test("Mystery reconciles submitted content and version while preserving edits during saves", async () => {
  const f = mysteryFixture();
  await f.owner.load();
  f.owner.edit({ title: "First draft" });
  const gate = f.pause();
  const first = f.owner.save("auto");
  await tick();
  f.owner.edit({ title: "Second draft" });
  const second = f.owner.save("manual");
  gate.resolve();
  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(f.owner.current().selected!.title, "Second draft");
  assert.deepEqual(
    f.calls.map((call) => call.version),
    [1, 2],
  );
  assert.equal(f.owner.current().selected!.version, 3);
});
test("Mystery recovered browser draft is dirty and gets saved", async () => {
  const storage = new Map([
    [
      "cozycrowns-mystery-draft:alice:one",
      JSON.stringify({ ...mystery(), title: "Recovered", data: data("Recovered") }),
    ],
  ]);
  const f = mysteryFixture(undefined, storage);
  await f.owner.load();
  assert.equal(f.owner.current().selected!.title, "Recovered");
  assert.equal(f.timers.size, 1);
  for (const callback of f.timers.values()) {
    callback();
    break;
  }
  await tick();
  assert.equal(f.calls[0].title, "Recovered");
  assert.equal(f.rows.get("one")!.title, "Recovered");
});
test("Mystery older recovered draft conflicts without overwriting newer remote content", async () => {
  const storage = new Map([
    ["cozycrowns-mystery-draft:alice:one", JSON.stringify({ ...mystery(), title: "Local edits" })],
  ]);
  const f = mysteryFixture([{ ...mystery(), title: "Remote edits", version: 4 }], storage);
  await f.owner.load();
  assert.equal(await f.owner.save("auto"), false);
  assert.equal(f.owner.current().selected!.title, "Local edits");
  assert.equal(f.rows.get("one")!.title, "Remote edits");
});
test("Mystery keeps drafts for outgoing selections and reopens them", async () => {
  const f = mysteryFixture([mystery(), mystery("two")]);
  await f.owner.load();
  f.owner.edit({ intro: "Durable notes" });
  f.fail(true);
  f.owner.choose(mystery("two"));
  await tick();
  f.owner.choose(mystery());
  assert.equal(f.owner.current().selected!.data.intro, "Durable notes");
  const reopened = mysteryFixture([mystery(), mystery("two")], f.storage);
  await reopened.owner.load();
  assert.equal(reopened.owner.current().selected!.data.intro, "Durable notes");
});
test("Mystery failed restoration preserves edits made while restoration is saving", async () => {
  const f = mysteryFixture();
  await f.owner.load();
  const gate = f.pause();
  const restore = f.owner.restore({ title: "Historical", data: data("Historical") });
  await tick();
  f.owner.edit({ intro: "Typed during restore" });
  f.fail(true);
  gate.resolve();
  assert.equal(await restore, null);
  assert.equal(f.owner.current().selected!.title, "Historical");
  assert.equal(f.owner.current().selected!.data.intro, "Typed during restore");
});

for (const title of ["  Current title  ", ""]) {
  test(`Mystery restoration accepts title canonicalization for ${JSON.stringify(title)}`, async () => {
    const f = mysteryFixture();
    await f.owner.load();
    f.owner.edit({ title });
    const undo = await f.owner.restore({ title: "Historical", data: data("Historical") });
    assert.ok(undo);
    assert.equal(f.owner.current().selected!.title, "Historical");
    assert.equal(await undo(), true);
    assert.equal(f.owner.current().selected!.title, title.trim() || "Untitled Mystery");
  });
}
test("Mystery restores through version ownership and undo preserves the previous draft", async () => {
  const f = mysteryFixture();
  await f.owner.load();
  f.owner.edit({ title: "Before restore" });
  const undo = await f.owner.restore({ title: "Historical", data: data("Historical") });
  assert.ok(undo);
  assert.equal(f.owner.current().selected!.title, "Historical");
  assert.equal(await undo(), true);
  assert.equal(f.owner.current().selected!.title, "Before restore");
  assert.deepEqual(
    f.calls.map((call) => call.version),
    [1, 2, 3],
  );
});
test("Mystery publication consumes its submitted snapshot even when selection changes", async () => {
  const f = mysteryFixture([mystery(), mystery("two")]);
  await f.owner.load();
  f.owner.edit({ title: "Published snapshot" });
  const gate = f.pause();
  const publication = f.owner.publish();
  await tick();
  f.owner.choose(mystery("two"));
  gate.resolve();
  assert.equal(await publication, true);
  assert.deepEqual(f.publications, [{ id: "one", title: "Published snapshot" }]);
  assert.equal(f.owner.current().selected!.id, "two");
});
test("Mystery publication stays ahead of subsequent autosaves and preserves newer local edits", async () => {
  const f = mysteryFixture();
  await f.owner.load();
  f.owner.edit({ title: "Publish me" });
  const gate = f.pause();
  const publication = f.owner.publish();
  await tick();
  f.owner.edit({ title: "Later edits" });
  const saved = f.owner.save("auto");
  gate.resolve();
  await publication;
  await saved;
  assert.deepEqual(f.publications, [{ id: "one", title: "Publish me" }]);
  assert.equal(f.owner.current().selected!.title, "Later edits");
});
test("Mystery stale response never acknowledges across an account change", async () => {
  const f = mysteryFixture();
  await f.owner.load();
  f.owner.edit({ title: "Alice draft" });
  const gate = f.pause();
  const saved = f.owner.save("manual");
  await tick();
  f.changeAccount();
  gate.resolve();
  assert.equal(await saved, false);
  assert.equal(f.owner.current().selected!.version, 1);
  assert.equal(f.storage.has("cozycrowns-mystery-draft:bob:one"), false);
});
test("Mystery delete waits for save, cancels draft recovery, and supports soft-delete undo", async () => {
  const f = mysteryFixture();
  await f.owner.load();
  f.owner.edit({ title: "Before delete" });
  const saved = f.owner.save("auto");
  const deleted = f.owner.delete();
  await saved;
  assert.equal((await deleted)!.id, "one");
  assert.equal(f.owner.current().selected, null);
  assert.equal(f.storage.has("cozycrowns-mystery-draft:alice:one"), false);
  assert.equal(await f.owner.undelete("one"), true);
});

test("Mystery deletion before debounce preserves current content for soft-delete undo", async () => {
  const f = mysteryFixture();
  await f.owner.load();
  f.owner.edit({ title: "Before autosave", intro: "Latest draft" });
  assert.ok(await f.owner.delete());
  assert.equal(await f.owner.undelete("one"), true);
  assert.equal(f.owner.current().selected!.data.intro, "Latest draft");
});

test("Mystery deletion stops after failed preservation and keeps the recoverable draft", async () => {
  const f = mysteryFixture();
  await f.owner.load();
  f.owner.edit({ intro: "Keep after failed save" });
  f.fail(true);
  assert.equal(await f.owner.delete(), null);
  assert.ok(f.rows.has("one"));
  assert.equal(f.owner.current().selected!.data.intro, "Keep after failed save");
  assert.equal(
    JSON.parse(f.storage.get("cozycrowns-mystery-draft:alice:one")!).data.intro,
    "Keep after failed save",
  );
});

test("Mystery soft-delete undo recovers edits made while deletion was in flight", async () => {
  const f = mysteryFixture();
  await f.owner.load();
  f.owner.edit({ intro: "Before deletion" });
  const gate = f.pauseDeletion();
  const deletion = f.owner.delete();
  await tick();
  f.owner.edit({ intro: "During deletion" });
  gate.resolve();
  assert.ok(await deletion);
  assert.equal(await f.owner.undelete("one"), true);
  assert.equal(f.owner.current().selected!.data.intro, "During deletion");
  assert.equal(await f.owner.save("auto"), true);
  assert.equal(f.rows.get("one")!.data.intro, "During deletion");
});

test("recreated Maven owner recognizes durable acknowledgements without treating later edits as clean", async () => {
  const f = mavenFixture();
  assert.equal(await f.owner.save("local"), true);
  const recreated = f.recreate();
  assert.equal(recreated.canReplace(f.records.get("local")!), true);
  f.records.set("local", { ...f.records.get("local")!, style: "New local edits" });
  assert.equal(recreated.canReplace(f.records.get("local")!), false);
});
test("Maven canonical pulls preserve divergent legacy drafts and resolve their stale remote versions", async () => {
  const f = mavenFixture();
  const local = {
    ...f.records.get("local")!,
    id: "remote",
    ownerId: "alice",
    version: 1,
    style: "Unsaved legacy notes",
  };
  f.records.set("local", local);
  const remote = {
    id: "remote",
    version: 4,
    data: toPersistedCharacter({ ...local, style: "Cloud notes" }),
    owned: true,
  };
  f.ports.list = async () => ({ characters: [remote] });
  f.ports.merge = (remotes, accountId) => {
    const merged = reconcileMavenRecords(
      [...f.records.values()],
      remotes,
      accountId,
      (record) => f.owner.canReplace(record),
      () => "preserved",
    );
    f.records.clear();
    for (const record of merged) f.records.set(record.localId, record);
  };
  await f.owner.sync();
  assert.equal(f.records.get("local")!.version, 4);
  assert.equal(f.records.get("local")!.style, "Cloud notes");
  assert.equal(f.records.get("preserved")!.style, "Unsaved legacy notes");
  assert.equal(f.records.get("preserved")!.id, undefined);
  assert.equal(f.recreate().canReplace(f.records.get("local")!), true);
});
test("Maven clean persisted records reconcile newer cloud versions without duplicating documents", async () => {
  const f = mavenFixture();
  await f.owner.save("local");
  const recreated = f.recreate();
  const local = f.records.get("local")!;
  const merged = reconcileMavenRecords(
    [local],
    [
      {
        id: "remote",
        version: 5,
        data: toPersistedCharacter({ ...local, style: "New cloud style" }),
      },
    ],
    "alice",
    (record) => recreated.canReplace(record),
    () => "unexpected",
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].version, 5);
  assert.equal(merged[0].style, "New cloud style");
});
test("Maven acknowledges the submitted base while an in-flight save has newer local edits", async () => {
  const f = mavenFixture();
  const gate = f.pause();
  const saved = f.owner.save("local");
  await tick();
  f.records.set("local", { ...f.records.get("local")!, style: "Still dirty" });
  gate.resolve();
  await saved;
  assert.equal(f.recreate().canReplace(f.records.get("local")!), false);
});
test("Mystery restore undo returns to its original document after selection changes", async () => {
  const f = mysteryFixture([mystery(), mystery("two")]);
  await f.owner.load();
  const undo = await f.owner.restore({ title: "Historical", data: data("Historical") });
  assert.ok(undo);
  f.owner.choose(mystery("two"));
  f.owner.edit({ intro: "Second document draft" });
  assert.equal(await undo(), true);
  assert.equal(f.owner.current().selected!.id, "one");
  assert.equal(f.owner.current().selected!.title, "Mystery");
  f.owner.choose(mystery("two"));
  assert.equal(f.owner.current().selected!.data.intro, "Second document draft");
});

test("Mystery reload reopens the last selected document with its recovered edits", async () => {
  const f = mysteryFixture([mystery(), mystery("two")]);
  await f.owner.load();
  f.owner.choose(mystery("two"));
  f.owner.edit({ intro: "Reopen here" });
  const reopened = mysteryFixture([mystery(), mystery("two")], f.storage);
  await reopened.owner.load();
  assert.equal(reopened.owner.current().selected!.id, "two");
  assert.equal(reopened.owner.current().selected!.data.intro, "Reopen here");
});
test("Mystery recovers the legacy selected draft without accepting malformed data", async () => {
  const storage = new Map([
    ["cozycrowns-mystery-draft", JSON.stringify({ ...mystery("two"), title: "Legacy recovery" })],
  ]);
  const f = mysteryFixture([mystery(), mystery("two")], storage);
  await f.owner.load();
  assert.equal(f.owner.current().selected!.id, "two");
  assert.equal(f.owner.current().selected!.title, "Legacy recovery");
  const malformed = mysteryFixture(
    undefined,
    new Map([["cozycrowns-mystery-draft:alice:one", JSON.stringify({ ...mystery(), data: {} })]]),
  );
  await malformed.owner.load();
  assert.deepEqual(malformed.owner.current().selected!.data, data());
});

test("Mystery explicit conflict reload archives local edits, loads canonical version, and allows undo", async () => {
  const storage = new Map([
    [
      "cozycrowns-mystery-draft:alice:one",
      JSON.stringify({ ...mystery(), title: "Local conflict" }),
    ],
  ]);
  const f = mysteryFixture([{ ...mystery(), title: "Cloud", version: 4 }], storage);
  await f.owner.load();
  assert.equal(await f.owner.save("auto"), false);
  const undo = await f.owner.reload();
  assert.ok(undo);
  assert.equal(f.owner.current().selected!.title, "Cloud");
  assert.equal(f.owner.current().selected!.version, 4);
  assert.equal(
    JSON.parse(storage.get("cozycrowns-mystery-draft:alice:one:recovery")!).title,
    "Local conflict",
  );
  assert.equal(await undo(), true);
  assert.equal(f.owner.current().selected!.title, "Local conflict");
  assert.equal(f.owner.current().selected!.version, 5);
});

test("Maven pauses remote writes during token verification and resumes without losing edits", async () => {
  const f = mavenFixture();
  f.revalidate();
  f.records.set("local", { ...f.records.get("local")!, style: "While verifying" });
  assert.equal(await f.owner.save("local"), false);
  assert.equal(f.calls.length, 0);
  f.verify();
  assert.equal(await f.owner.save("local"), true);
  assert.equal(f.records.get("local")!.style, "While verifying");
});

test("Mystery keeps editing locally while token verification retires its remote lifetime", async () => {
  const f = mysteryFixture();
  await f.owner.load();
  f.revalidate();
  f.owner.edit({ intro: "Typed during verification" });
  assert.equal(f.owner.current().selected!.data.intro, "Typed during verification");
  assert.equal(await f.owner.save("auto"), false);
  assert.equal(f.calls.length, 0);
  const resumed = mysteryFixture([...f.rows.values()], f.storage);
  await resumed.owner.load();
  assert.equal(resumed.owner.current().selected!.data.intro, "Typed during verification");
  assert.equal(await resumed.owner.save("auto"), true);
});

test("Mystery recovery callback survives verified same-account session rotation", async () => {
  const f = mysteryFixture();
  await f.owner.load();
  f.owner.edit({ title: "Unsent edits before deletion" });
  const removed = await f.owner.delete();
  assert.ok(removed);
  const undo = () => f.owner.undelete(removed.id);
  f.revalidate();
  assert.equal(await undo(), false);
  f.verify();
  await f.owner.resumeSession();
  assert.equal(await undo(), true);
  assert.equal(f.owner.current().selected!.title, "Unsent edits before deletion");
});

test("Mystery resumes only after retiring pending saves from the previous session", async () => {
  const f = mysteryFixture();
  await f.owner.load();
  f.owner.edit({ title: "Sent draft" });
  const gate = f.pause();
  const save = f.owner.save("auto");
  await tick();
  f.revalidate();
  f.owner.edit({ title: "Edits during session verification" });
  f.verify();
  const resume = f.owner.resumeSession();
  gate.resolve();
  assert.equal(await save, false);
  await resume;
  assert.equal(f.owner.current().selected!.title, "Edits during session verification");
  assert.equal(f.rows.get("one")!.title, "Sent draft");
  assert.equal(await f.owner.save("manual"), false);
  assert.equal(f.owner.current().selected!.title, "Edits during session verification");
});

test("Maven retains successful creation identity across same-account session verification", async () => {
  const f = mavenFixture();
  const gate = f.pause();
  const save = f.owner.save("local");
  await tick();
  f.revalidate();
  f.records.set("local", { ...f.records.get("local")!, name: "New edits during verification" });
  gate.resolve();
  assert.equal(await save, false);
  assert.equal(f.records.get("local")!.id, undefined);
  f.verify();
  const resumed = f.recreate();
  await resumed.sync();
  assert.equal(f.records.get("local")!.id, "remote");
  assert.equal(f.records.get("local")!.name, "New edits during verification");
  assert.equal(await resumed.save("local"), true);
  assert.deepEqual(
    f.calls.map((call) => call.id),
    [undefined, "remote"],
  );
});

test("Maven creation receipts remain owned by their submitting account until it returns", async () => {
  const f = mavenFixture();
  const gate = f.pause();
  const save = f.owner.save("local");
  await tick();
  f.changeAccount("bob");
  gate.resolve();
  assert.equal(await save, false);
  await f.recreate().sync();
  assert.equal(f.records.get("local")!.id, undefined);
  assert.equal(await f.owner.save("local"), false);
  f.changeAccount("alice");
  await f.recreate().sync();
  assert.equal(f.records.get("local")!.id, "remote");
  assert.equal(f.calls.length, 1);
});
