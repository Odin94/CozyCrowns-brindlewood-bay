import type { StateStorage } from "zustand/middleware";

type Document = Record<string, unknown> & { localId: string };
type Operation = Register & { key: string; id: string; field: string };
export const MAX_RECOVERABLE_CHARACTERS = 20;
export const RECOVERY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export type CharacterArchive = { record: Document; deletedAt: number };
type Envelope = {
  deletedRecords?: Record<string, Document>;
  fieldRegisters?: Record<string, Operation>;
  frontiers?: Record<string, number>;
  tombstones?: Record<string, number>;
  version: number;
  state: {
    characters: Document[];
    selectedCharacterId: string;
    archivedCharacters?: CharacterArchive[];
  };
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
  // A fresh document instance must own its journal synchronously. Browser tab
  // duplication copies sessionStorage, and a later handshake cannot undo lost
  // writes made before it resolves. Compaction bounds journals across reloads.
  const writer = crypto.randomUUID();
  let previous: Envelope | undefined;
  // Failed durable writes remain replayable through external rehydration.
  const pendingJournals = new Map<string, Journal>();
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
    for (const [key, journal] of pendingJournals) {
      if (!key.startsWith(`${name}:writer:`)) continue;
      const existing = result.findIndex(([entryKey]) => entryKey === key);
      if (existing >= 0) result[existing] = [key, journal];
      else result.push([key, journal]);
    }
    return result;
  };
  let needsCompaction = false;
  const read = (name: string): Envelope | undefined => {
    needsCompaction = false;
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
      /* valid journals still recover drafts below */
    }
    if (raw && !base) {
      try {
        if (storage.getItem(`${name}:corrupt-checkpoint`) !== raw)
          storage.setItem(`${name}:corrupt-checkpoint`, raw);
      } catch (error) {
        onError(error);
      }
    }
    if (base) {
      const numbers = (input: unknown): Record<string, number> =>
        isObject(input)
          ? (Object.fromEntries(
              Object.entries(input).filter(
                ([, value]) =>
                  typeof value === "number" && Number.isSafeInteger(value) && value >= 0,
              ),
            ) as Record<string, number>)
          : {};
      base.frontiers = numbers(base.frontiers);
      base.tombstones = numbers(base.tombstones);
      base.deletedRecords = isObject(base.deletedRecords)
        ? (Object.fromEntries(
            Object.entries(base.deletedRecords).filter(
              ([, value]) => isObject(value) && typeof value.localId === "string",
            ),
          ) as Record<string, Document>)
        : {};
      base.fieldRegisters = isObject(base.fieldRegisters)
        ? (Object.fromEntries(
            Object.entries(base.fieldRegisters).filter(
              ([, value]) =>
                isObject(value) &&
                typeof value.clock === "number" &&
                Number.isSafeInteger(value.clock) &&
                typeof value.id === "string" &&
                typeof value.field === "string" &&
                typeof value.key === "string",
            ),
          ) as Record<string, Operation>)
        : {};
    }
    const writers = journals(name);
    if (!writers.length && !base) return undefined;
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
    const archiveDropped = new Set<string>();
    const lateRecoveries: Array<{ id: string; clock: number; record: Document }> = [];
    for (const operation of operations) {
      if (operation.field === "$archive") {
        if (isObject(operation.value)) deletedRecords[operation.id] = operation.value as Document;
        else {
          delete deletedRecords[operation.id];
          archiveDropped.add(operation.id);
        }
        continue;
      }
      if (operation.field === "$recovery") {
        if (isObject(operation.value))
          lateRecoveries.push({
            id: operation.id,
            clock: operation.clock,
            record: operation.value as Document,
          });
        continue;
      }
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
      delete recovered.creationId;
      records.set(localId, recovered);
    }
    for (const [id, clock] of deleted) {
      const newer = operations.some(
        (operation) =>
          operation.id === id && !operation.field.startsWith("$") && operation.clock > clock,
      );
      const record = records.get(id);
      records.delete(id);
      if (record && !archiveDropped.has(id) && !deletedRecords[id])
        deletedRecords[id] = { ...record, $archivedAt: Date.now() };
      if (newer && record) {
        const localId = `${id}:recovery:deleted`;
        const recovered: Document = { ...record, localId };
        delete recovered.id;
        delete recovered.version;
        delete recovered.remoteContent;
        delete recovered.creationId;
        delete recovered.$archivedAt;
        records.set(localId, recovered);
      }
    }
    for (const recovery of lateRecoveries) {
      const localId = `${recovery.id}:recovery:deleted:${recovery.clock}`;
      const record: Document = { ...recovery.record, localId };
      delete record.id;
      delete record.version;
      delete record.remoteContent;
      delete record.creationId;
      records.set(localId, record);
    }
    const archivedCharacters = Object.entries(deletedRecords)
      .map(([id, record]) => ({
        id,
        record,
        deletedAt: typeof record.$archivedAt === "number" ? record.$archivedAt : Date.now(),
      }))
      .filter((entry) => entry.deletedAt >= Date.now() - RECOVERY_RETENTION_MS)
      // eslint-disable-next-line unicorn/no-array-sort -- This freshly mapped array is private.
      .sort(
        (a, b) =>
          b.deletedAt - a.deletedAt ||
          Number(b.record.$archivedClock ?? 0) - Number(a.record.$archivedClock ?? 0),
      )
      .slice(0, MAX_RECOVERABLE_CHARACTERS);
    const retainedIds = new Set(archivedCharacters.map((entry) => entry.id));
    for (const id of Object.keys(deletedRecords))
      if (!retainedIds.has(id)) {
        delete deletedRecords[id];
        needsCompaction = true;
      }
    // Tombstones need identities and clocks, never every deleted text/array.
    for (const [key, register] of latest) if (deleted.has(register.id)) latest.delete(key);
    const selectedCharacterId =
      previous?.state.selectedCharacterId ??
      writers.find(([key]) => key.endsWith(`:writer:${writer}`))?.[1].selectedCharacterId ??
      base?.state.selectedCharacterId ??
      writers[0]?.[1].selectedCharacterId ??
      "";
    return {
      deletedRecords,
      fieldRegisters: Object.fromEntries(latest),
      frontiers: base?.frontiers,
      tombstones: Object.fromEntries(deleted),
      version: base?.version ?? writers[0]?.[1].version ?? 2,
      state: {
        characters: [...records.values()],
        selectedCharacterId,
        archivedCharacters: archivedCharacters.map(({ record, deletedAt }) => ({
          record,
          deletedAt,
        })),
      },
    };
  };
  let compactionPending = false;
  const compact = (name: string, force = false) => {
    if (compactionPending || typeof navigator === "undefined" || !navigator.locks) return;
    if (!force && journals(name).length < 8) return;
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
        storage.setItem(
          name,
          JSON.stringify({
            ...consolidated,
            state: { ...consolidated.state, archivedCharacters: undefined },
          }),
        );
        for (const [key, journal] of entries)
          if (pendingJournals.get(key) === journal) pendingJournals.delete(key);
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
      if (needsCompaction) compact(name, true);
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
      const durable = read(name);
      let clock = Math.max(
        0,
        ...Object.values(durable?.frontiers ?? {}),
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
        if (durable?.tombstones?.[record.localId] !== undefined) {
          if (!equal(old, record))
            (journal.records[record.localId] ??= {}).$recovery = {
              clock: ++clock,
              value: record,
              base: undefined,
            };
          before.delete(record.localId);
          continue;
        }
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
      for (const [id, record] of before) {
        journal.records[id] = {
          $deleted: { clock: ++clock, value: true, base: false },
          $archive: {
            clock: ++clock,
            value: {
              ...record,
              $archivedAt:
                next.state.archivedCharacters?.find((entry) => entry.record.localId === id)
                  ?.deletedAt ?? Date.now(),
              $archivedClock: clock + 1,
            },
            base: undefined,
          },
        };
      }
      const remainingArchives = new Set(
        next.state.archivedCharacters?.map((entry) => entry.record.localId) ?? [],
      );
      for (const archive of previous?.state.archivedCharacters ?? []) {
        if (!remainingArchives.has(archive.record.localId))
          (journal.records[archive.record.localId] ??= {}).$archive = {
            clock: ++clock,
            value: undefined,
            base: undefined,
          };
      }
      journal.selectedCharacterId = next.state.selectedCharacterId;
      journal.version = next.version;
      try {
        storage.setItem(writerKey, JSON.stringify(journal));
      } catch (error) {
        pendingJournals.set(writerKey, journal);
        previous = next;
        onError(error);
        return;
      }
      pendingJournals.delete(writerKey);
      previous = next;
      compact(name, before.size > 0 || needsCompaction);
    },
    removeItem: (name) => storage.removeItem(name),
  };
}
