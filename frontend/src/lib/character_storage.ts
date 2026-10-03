/* eslint-disable unicorn/require-post-message-target-origin -- BroadcastChannel is origin-scoped and has no targetOrigin argument. */
import type { StateStorage } from "zustand/middleware";

type Document = Record<string, unknown> & { localId: string };
type Operation = Register & { key: string; id: string; field: string };
type Envelope = {
  deletedRecords?: Record<string, Document>;
  fieldRegisters?: Record<string, Operation>;
  frontiers?: Record<string, number>;
  tombstones?: Record<string, number>;
  version: number;
  state: { characters: Document[]; selectedCharacterId: string };
};
type Register = { clock: number; value: unknown; base: unknown };
type Journal = {
  selectedCharacterId: string;
  version: number;
  records: Record<string, Record<string, Register>>;
};
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validJournal = (value: unknown): value is Journal =>
  isObject(value) &&
  isObject(value.records) &&
  typeof value.version === "number" &&
  typeof value.selectedCharacterId === "string" &&
  Object.values(value.records).every(
    (fields) =>
      isObject(fields) &&
      Object.values(fields).every(
        (register) =>
          isObject(register) &&
          typeof register.clock === "number" &&
          Number.isSafeInteger(register.clock) &&
          register.clock >= 0,
      ),
  );
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Each tab owns one bounded journal key. Concurrent tabs never overwrite each
 * other's operations; unchanged fields never become writes. */
