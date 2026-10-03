import type { CharacterRecord, BackendCharacterData } from "./character_store";
export type CharacterDeletion = {
  ownerId: string;
  localId: string;
  remoteId?: string;
  awaitingCreate?: boolean;
  requestedAt: number;
};
type Payload = { name: string; data: BackendCharacterData };
type Dependencies = {
  storage: Storage;
  sessionKey?: () => unknown;
  record: (localId: string) => CharacterRecord | undefined;
  creationId: (localId: string) => string | undefined;
  acknowledge: (localId: string, id: string, version: number, content: string) => void;
  remove: (localId: string) => void;
  create: (
    payload: Payload & { creationId?: string; version: number },
  ) => Promise<{ id: string; version: number; data?: BackendCharacterData }>;
  update: (
    id: string,
    payload: Payload & { version: number },
  ) => Promise<{ id: string; version: number; data?: BackendCharacterData }>;
  delete: (id: string) => Promise<unknown>;
};
const prefix = "cozycrowns-character-deletion:";
const deletionKey = (ownerId: string, localId: string) =>
  `${prefix}${encodeURIComponent(ownerId)}:${localId}`;

export function createCharacterCoordinator(deps: Dependencies) {
  let sessionOwner: string | undefined;
  let sessionGeneration = 0;
  let sessionConfigured = false;
  let sessionCredential = deps.sessionKey?.();
  const allowed = (ownerId: string, generation: number) => {
    const credential = deps.sessionKey?.();
    if (credential !== sessionCredential) {
      sessionCredential = credential;
      sessionGeneration++;
    }
    return (
      generation === sessionGeneration &&
      (!sessionConfigured || sessionOwner === ownerId || (ownerId === "anonymous" && !sessionOwner))
    );
  };
  const requireSession = (ownerId: string, generation: number) => {
    if (!allowed(ownerId, generation))
      throw new Error("The account session changed; deletion is still pending");
  };
  const queues = new Map<string, Promise<unknown>>();
  const enqueue = <T>(ownerId: string, localId: string, task: () => Promise<T>): Promise<T> => {
    const key = `${ownerId}:${localId}`;
    const result = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(task);
    queues.set(key, result);
    void result
      .finally(() => {
        if (queues.get(key) === result) queues.delete(key);
      })
      .catch(() => undefined);
    return result;
  };
  const intent = (ownerId: string, localId: string): CharacterDeletion | undefined => {
    try {
      const value = JSON.parse(deps.storage.getItem(deletionKey(ownerId, localId)) ?? "null");
      if (
        value?.ownerId === ownerId &&
        value?.localId === localId &&
        typeof value.requestedAt === "number"
      )
        return value;
    } catch {
      /* preserve malformed intents */
    }
  };
  const persist = (value: CharacterDeletion) =>
    deps.storage.setItem(deletionKey(value.ownerId, value.localId), JSON.stringify(value));
  const completeDelete = async (value: CharacterDeletion, generation: number) => {
    requireSession(value.ownerId, generation);
    if (value.remoteId) {
      try {
        await deps.delete(value.remoteId);
      } catch (error) {
        if ((error as { status?: number }).status !== 404 || value.awaitingCreate) throw error;
      }
    }
    requireSession(value.ownerId, generation);
    deps.remove(value.localId);
    deps.storage.removeItem(deletionKey(value.ownerId, value.localId));
  };
  const pending = (ownerId: string) => {
    const result: CharacterDeletion[] = [];
    for (let index = 0; index < deps.storage.length; index++) {
      const key = deps.storage.key(index);
      if (!key?.startsWith(`${prefix}${encodeURIComponent(ownerId)}:`)) continue;
      const localId = key.slice(`${prefix}${encodeURIComponent(ownerId)}:`.length);
      const value = intent(ownerId, localId);
      if (value) result.push(value);
    }
    return result;
  };
  return {
    pending,
    cancelDeletion: (ownerId: string, localId: string) => {
      if (queues.has(`${ownerId}:${localId}`) || !deps.record(localId)) return false;
      deps.storage.removeItem(deletionKey(ownerId, localId));
      return true;
    },
    setOwner: (ownerId: string | undefined) => {
      if (
        !sessionConfigured ||
        sessionOwner !== ownerId ||
        sessionCredential !== deps.sessionKey?.()
      ) {
        sessionOwner = ownerId;
        sessionCredential = deps.sessionKey?.();
        sessionGeneration++;
        sessionConfigured = true;
      }
    },
    save: (
      ownerId: string,
      localId: string,
      payload: Payload,
      stillAuthenticated: () => boolean,
    ) => {
      const generation = sessionGeneration;
      return enqueue(ownerId, localId, async () => {
        if (!stillAuthenticated() || !allowed(ownerId, generation)) return false;
        if (intent(ownerId, localId)) return true;
        const record = deps.record(localId);
        if (!record) return true;
        const creationId = record.id ? undefined : deps.creationId(localId);
        let result = record.id
          ? await deps.update(record.id, { ...payload, version: record.version ?? 1 })
          : await deps.create({ ...payload, version: 1, creationId });
        if (
          !record.id &&
          result.data &&
          JSON.stringify(result.data) !== JSON.stringify(payload.data) &&
          allowed(ownerId, generation) &&
          deps.record(localId) &&
          !intent(ownerId, localId)
        ) {
          // An idempotent POST retry may return the prior accepted payload. Mark
          // that real baseline, then save the newer draft with its revision.
          deps.acknowledge(localId, result.id, result.version, JSON.stringify(result.data));
          result = await deps.update(result.id, { ...payload, version: result.version });
        }
        const deletion = intent(ownerId, localId);
        if (deletion) persist({ ...deletion, remoteId: result.id, awaitingCreate: false });
        if (!deps.record(localId)) {
          const orphan = deletion ?? {
            ownerId,
            localId,
            remoteId: result.id,
            requestedAt: Date.now(),
          };
          persist({ ...orphan, remoteId: result.id });
          await completeDelete({ ...orphan, remoteId: result.id }, generation);
        } else if (allowed(ownerId, generation))
          deps.acknowledge(localId, result.id, result.version, JSON.stringify(payload.data));
        return allowed(ownerId, generation);
      });
    },
    delete: (ownerId: string, localId: string) => {
      const generation = sessionGeneration;
      const record = deps.record(localId);
      persist(
        intent(ownerId, localId) ?? {
          ownerId,
          localId,
          remoteId: record?.id ?? (record?.creationId ? `created-${record.creationId}` : undefined),
          awaitingCreate: !record?.id && Boolean(record?.creationId),
          requestedAt: Date.now(),
        },
      );
      return enqueue(ownerId, localId, async () => {
        const deletion = intent(ownerId, localId);
        if (!deletion) return;
        const remoteId = deps.record(localId)?.id ?? deletion.remoteId;
        await completeDelete({ ...deletion, remoteId }, generation);
      });
    },
    retryPending: (ownerId: string) => {
      const generation = sessionGeneration;
      return Promise.allSettled(
        pending(ownerId).map((value) =>
          enqueue(ownerId, value.localId, async () => {
            if (value.remoteId) await completeDelete(value, generation);
            // Unknown ids remain pending: an interrupted create acknowledgement must
            // never turn a deferred deletion into an imported cloud Maven.
          }),
        ),
      );
    },
  };
}
