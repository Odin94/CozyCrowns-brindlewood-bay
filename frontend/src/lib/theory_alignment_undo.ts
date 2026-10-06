import type { AccountScope } from "./account_scope.ts";

type Position = { id: string; x: number; y: number; version: number };

/** Undo only the exact successful arrangement in the same authenticated lifetime. */
export function theoryAlignmentUndoPositions(
  before: readonly Position[],
  aligned: readonly Position[],
  current: readonly Position[],
  owner: AccountScope,
  currentOwner: AccountScope,
): Position[] | null {
  if (
    !owner.accountId ||
    owner.accountId !== currentOwner.accountId ||
    owner.generation !== currentOwner.generation ||
    currentOwner.revalidating ||
    currentOwner.signingOut ||
    before.length !== aligned.length ||
    aligned.length !== current.length
  )
    return null;
  const originalById = new Map(before.map((node) => [node.id, node]));
  const currentById = new Map(current.map((node) => [node.id, node]));
  const plan: Position[] = [];
  for (const expected of aligned) {
    const original = originalById.get(expected.id);
    const present = currentById.get(expected.id);
    if (
      !original ||
      !present ||
      present.version !== expected.version ||
      present.x !== expected.x ||
      present.y !== expected.y
    )
      return null;
    plan.push({ id: expected.id, version: present.version, x: original.x, y: original.y });
  }
  return plan;
}
