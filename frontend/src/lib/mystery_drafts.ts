import type { Mystery } from "../utils/api";
export const mysteryDraftPrefix = "cozycrowns-mystery-draft";
export type MysteryDraft = {
  ownerId?: string;
  mystery: Mystery;
  baseContent?: string;
  baseVersion?: number;
  recoveryId?: string;
};
export const mysteryContent = (mystery: Pick<Mystery, "title" | "data">) =>
  JSON.stringify({ title: mystery.title, data: mystery.data });
const namespace = (ownerId: string) => `${mysteryDraftPrefix}:owner:${encodeURIComponent(ownerId)}`;
const documentKey = (ownerId: string, id: string) => `${namespace(ownerId)}:document:${id}`;
export const isDirtyMysteryDraft = (draft: MysteryDraft) =>
  !draft.baseContent || mysteryContent(draft.mystery) !== draft.baseContent;
const parse = (raw: string | null): MysteryDraft | undefined => {
  if (!raw) return;
  try {
    const value = JSON.parse(raw);
    const draft = "mystery" in value ? value : { mystery: value };
    if (
      typeof draft.mystery?.id === "string" &&
      typeof draft.mystery?.title === "string" &&
      typeof draft.mystery?.version === "number" &&
      draft.mystery?.data &&
      Array.isArray(draft.mystery.data.clues)
    )
      return draft;
  } catch {
    /* preserve malformed drafts unchanged */
  }
};

export function persistMysteryDraft(
  storage: Storage,
  draft: MysteryDraft & { ownerId: string },
  selected = true,
) {
  const key = documentKey(draft.ownerId, draft.mystery.id);
  const previous = parse(storage.getItem(key));
  // Choosing the canonical copy cannot overwrite a different pending draft.
  if (
    !previous ||
    !isDirtyMysteryDraft(previous) ||
    isDirtyMysteryDraft(draft) ||
    mysteryContent(previous.mystery) === mysteryContent(draft.mystery)
  )
    storage.setItem(key, JSON.stringify(draft));
  if (selected) storage.setItem(`${namespace(draft.ownerId)}:selected`, JSON.stringify(draft));
}

export function loadMysteryDrafts(
  storage: Storage,
  ownerId: string,
  ownedIds: Set<string>,
): { selected?: MysteryDraft; drafts: MysteryDraft[] } {
  const drafts = new Map<string, MysteryDraft>();
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(`${namespace(ownerId)}:document:`)) continue;
    const draft = parse(storage.getItem(key));
    if (draft?.ownerId === ownerId) drafts.set(draft.mystery.id, draft);
  }
  // Only claim unscoped legacy data when ownership is independently confirmed
  // by this account's server list. Never upload a foreign or missing legacy id.
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== mysteryDraftPrefix && !key?.startsWith(`${mysteryDraftPrefix}:recovery:`)) continue;
    const legacy = parse(storage.getItem(key));
    if (
      !legacy ||
      (legacy.ownerId && legacy.ownerId !== ownerId) ||
      !ownedIds.has(legacy.mystery.id) ||
      drafts.has(legacy.mystery.id)
    )
      continue;
    const claimed = { ...legacy, ownerId };
    persistMysteryDraft(storage, claimed, false);
    drafts.set(claimed.mystery.id, claimed);
  }
  const selected = parse(storage.getItem(`${namespace(ownerId)}:selected`));
  const legacySelected = parse(storage.getItem(mysteryDraftPrefix));
  const preferred =
    selected?.ownerId === ownerId
      ? selected
      : legacySelected && ownedIds.has(legacySelected.mystery.id)
        ? drafts.get(legacySelected.mystery.id)
        : undefined;
  return {
    selected: preferred && (drafts.get(preferred.mystery.id) ?? preferred),
    drafts: [...drafts.values()],
  };
}

const recoveryRequests = new Map<string, Promise<Mystery>>();
export async function recoverMysteryDraft(
  storage: Storage,
  ownerId: string,
  draft: MysteryDraft,
  title: string,
  create: (payload: {
    title: string;
    data: Mystery["data"];
    recoveryId: string;
  }) => Promise<Mystery>,
): Promise<Mystery> {
  if (draft.ownerId !== ownerId) throw new Error("Cannot recover another account's mystery");
  draft.recoveryId ??= crypto.randomUUID();
  const existing = storedMysteryDraft(storage, ownerId, draft.mystery.id);
  if (!existing || mysteryContent(existing.mystery) === mysteryContent(draft.mystery))
    persistMysteryDraft(storage, { ...draft, ownerId }, false);
  const key = `${ownerId}:${draft.recoveryId}`;
  let request = recoveryRequests.get(key);
  if (!request) {
    request = create({
      title,
      data: { ...draft.mystery.data, title },
      recoveryId: draft.recoveryId,
    });
    recoveryRequests.set(key, request);
    void request.catch(() => {
      recoveryRequests.delete(key);
    });
  }
  return request;
}
export function completeMysteryRecovery(
  storage: Storage,
  ownerId: string,
  draft: MysteryDraft,
  recovered: Mystery,
) {
  const selected = parse(storage.getItem(`${namespace(ownerId)}:selected`));
  const current = storedMysteryDraft(storage, ownerId, draft.mystery.id);
  const unchanged = Boolean(
    current &&
    current.recoveryId === draft.recoveryId &&
    mysteryContent(current.mystery) === mysteryContent(draft.mystery),
  );
  persistMysteryDraft(
    storage,
    {
      ownerId,
      mystery: recovered,
      baseContent: mysteryContent(recovered),
      baseVersion: recovered.version,
    },
    unchanged &&
      selected?.mystery.id === draft.mystery.id &&
      mysteryContent(selected.mystery) === mysteryContent(draft.mystery),
  );
  if (unchanged) storage.removeItem(documentKey(ownerId, draft.mystery.id));
  return unchanged;
}
export function storedMysteryDraft(storage: Storage, ownerId: string, id: string) {
  const draft = parse(storage.getItem(documentKey(ownerId, id)));
  return draft?.ownerId === ownerId ? draft : undefined;
}
export function forgetMysteryDraft(storage: Storage, ownerId: string, id: string) {
  storage.removeItem(documentKey(ownerId, id));
  const selectedKey = `${namespace(ownerId)}:selected`;
  if (parse(storage.getItem(selectedKey))?.mystery.id === id) storage.removeItem(selectedKey);
}
