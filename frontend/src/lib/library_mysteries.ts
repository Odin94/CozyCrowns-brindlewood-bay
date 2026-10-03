import type { Mystery } from "../utils/api.ts";
import { isMysteryData } from "./mystery_preservation.ts";

/** Only overlay drafts whose ids were returned in the authenticated account's owned list. */
export function ownedMysteryLibrary(
  mysteries: Mystery[],
  accountId: string,
  storage: Pick<Storage, "getItem">,
): Mystery[] {
  return mysteries.map((mystery) => {
    try {
      const draft = JSON.parse(
        storage.getItem(`cozycrowns-mystery-draft:${accountId}:${mystery.id}`) ?? "null",
      ) as Partial<Mystery> | null;
      if (
        draft?.id === mystery.id &&
        typeof draft.title === "string" &&
        typeof draft.version === "number" &&
        isMysteryData(draft.data)
      )
        return { ...mystery, title: draft.title, data: draft.data };
    } catch {
      // Keep the canonical card available when storage is inaccessible or a draft is malformed.
    }
    return mystery;
  });
}
