import { toPersistedCharacter, normalizeCharacter } from "./character_document.ts";
import type { CharacterRecord, BackendCharacter } from "./character_store.ts";
import type { AccountScope } from "./account_scope.ts";

type Payload = { name: string; data: ReturnType<typeof toPersistedCharacter>; version: number };
type Remote = { id: string; version: number };
type Ports = {
  scope: () => AccountScope;
  record: (localId: string) => CharacterRecord | undefined;
  claim: (localId: string, accountId: string) => void;
  acknowledge: (
    localId: string,
    result: Remote,
    accountId: string,
    submittedContent: string,
  ) => void;
  merge: (records: BackendCharacter[], accountId: string) => void;
  list: () => Promise<{ characters: Array<BackendCharacter & { owned: boolean }> }>;
  write?: (localId: string, payload: Payload, isCurrent: () => boolean) => Promise<Remote>;
  create: (payload: Payload) => Promise<Remote>;
  update: (id: string, payload: Payload) => Promise<Remote>;
  failed: (error: unknown) => void;
  storage?: Pick<Storage, "getItem" | "setItem">;
};
type Receipt = { accountId: string; previousId?: string; result: Remote; submittedContent: string };
const receiptKey = "cozycrowns-maven-save-receipts";
const content = (record: CharacterRecord) => JSON.stringify(toPersistedCharacter(record));

/** One queue per local document, shared by all save callers. Content stays local on failure. */
export class MavenPersistence {
  private queues = new Map<string, Promise<boolean>>();
  private ports: Ports;
  private receipts = new Map<string, Receipt>();
  constructor(ports: Ports) {
    this.ports = ports;
    try {
      const stored = JSON.parse(ports.storage?.getItem(receiptKey) ?? "[]");
      if (Array.isArray(stored))
        for (const entry of stored) {
          if (!Array.isArray(entry) || entry.length !== 2) continue;
          const [localId, receipt] = entry;
          if (
            typeof localId === "string" &&
            receipt &&
            typeof receipt.accountId === "string" &&
            (receipt.previousId === undefined || typeof receipt.previousId === "string") &&
            typeof receipt.result?.id === "string" &&
            Number.isInteger(receipt.result?.version) &&
            typeof receipt.submittedContent === "string"
          )
            this.receipts.set(localId, receipt);
        }
    } catch (error) {
      ports.failed(error);
    }
  }
  private persistReceipts() {
    try {
      this.ports.storage?.setItem(receiptKey, JSON.stringify([...this.receipts]));
    } catch (error) {
      this.ports.failed(error);
    }
  }
  private recoverReceipts(scope: AccountScope) {
    if (!scope.accountId || scope.revalidating || scope.signingOut) return;
    for (const [localId, receipt] of this.receipts) {
      if (receipt.accountId !== scope.accountId) continue;
      const current = this.ports.record(localId);
      if (current?.ownerId === receipt.accountId && current.id === receipt.previousId)
        this.ports.acknowledge(
          localId,
          receipt.result,
          receipt.accountId,
          receipt.submittedContent,
        );
      this.receipts.delete(localId);
    }
    this.persistReceipts();
  }

