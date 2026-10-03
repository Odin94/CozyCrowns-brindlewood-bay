import {
  loadMysteryDrafts,
  persistMysteryDraft,
  storedMysteryDraft,
  recoverMysteryDraft,
  completeMysteryRecovery,
  forgetMysteryDraft,
  isDirtyMysteryDraft,
  type MysteryDraft,
} from "./mystery_drafts.ts";
import type { Mystery, MysteryData, MysteryVersion } from "../utils/api.ts";
import type { AccountScope } from "./account_scope.ts";

const draftKey = "cozycrowns-mystery-draft";
const snapshot = (mystery: Pick<Mystery, "title" | "data">) =>
  JSON.stringify({ title: mystery.title, data: mystery.data });
const strings = (entries: unknown, fields: string[]) =>
  Array.isArray(entries) &&
  entries.every(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      fields.every((field) => typeof (entry as Record<string, unknown>)[field] === "string"),
  );

export const isMysteryData = (value: unknown): value is MysteryData => {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<MysteryData>;
  if (
    typeof data.schemaVersion !== "number" ||
    typeof data.title !== "string" ||
    typeof data.intro !== "string" ||
    typeof data.complexity !== "number"
  )
    return false;
  if (
    !Array.isArray(data.establishingQuestions) ||
    !data.establishingQuestions.every((question) => typeof question === "string")
  )
    return false;
  return (
    strings(data.locations, ["title", "description", "prompt"]) &&
    strings(data.suspects, ["name", "title", "description", "quote"]) &&
    strings(data.clues, ["title", "description"]) &&
    strings(data.voidClues, ["title", "description"]) &&
    strings(data.moments, ["description"])
  );
};
type Ports = {
  scope: () => AccountScope;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  remote: {
    getMysteries: () => Promise<{ mysteries: Mystery[] }>;
    createMystery: (input: {
      title: string;
      data: MysteryData;
      recoveryId?: string;
    }) => Promise<Mystery>;
    updateMystery: (
      id: string,
      input: { title: string; data: MysteryData; version: number; saveKind: "auto" | "manual" },
    ) => Promise<Mystery>;
    getMysteryVersions: (id: string) => Promise<{ versions: MysteryVersion[] }>;
    deleteMystery: (id: string) => Promise<unknown>;
    restoreMystery: (id: string) => Promise<Mystery>;
    publishMystery: (id: string) => Promise<unknown>;
  };
  untitled: () => string;
  failed: (error: unknown) => void;
  later: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel: (timer: ReturnType<typeof setTimeout>) => void;
};
export type MysterySnapshot = {
  mysteries: Mystery[];
  selected: Mystery | null;
  versions: MysteryVersion[];
  loaded: boolean;
  recoveryDrafts?: MysteryDraft[];
};

