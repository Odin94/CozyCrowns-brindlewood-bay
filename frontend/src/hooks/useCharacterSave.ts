import { useCallback, useSyncExternalStore } from "react";
import { useCharacterStore } from "@/lib/character_store";
import { mavenPersistence } from "@/lib/maven_runtime";
import { accountScope } from "@/lib/account_scope";

export const useCharacterSave = () => {
  const session = useSyncExternalStore(accountScope.subscribe, accountScope.current);
  const saveCurrentCharacter = useCallback(() => {
    const current = accountScope.current();
    if (
      current.accountId !== session.accountId ||
      current.generation !== session.generation ||
      current.revalidating ||
      current.signingOut
    )
      return Promise.resolve(false);
    return mavenPersistence.save(useCharacterStore.getState().selectedCharacterId);
  }, [session]);
  // A verified session gives autosave callers a new callback so paused dirty work
  // is scheduled again, even when the document's content has not changed.
  return { saveCurrentCharacter };
};
