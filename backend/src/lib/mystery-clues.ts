import { mysteryDataSchema, type UpdateMysteryInput } from "../schema/mystery.js";

export const authoredMysteryClues = (data: UpdateMysteryInput["data"]) =>
  [
    ...data.clues.map((clue) => ({
      text: [clue.title.trim(), clue.description.trim()].filter(Boolean).join(" — "),
      sourceEntryId: clue.id || null,
      isVoid: false,
    })),
    ...data.voidClues.map((clue) => ({
      text: [clue.title.trim(), clue.description.trim()].filter(Boolean).join(" — "),
      sourceEntryId: clue.id || null,
      isVoid: true,
    })),
  ].filter((clue) => clue.text);

export function storedMysteryClues(data: string) {
  try {
    const parsed = mysteryDataSchema.safeParse(JSON.parse(data));
    return parsed.success ? authoredMysteryClues(parsed.data) : [];
  } catch {
    return [];
  }
}