/** Owns durable drafts and all operations that consume or replace their contents. */
export class MysteryPreservation {
  private state: MysterySnapshot = { mysteries: [], selected: null, versions: [], loaded: false };
  private ports: Ports;
  private scope: AccountScope;
  private active = true;
  private lifetime = 0;
  private listeners = new Set<() => void>();
  private saved = new Map<string, string>();
  private versions = new Map<string, number>();
  private drafts = new Map<string, Mystery>();
  private editRevisions = new Map<string, number>();
  private queue: Promise<unknown> = Promise.resolve();
  private timer?: ReturnType<typeof setTimeout>;
  private versionRequest = 0;
  constructor(ports: Ports) {
    this.ports = ports;
    this.scope = ports.scope();
  }
  current = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private valid() {
    const scope = this.ports.scope();
    return (
      this.active &&
      !scope.revalidating &&
      !scope.signingOut &&
      scope.accountId === this.scope.accountId &&
      scope.generation === this.scope.generation &&
      !!scope.accountId
    );
  }
  private locallyValid() {
    const scope = this.ports.scope();
    return (
      this.active &&
      !scope.signingOut &&
      scope.accountId === this.scope.accountId &&
      !!scope.accountId
    );
  }
  private emit(change: Partial<MysterySnapshot>) {
    if (!this.locallyValid()) return;
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) listener();
  }
  private durableStorage(): Storage | null {
    const storage = this.ports.storage as Storage;
    return typeof storage.key === "function" && typeof storage.length === "number" ? storage : null;
  }
  async retryRecovery(draft: MysteryDraft): Promise<void> {
    const storage = this.durableStorage();
    if (!storage || !this.valid() || draft.ownerId !== this.scope.accountId) return;
    try {
      const recovered = await recoverMysteryDraft(
        storage,
        this.scope.accountId!,
        draft,
        `${draft.mystery.title.slice(0, 220)} (Recovered draft)`,
        this.ports.remote.createMystery,
      );
      if (!this.valid()) return;
      if (completeMysteryRecovery(storage, this.scope.accountId!, draft, recovered)) {
        this.emit({
          recoveryDrafts: this.state.recoveryDrafts?.filter((entry) => entry !== draft),
          mysteries: [
            recovered,
            ...this.state.mysteries.filter((entry) => entry.id !== recovered.id),
          ],
        });
        this.saved.set(recovered.id, snapshot(recovered));
        this.versions.set(recovered.id, recovered.version);
        if (!this.state.selected || this.state.selected.id === draft.mystery.id)
          this.choose(recovered);
      }
    } catch (error) {
      if (this.valid()) this.ports.failed(error);
    }
  }
  private key(id: string) {
    return `${draftKey}:${this.scope.accountId}:${id}`;
  }
  private read(key: string) {
    try {
      return this.ports.storage.getItem(key);
    } catch (error) {
      this.ports.failed(error);
      return null;
    }
  }
  private retain(mystery: Mystery) {
    this.drafts.set(mystery.id, mystery);
    try {
      this.ports.storage.setItem(this.key(mystery.id), JSON.stringify(mystery));
      const storage = this.durableStorage();
      if (storage && this.scope.accountId)
        persistMysteryDraft(storage, {
          ownerId: this.scope.accountId,
          mystery,
          baseContent: this.saved.get(mystery.id),
          baseVersion: this.versions.get(mystery.id),
        });
    } catch (error) {
      this.ports.failed(error);
    }
  }
  private enqueue<T>(task: () => Promise<T>, cancelled: T): Promise<T> {
    const next = this.queue.catch(() => undefined).then(() => (this.valid() ? task() : cancelled));
    this.queue = next;
    return next;
  }
  private cancelTimer() {
    if (this.timer) this.ports.cancel(this.timer);
    this.timer = undefined;
  }
  private schedule() {
    this.cancelTimer();
    const selected = this.state.selected;
    if (!selected || this.saved.get(selected.id) === snapshot(selected)) return;
    this.timer = this.ports.later(() => {
      this.timer = undefined;
      void this.save("auto");
    }, 2_500);
  }
  /** Keep same-account recovery callbacks while retiring the previous request lifetime. */
  async resumeSession(): Promise<void> {
    const scope = this.ports.scope();
    if (
      !this.active ||
      scope.revalidating ||
      scope.signingOut ||
      !scope.accountId ||
      scope.accountId !== this.scope.accountId ||
      scope.generation === this.scope.generation
    )
      return;
    this.lifetime++;
    await this.queue.catch(() => undefined);
    const current = this.ports.scope();
    if (
      !this.active ||
      current.revalidating ||
      current.signingOut ||
      current.accountId !== scope.accountId ||
      current.generation !== scope.generation
    )
      return;
    this.scope = scope;
    await this.load();
    this.schedule();
    if (this.state.selected) void this.refreshVersions(this.state.selected.id);
  }
  async load(): Promise<void> {
    this.active = true;
    const lifetime = ++this.lifetime;
    try {
      const result = await this.ports.remote.getMysteries();
      if (!this.valid() || lifetime !== this.lifetime) return;
      const storage = this.durableStorage();
      const durable = storage
        ? loadMysteryDrafts(
            storage,
            this.scope.accountId!,
            new Set(result.mysteries.map((entry) => entry.id)),
          )
        : undefined;
      const recoveryDrafts =
        durable?.drafts.filter((draft) => {
          const remote = result.mysteries.find((entry) => entry.id === draft.mystery.id);
          return (
            isDirtyMysteryDraft(draft) &&
            (!remote || (draft.baseVersion ?? draft.mystery.version) !== remote.version)
          );
        }) ?? [];
      this.emit({ recoveryDrafts });
      const legacy = this.read(draftKey);
      let preferredId =
        this.read(`${draftKey}:${this.scope.accountId}:selected`) ??
        durable?.selected?.mystery.id ??
        null;
      try {
        preferredId ??= (JSON.parse(legacy ?? "null") as Mystery | null)?.id ?? null;
      } catch {
        /* Preserve malformed legacy data for recovery. */
      }
      for (const mystery of result.mysteries) {
        this.saved.set(mystery.id, snapshot(mystery));
        this.versions.set(mystery.id, mystery.version);
        const stored = this.read(this.key(mystery.id));
        // Legacy drafts are accepted only if their id occurs in this account's owned list.
        try {
          const reviewDraft = storage
            ? storedMysteryDraft(storage, this.scope.accountId!, mystery.id)
            : undefined;
          const draft =
            reviewDraft && isDirtyMysteryDraft(reviewDraft)
              ? reviewDraft.mystery
              : (JSON.parse(stored ?? legacy ?? "null") as Mystery | null);
          if (
            draft?.id === mystery.id &&
            typeof draft.title === "string" &&
            isMysteryData(draft.data) &&
            typeof draft.version === "number"
          ) {
            // A differing older draft must conflict, rather than overwrite a newer remote version.
            if (snapshot(draft) !== snapshot(mystery)) {
              this.drafts.set(mystery.id, draft);
              this.versions.set(mystery.id, Math.min(draft.version, mystery.version));
            }
          }
        } catch {
          /* Malformed originals remain available for recovery. */
        }
      }
      this.emit({ mysteries: result.mysteries });
      const preferred =
        result.mysteries.find((mystery) => mystery.id === preferredId) ?? result.mysteries[0];
      if (!this.state.selected && preferred) this.choose(preferred);
      for (const draft of recoveryDrafts) {
        if (!this.valid() || lifetime !== this.lifetime) break;
        // eslint-disable-next-line no-await-in-loop -- Reconcile each recovery before choosing the next document.
        await this.retryRecovery(draft);
      }
    } catch (error) {
      if (this.valid()) this.ports.failed(error);
    } finally {
      if (lifetime === this.lifetime) this.emit({ loaded: true });
    }
  }
  /** Explicit conflict recovery archives the draft before adopting the owned canonical row. */
  reload(): Promise<(() => Promise<boolean>) | null> {
    const previous = this.state.selected;
    if (!previous) return Promise.resolve(null);
    this.cancelTimer();
    return this.enqueue(async () => {
      try {
        const result = await this.ports.remote.getMysteries();
        if (!this.valid()) return null;
        const canonical = result.mysteries.find((mystery) => mystery.id === previous.id);
        if (
          !canonical ||
          this.state.selected?.id !== previous.id ||
          snapshot(this.state.selected) !== snapshot(previous)
        )
          return null;
        // Never discard the only copy when browser storage cannot preserve the original.
        this.ports.storage.setItem(`${this.key(previous.id)}:recovery`, JSON.stringify(previous));
        this.saved.set(canonical.id, snapshot(canonical));
        this.versions.set(canonical.id, canonical.version);
        this.retain(canonical);
        this.emit({ mysteries: result.mysteries, selected: canonical });
        void this.refreshVersions(canonical.id);
        return () => {
          const original = this.state.mysteries.find((mystery) => mystery.id === previous.id);
          if (!original || !this.valid()) return Promise.resolve(false);
          if (this.state.selected?.id !== previous.id) this.choose(original);
          return this.restore(previous).then((undo) => !!undo);
        };
      } catch (error) {
        if (this.valid()) this.ports.failed(error);
        return null;
      }
    }, null);
  }
  choose(mystery: Mystery) {
    if (!this.locallyValid()) return;
    this.cancelTimer();
    // Edits to the outgoing mystery remain in durable storage and its queued snapshot.
    const previous = this.state.selected;
    if (previous && this.saved.get(previous.id) !== snapshot(previous)) void this.save("auto");
    if (!this.saved.has(mystery.id)) {
      this.saved.set(mystery.id, snapshot(mystery));
      this.versions.set(mystery.id, mystery.version);
    }
    const selected = this.drafts.get(mystery.id) ?? mystery;
    this.retain(selected);
    try {
      this.ports.storage.setItem(`${draftKey}:${this.scope.accountId}:selected`, mystery.id);
    } catch (error) {
      this.ports.failed(error);
    }
    this.emit({ selected, versions: [] });
    this.schedule();
    void this.refreshVersions(mystery.id);
  }
  edit(updates: Partial<MysteryData> & { title?: string }) {
    const current = this.state.selected;
    if (!current || !this.locallyValid()) return;
    this.editRevisions.set(current.id, (this.editRevisions.get(current.id) ?? 0) + 1);
    const selected = {
      ...current,
      title: updates.title ?? current.title,
      data: { ...current.data, ...updates, title: updates.title ?? current.data.title },
    };
    this.retain(selected);
    this.emit({ selected });
    this.schedule();
  }
  private replaceContent(mystery: Mystery) {
    const current = this.state.selected;
    if (!current || current.id !== mystery.id) return;
    const selected = { ...current, title: mystery.title, data: mystery.data };
    this.retain(selected);
    this.emit({ selected });
    this.schedule();
  }
  private async refreshVersions(id: string) {
    if (this.state.selected?.id !== id) return;
    const request = ++this.versionRequest;
    try {
      const result = await this.ports.remote.getMysteryVersions(id);
      if (this.valid() && request === this.versionRequest && this.state.selected?.id === id)
        this.emit({ versions: result.versions });
    } catch {
      if (request === this.versionRequest && this.state.selected?.id === id)
        this.emit({ versions: [] });
    }
  }
  private async submit(submitted: Mystery, kind: "auto" | "manual"): Promise<Mystery | null> {
    const lifetime = this.lifetime;
    const sent = snapshot(submitted);
    if (kind === "auto" && this.saved.get(submitted.id) === sent) return submitted;
    try {
      const result = await this.ports.remote.updateMystery(submitted.id, {
        title: submitted.title || this.ports.untitled(),
        data: submitted.data,
        version: this.versions.get(submitted.id) ?? submitted.version,
        saveKind: kind,
      });
      if (!this.valid() || lifetime !== this.lifetime) return null;
      this.versions.set(result.id, result.version);
      this.saved.set(result.id, snapshot(result));
      const draft = this.drafts.get(result.id);
      const reconciled =
        draft && snapshot(draft) !== sent ? { ...draft, version: result.version } : result;
      this.retain(reconciled);
      this.emit({
        mysteries: this.state.mysteries.map((mystery) =>
          mystery.id === result.id ? result : mystery,
        ),
        ...(this.state.selected?.id === result.id ? { selected: reconciled } : {}),
      });
      void this.refreshVersions(result.id);
      this.schedule();
      return result;
    } catch (error) {
      if (this.valid()) this.ports.failed(error);
      return null;
    }
  }
  save(kind: "auto" | "manual"): Promise<boolean> {
    this.cancelTimer();
    const submitted = this.state.selected;
    if (!submitted) return Promise.resolve(false);
    return this.enqueue(async () => !!(await this.submit(submitted, kind)), false);
  }
  async create(data: MysteryData): Promise<Mystery | null> {
    return this.enqueue(async () => {
      try {
        const result = await this.ports.remote.createMystery({ title: data.title, data });
        if (!this.valid()) return null;
        this.emit({ mysteries: [result, ...this.state.mysteries] });
        this.choose(result);
        return result;
      } catch (error) {
        this.ports.failed(error);
        return null;
      }
    }, null);
  }
  restore(
    version: Pick<MysteryVersion, "title" | "data">,
  ): Promise<(() => Promise<boolean>) | null> {
    const previous = this.state.selected;
    if (!previous) return Promise.resolve(null);
    const revision = this.editRevisions.get(previous.id) ?? 0;
    this.cancelTimer();
    return this.enqueue(async () => {
      // Preserve the outgoing draft before replacing it with a historical snapshot.
      if (
        !(await this.submit(previous, "auto")) ||
        !this.valid() ||
        this.state.selected?.id !== previous.id ||
        (this.editRevisions.get(previous.id) ?? 0) !== revision
      )
        return null;
      const restored = { ...this.state.selected, title: version.title, data: version.data };
      this.replaceContent(restored);
      this.cancelTimer();
      if (!(await this.submit(restored, "auto"))) {
        if (
          this.state.selected?.id === restored.id &&
          snapshot(this.state.selected) === snapshot(restored)
        )
          this.replaceContent(previous);
        return null;
      }
      return () => {
        const original = this.state.mysteries.find((mystery) => mystery.id === previous.id);
        if (!original || !this.valid()) return Promise.resolve(false);
        if (this.state.selected?.id !== previous.id) this.choose(original);
        return this.restore(previous).then((undo) => !!undo);
      };
    }, null);
  }
  /** Saves and consumes the same document within the queue, even if selection changes. */
  preserve<T>(consume: (saved: Mystery) => Promise<T>): Promise<T | null> {
    const submitted = this.state.selected;
    if (!submitted) return Promise.resolve(null);
    this.cancelTimer();
    return this.enqueue(async () => {
      const saved = await this.submit(submitted, "manual");
      if (!saved || !this.valid()) return null;
      try {
        const result = await consume(saved);
        return this.valid() ? result : null;
      } catch (error) {
        if (this.valid()) this.ports.failed(error);
        return null;
      }
    }, null);
  }
  publish(): Promise<boolean> {
    return this.preserve(async (saved) => {
      await this.ports.remote.publishMystery(saved.id);
      return true;
    }).then(Boolean);
  }
  delete(): Promise<Mystery | null> {
    const selected = this.state.selected;
    if (!selected) return Promise.resolve(null);
    this.cancelTimer();
    return this.enqueue(async () => {
      try {
        if (!(await this.submit(selected, "auto")) || !this.valid()) return null;
        const archive = () => {
          const latest = this.drafts.get(selected.id) ?? selected;
          this.ports.storage.setItem(`${this.key(selected.id)}:deleted`, JSON.stringify(latest));
        };
        // Preserve an undo source before deletion, including edits arriving during the request.
        archive();
        await this.ports.remote.deleteMystery(selected.id);
        if (!this.valid()) return null;
        archive();
        if (this.state.selected?.id === selected.id) this.cancelTimer();
        const mysteries = this.state.mysteries.filter((mystery) => mystery.id !== selected.id);
        this.drafts.delete(selected.id);
        this.saved.delete(selected.id);
        this.versions.delete(selected.id);
        this.ports.storage.removeItem(this.key(selected.id));
        const storage = this.durableStorage();
        if (storage && this.scope.accountId)
          forgetMysteryDraft(storage, this.scope.accountId, selected.id);
        const legacy = this.read(draftKey);
        try {
          if ((JSON.parse(legacy ?? "null") as Mystery | null)?.id === selected.id)
            this.ports.storage.removeItem(draftKey);
        } catch {
          /* Keep malformed legacy data untouched. */
        }
        this.emit({
          mysteries,
          ...(this.state.selected?.id === selected.id ? { selected: null, versions: [] } : {}),
        });
        if (!this.state.selected && mysteries[0]) this.choose(mysteries[0]);
        return selected;
      } catch (error) {
        if (this.valid()) this.ports.failed(error);
        return null;
      }
    }, null);
  }
  undelete(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      try {
        const restored = await this.ports.remote.restoreMystery(id);
        if (!this.valid()) return false;
        this.saved.set(restored.id, snapshot(restored));
        this.versions.set(restored.id, restored.version);
        try {
          const archived = JSON.parse(
            this.read(`${this.key(id)}:deleted`) ?? "null",
          ) as Mystery | null;
          if (
            archived?.id === id &&
            typeof archived.title === "string" &&
            isMysteryData(archived.data)
          )
            this.retain({ ...restored, title: archived.title, data: archived.data });
        } catch {
          // Keep malformed recovery data intact and use the restored canonical row.
        }
        this.emit({
          mysteries: [restored, ...this.state.mysteries.filter((mystery) => mystery.id !== id)],
        });
        this.choose(restored);
        return true;
      } catch (error) {
        if (this.valid()) this.ports.failed(error);
        return false;
      }
    }, false);
  }
  dispose() {
    this.cancelTimer();
    this.lifetime++;
    this.active = false;
  }
}