export function createCharacterStorage(
  storage: Storage = localStorage,
  onError: (error: unknown) => void = () => {},
): StateStorage {
  if (typeof storage.key !== "function") return storage; // non-browser harness
  let writer: string = crypto.randomUUID();
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      writer = window.sessionStorage.getItem("cozycrowns-storage-writer") ?? writer;
      window.sessionStorage.setItem("cozycrowns-storage-writer", writer);
      // Duplicating a browser tab may clone sessionStorage. Resolve that rare
      // collision before edits, while ordinary reloads keep the same journal.
      if (typeof BroadcastChannel !== "undefined") {
        const instance = crypto.randomUUID();
        const channel = new BroadcastChannel("cozycrowns-storage-writers");
        channel.addEventListener("message", ({ data }) => {
          if (data.writer !== writer || data.instance === instance) return;
          if (data.instance < instance) {
            writer = crypto.randomUUID();
            window.sessionStorage.setItem("cozycrowns-storage-writer", writer);
          }
          channel.postMessage({ writer, instance });
        });
        channel.postMessage({ writer, instance });
      }
    } catch {
      /* storage warnings are emitted on an actual failed write */
    }
  }
  let previous: Envelope | undefined;
  const journals = (name: string): Array<[string, Journal]> => {
    const result: Array<[string, Journal]> = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(`${name}:writer:`)) {
        try {
          const journal: unknown = JSON.parse(storage.getItem(key)!);
          if (validJournal(journal)) result.push([key, journal]);
        } catch {
          /* retain malformed data untouched */
        }
      }
    }
    return result;
  };
  const read = (name: string): Envelope | undefined => {
    const raw = storage.getItem(name);
    let base: Envelope | undefined;
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : undefined;
      if (
        isObject(parsed) &&
        isObject(parsed.state) &&
        Array.isArray(parsed.state.characters) &&
        parsed.state.characters.every(isObject)
      )
        base = parsed as Envelope;
    } catch {
      return undefined;
    }
    const writers = journals(name);
    if (!writers.length) return base;
    const records = new Map<string, Document>();
    for (const record of base?.state.characters ?? [])
      if (typeof record.localId === "string") records.set(record.localId, { ...record });
    for (const [id, record] of Object.entries(base?.deletedRecords ?? {}))
      records.set(id, { ...record });
    const operations = writers.flatMap(([key, journal]) =>
      Object.entries(journal.records).flatMap(([id, fields]) =>
        Object.entries(fields)
          .filter(([, register]) => register.clock > (base?.frontiers?.[key] ?? -1))
          .map(([field, register]) =>
            Object.assign(
              {
                key,
                id,
                field,
              },
              register,
            ),
          ),
      ),
    );
    operations.sort((a, b) => a.clock - b.clock || a.key.localeCompare(b.key));
    const deleted = new Map<string, number>(Object.entries(base?.tombstones ?? {}));
    const latest = new Map<string, Operation>(Object.entries(base?.fieldRegisters ?? {}));
    const deletedRecords: Record<string, Document> = { ...base?.deletedRecords };
    const conflicts: typeof operations = [];
    for (const operation of operations) {
      if (operation.field === "$deleted") {
        deleted.set(operation.id, operation.clock);
        continue;
      }
      const registerKey = `${operation.id}:${operation.field}`;
      const last = latest.get(registerKey);
      if (
        last &&
        last.key !== operation.key &&
        !equal(last.value, operation.base) &&
        !equal(last.value, operation.value)
      )
        conflicts.push(last);
      latest.set(registerKey, operation);
      const record = records.get(operation.id) ?? { localId: operation.id };
      record[operation.field] = operation.value;
      records.set(operation.id, record);
    }
    // Keep conflicting values and edits made after a deletion as independent,
    // local recovery records. They must never resurrect the deleted server id.
    for (const conflict of conflicts) {
      const record = records.get(conflict.id)!;
      const localId = `${conflict.id}:recovery:${conflict.key.split(":").pop()}:${conflict.field}`;
      const recovered = { ...record, [conflict.field]: conflict.value, localId };
      delete recovered.id;
      delete recovered.version;
      delete recovered.remoteContent;
      records.set(localId, recovered);
    }
    for (const [id, clock] of deleted) {
      const newer = operations.some(
        (operation) =>
          operation.id === id && operation.field !== "$deleted" && operation.clock > clock,
      );
      const record = records.get(id);
      records.delete(id);
      if (record) deletedRecords[id] = record;
      if (newer && record) {
        const localId = `${id}:recovery:deleted`;
        const recovered: Document = { ...record, localId };
        delete recovered.id;
        delete recovered.version;
        delete recovered.remoteContent;
        records.set(localId, recovered);
      }
    }
    const selectedCharacterId =
      previous?.state.selectedCharacterId ??
      writers.find(([key]) => key.endsWith(`:writer:${writer}`))?.[1].selectedCharacterId ??
      base?.state.selectedCharacterId ??
      writers[0][1].selectedCharacterId;
    return {
      deletedRecords,
      fieldRegisters: Object.fromEntries(latest),
      frontiers: base?.frontiers,
      tombstones: Object.fromEntries(deleted),
      version: base?.version ?? writers[0][1].version,
      state: { characters: [...records.values()], selectedCharacterId },
    };
  };
  let compactionPending = false;
  const compact = (name: string) => {
    if (compactionPending || typeof navigator === "undefined" || !navigator.locks) return;
    if (journals(name).length < 8) return;
    compactionPending = true;
    void navigator.locks
      .request(`${name}:compaction`, () => {
        const entries = journals(name);
        const snapshots = entries.map(([key]) => [key, storage.getItem(key)] as const);
        const consolidated = read(name);
        if (!consolidated) return;
        consolidated.frontiers = { ...consolidated.frontiers };
        for (const [key, journal] of entries)
          consolidated.frontiers[key] = Math.max(
            consolidated.frontiers[key] ?? 0,
            ...Object.values(journal.records).flatMap((fields) =>
              Object.values(fields).map((register) => register.clock),
            ),
          );
        storage.setItem(name, JSON.stringify(consolidated));
        // Writers need not await the lock: if an active writer changed since our
        // snapshot, retain its key and skip only operations below its frontier.
        for (const [key, value] of snapshots)
          if (storage.getItem(key) === value) storage.removeItem(key);
      })
      .catch(onError)
      .finally(() => {
        compactionPending = false;
      });
  };
  return {
    getItem: (name) => {
      previous = read(name);
      return previous ? JSON.stringify(previous) : null;
    },
    setItem: (name, serialized) => {
      const next = JSON.parse(serialized) as Envelope;
      const writerKey = `${name}:writer:${writer}`;
      const entries = journals(name);
      const journal = entries.find(([key]) => key === writerKey)?.[1] ?? {
        records: {},
        version: next.version,
        selectedCharacterId: next.state.selectedCharacterId,
      };
      let clock = Math.max(
        0,
        ...Object.values(read(name)?.frontiers ?? {}),
        ...entries.flatMap(([, entry]) =>
          Object.values(entry.records).flatMap((fields) =>
            Object.values(fields).map((register) => register.clock),
          ),
        ),
      );
      const before = new Map(
        (previous?.state.characters ?? [])
          .filter((record) => typeof record.localId === "string")
          .map((record) => [record.localId, record]),
      );
      for (const record of next.state.characters) {
        const old = before.get(record.localId);
        for (const field of new Set([...Object.keys(record), ...Object.keys(old ?? {})])) {
          if (field === "localId" || equal(old?.[field], record[field])) continue;
          (journal.records[record.localId] ??= {})[field] = {
            clock: ++clock,
            value: record[field],
            base: old?.[field],
          };
        }
        before.delete(record.localId);
      }
      for (const [id] of before)
        (journal.records[id] ??= {}).$deleted = { clock: ++clock, value: true, base: false };
      journal.selectedCharacterId = next.state.selectedCharacterId;
      journal.version = next.version;
      try {
        storage.setItem(writerKey, JSON.stringify(journal));
      } catch (error) {
        onError(error);
        return;
      }
      previous = next;
      compact(name);
    },
    removeItem: (name) => storage.removeItem(name),
  };
}
