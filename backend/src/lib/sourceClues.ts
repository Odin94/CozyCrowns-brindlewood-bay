export type SourceClue = { sourceClueId: string; text: string; isVoid: boolean };
type SourceData = {
  clues: Array<{ id?: string; title: string; description: string }>;
  voidClues: Array<{ id?: string; title: string; description: string }>;
};
export const sourceClues = (data: SourceData): SourceClue[] =>
  [
    ...data.clues.map((clue, index) => ({
      sourceClueId: clue.id ?? `legacy:clue:${index}`,
      text: [clue.title.trim(), clue.description.trim()].filter(Boolean).join(" — "),
      isVoid: false,
    })),
    ...data.voidClues.map((clue, index) => ({
      sourceClueId: clue.id ?? `legacy:void:${index}`,
      text: [clue.title.trim(), clue.description.trim()].filter(Boolean).join(" — "),
      isVoid: true,
    })),
  ].filter((clue) => clue.text);

/** Upgrade old links against the OLD source document before matching new text.
 * Consume duplicate display strings once, preserving every existing clue and
 * board identity. Identical historic entries have no recoverable ordering;
 * assign them deterministically once. */
export function reconcileSourceClues<
  T extends { id: string; text: string; isVoid: boolean; sourceClueId: string | null },
>(existing: T[], before: SourceClue[], after: SourceClue[]) {
  const unclaimed = [...before];
  const linked = existing.map((clue) => {
    const index = unclaimed.findIndex((entry) =>
      clue.sourceClueId
        ? entry.sourceClueId === clue.sourceClueId && entry.isVoid === clue.isVoid
        : entry.text === clue.text && entry.isVoid === clue.isVoid,
    );
    const source = index >= 0 ? unclaimed.splice(index, 1)[0] : undefined;
    return { ...clue, sourceClueId: clue.sourceClueId ?? source?.sourceClueId ?? null };
  });
  const updates: Array<T & { sourceClueId: string }> = [];
  const inserts: SourceClue[] = [];
  for (const source of after) {
    const index = linked.findIndex(
      (clue) => clue.sourceClueId === source.sourceClueId && clue.isVoid === source.isVoid,
    );
    if (index < 0) inserts.push(source);
    else updates.push({ ...linked.splice(index, 1)[0], ...source });
  }
  // Removed source clues remain as Book Club history instead of cascading away
  // discoveries, node positions, tags, and theory connections.
  return { updates, inserts, retained: linked };
}
