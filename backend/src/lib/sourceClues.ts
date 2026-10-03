import { createHash, randomUUID } from "node:crypto";
export type SourceClue = { sourceClueId: string; text: string; isVoid: boolean };
type Entry = { id?: string; title: string; description: string };
type SourceData = { clues: Entry[]; voidClues: Entry[] };
const clueText = (clue: Entry) =>
  [clue.title.trim(), clue.description.trim()].filter(Boolean).join(" — ");

/** Legacy identities derive from content, never array position. Once a source
 * document is saved, normalizeSourceClueIds persists its identities. */
export const sourceClues = (data: SourceData): SourceClue[] => {
  const occurrences = new Map<string, number>();
  return [
    ...data.clues.map((clue) => ({ clue, isVoid: false })),
    ...data.voidClues.map((clue) => ({ clue, isVoid: true })),
  ]
    .map(({ clue, isVoid }) => {
      const text = clueText(clue);
      const fingerprint = createHash("sha256").update(`${isVoid}:${text}`).digest("hex");
      const occurrence = occurrences.get(fingerprint) ?? 0;
      occurrences.set(fingerprint, occurrence + 1);
      return { sourceClueId: clue.id ?? `legacy:${fingerprint}:${occurrence}`, text, isVoid };
    })
    .filter((clue) => clue.text);
};

export function normalizeSourceClueIds<T extends SourceData>(data: T, previous?: SourceData): T {
  const old = previous ? sourceClues(previous) : [];
  const pending = [...old];
  const entries = [...data.clues, ...data.voidClues];
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(clueText(entry), (counts.get(clueText(entry)) ?? 0) + 1);
  const normalize = (entry: Entry, isVoid: boolean): Entry => {
    if (entry.id) return entry;
    const text = clueText(entry);
    const matches = old.filter((clue) => clue.text === text);
    // An idless duplicate was deleted or inserted: its exact identity cannot
    // be reconstructed. Retain prior progress instead of assigning it to a
    // potentially different surviving entry.
    const ambiguous = matches.length > 1 && matches.length !== counts.get(text);
    const index = ambiguous
      ? -1
      : pending.findIndex((clue) => clue.text === text && clue.isVoid === isVoid);
    const alternate =
      index >= 0 ? index : ambiguous ? -1 : pending.findIndex((clue) => clue.text === text);
    const prior = alternate >= 0 ? pending.splice(alternate, 1)[0] : undefined;
    return { ...entry, id: prior?.sourceClueId ?? randomUUID() };
  };
  return {
    ...data,
    clues: data.clues.map((entry) => normalize(entry, false)),
    voidClues: data.voidClues.map((entry) => normalize(entry, true)),
  };
}

/** Upgrade old Book Club links against the previous source document before
 * matching new descriptions. Source identity survives category changes. */
export function reconcileSourceClues<
  T extends { id: string; text: string; isVoid: boolean; sourceClueId: string | null },
>(existing: T[], before: SourceClue[], after: SourceClue[]) {
  const unclaimed = [...before];
  const linked = existing.map((clue) => {
    const index = unclaimed.findIndex((entry) =>
      clue.sourceClueId
        ? entry.sourceClueId === clue.sourceClueId
        : entry.text === clue.text && entry.isVoid === clue.isVoid,
    );
    const source = index >= 0 ? unclaimed.splice(index, 1)[0] : undefined;
    return { ...clue, sourceClueId: clue.sourceClueId ?? source?.sourceClueId ?? null };
  });
  const updates: Array<T & { sourceClueId: string }> = [];
  const inserts: SourceClue[] = [];
  for (const source of after) {
    const ambiguousLegacy =
      source.sourceClueId.startsWith("legacy:") &&
      before.filter((clue) => clue.text === source.text).length > 1 &&
      before.filter((clue) => clue.text === source.text).length !==
        after.filter((clue) => clue.text === source.text).length;
    const index = ambiguousLegacy
      ? -1
      : linked.findIndex((clue) => clue.sourceClueId === source.sourceClueId);
    if (index < 0)
      inserts.push(ambiguousLegacy ? { ...source, sourceClueId: randomUUID() } : source);
    else updates.push({ ...linked.splice(index, 1)[0], ...source });
  }
  return { updates, inserts, retained: linked };
}

/** Expose the same legacy identities reconciliation uses before a first edit. */
export const readSourceClueIds = <T extends SourceData>(data: T): T =>
  normalizeSourceClueIds(data, data);