  save(localId: string): Promise<boolean> {
    const scope = this.ports.scope();
    if (scope.revalidating || scope.signingOut) return Promise.resolve(false);
    this.recoverReceipts(scope);
    const submitted = this.ports.record(localId);
    if (!scope.accountId) return Promise.resolve(true);
    if (!submitted || (!submitted.name.trim() && !submitted.id)) return Promise.resolve(true);
    if (submitted.ownerId && submitted.ownerId !== scope.accountId) return Promise.resolve(false);
    const payload = { name: submitted.name, data: toPersistedCharacter(submitted) };
    const stillCurrent = () => {
      const current = this.ports.scope();
      return (
        !current.revalidating &&
        !current.signingOut &&
        current.accountId === scope.accountId &&
        current.generation === scope.generation
      );
    };
    // Claim anonymous documents before queuing: another account cannot adopt pending work.
    if (!submitted.id && !submitted.ownerId) this.ports.claim(localId, scope.accountId);
    const task = async () => {
      if (!stillCurrent()) return false;
      this.recoverReceipts(scope);
      let current = this.ports.record(localId);
      if (!current || (current.ownerId && current.ownerId !== scope.accountId)) return false;
      try {
        // Legacy documents have no owner metadata. Verify ownership before the first write.
        if (current.id && !current.ownerId) {
          const remote = await this.ports.list();
          if (!stillCurrent()) return false;
          if (!remote.characters.some((entry) => entry.owned && entry.id === current?.id))
            return false;
          this.ports.claim(localId, scope.accountId!);
          current = this.ports.record(localId);
          if (!current) return false;
        }
        const id = current.id;
        const result = this.ports.write
          ? await this.ports.write(
              localId,
              { ...payload, version: current.version ?? 1 },
              stillCurrent,
            )
          : id
            ? await this.ports.update(id, { ...payload, version: current.version ?? 1 })
            : await this.ports.create({ ...payload, version: 1 });
        const latest = this.ports.record(localId);
        if (!latest || latest.ownerId !== scope.accountId || latest.id !== id) return false;
        if (!stillCurrent()) {
          // The successful response belongs to its submitting account even while a
          // new token is being verified. Keep its identity durable until that owner returns.
          this.receipts.set(localId, {
            accountId: scope.accountId!,
            previousId: id,
            result,
            submittedContent: JSON.stringify(payload.data),
          });
          this.persistReceipts();
          this.recoverReceipts(this.ports.scope());
          return false;
        }
        this.ports.acknowledge(localId, result, scope.accountId!, JSON.stringify(payload.data));
        return true;
      } catch (error) {
        if (stillCurrent()) this.ports.failed(error);
        return false;
      }
    };
    const queued = (this.queues.get(localId) ?? Promise.resolve(true))
      .catch(() => false)
      .then(task);
    this.queues.set(localId, queued);
    void queued.finally(() => {
      if (this.queues.get(localId) === queued) this.queues.delete(localId);
    });
    return queued;
  }

  /** Pulls only owned rows and never replaces a draft or an in-flight submission. */
  async sync(): Promise<void> {
    const scope = this.ports.scope();
    if (!scope.accountId || scope.revalidating || scope.signingOut) return;
    await Promise.all(this.queues.values());
    if (scope.generation !== this.ports.scope().generation) return;
    this.recoverReceipts(scope);
    const result = await this.ports.list();
    // A create acknowledged during the pull must be attached locally before merging its row.
    await Promise.all(this.queues.values());
    const current = this.ports.scope();
    if (scope.accountId !== current.accountId || scope.generation !== current.generation) return;
    this.recoverReceipts(current);
    this.ports.merge(
      result.characters.filter((entry) => entry.owned),
      scope.accountId,
    );
  }

  canReplace(record: CharacterRecord): boolean {
    return (
      !this.queues.has(record.localId) &&
      (record.syncedContent ?? record.remoteContent) === content(record)
    );
  }
}

/** Canonical replacements keep divergent local work as a separate durable document. */
export function reconcileMavenRecords(
  records: CharacterRecord[],
  remotes: BackendCharacter[],
  ownerId: string | undefined,
  canReplace: (record: CharacterRecord) => boolean,
  newId: () => string,
  onPreserved?: (original: CharacterRecord, preserved: CharacterRecord) => void,
): CharacterRecord[] {
  const characters = [...records];
  for (const remote of remotes) {
    const index = characters.findIndex(
      (record) => record.id === remote.id && (!record.ownerId || record.ownerId === ownerId),
    );
    const canonical: CharacterRecord = {
      ...normalizeCharacter(remote.data),
      localId: index < 0 ? newId() : characters[index].localId,
      id: remote.id,
      version: remote.version,
      ownerId,
      syncedContent: JSON.stringify(toPersistedCharacter(normalizeCharacter(remote.data))),
    };
    if (index < 0) {
      characters.push(canonical);
      continue;
    }
    const current = characters[index];
    const equalContent = content(current) === canonical.syncedContent;
    if (remote.version > (current.version ?? 0)) {
      if (!equalContent && !canReplace(current)) {
        const preserved = { ...current, localId: newId() };
        delete preserved.id;
        delete preserved.version;
        delete preserved.syncedContent;
        delete preserved.remoteContent;
        delete preserved.creationId;
        characters.push(preserved);
        onPreserved?.(current, preserved);
      }
      characters[index] = canonical;
    } else {
      characters[index] = {
        ...current,
        ownerId: ownerId ?? current.ownerId,
        ...(equalContent ? { syncedContent: canonical.syncedContent } : {}),
      };
    }
  }
  return characters;
}
