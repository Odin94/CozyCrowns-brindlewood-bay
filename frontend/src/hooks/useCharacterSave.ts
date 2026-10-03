import { useCharacterStore } from "@/lib/character_store";
import { toPersistedCharacter } from "@/lib/character_document";
import { api } from "@/utils/api";
import { t } from "@lingui/core/macro";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "./useAuth";

export const useCharacterSave = () => {
  const { user, isAuthenticated } = useAuth();
  const saveQueue = useRef<Promise<boolean>>(Promise.resolve(true));
  const latestVersionByCharacter = useRef(new Map<string, number>());

  const saveCurrentCharacter = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated || !user) {
      return true;
    }

    const characterStore = useCharacterStore.getState();
    const currentCharacter = characterStore.selected();
    const localId = currentCharacter.localId;

    if (!currentCharacter.name.trim() && !currentCharacter.id) {
      return true;
    }

    const characterPayload = {
      name: currentCharacter.name,
      data: toPersistedCharacter(currentCharacter),
    };
    const characterKey = currentCharacter.id ?? `local:${user.id}:${currentCharacter.localId}`;

    const task = async (): Promise<boolean> => {
      try {
        const latestCharacter = characterStore.record(localId);
        if (!latestCharacter || (!latestCharacter.name.trim() && !latestCharacter.id)) return true;
        const version =
          latestVersionByCharacter.current.get(characterKey) ?? latestCharacter?.version ?? 1;

        const result = latestCharacter?.id
          ? await api.updateCharacter(latestCharacter.id, { ...characterPayload, version })
          : await api.createCharacter({ ...characterPayload, version });
        characterStore.updateRemoteVersion(localId, result.id, result.version);
        latestVersionByCharacter.current.set(characterKey, result.version);

        return true;
      } catch (error) {
        console.error("Failed to save character:", error);
        if ((error as Error & { status?: number }).status === 409) {
          toast.error(t`This Maven changed elsewhere. Your edits are still here.`, {
            action: {
              label: t`Reload`,
              onClick: () => window.location.reload(),
            },
          });
        }
        return false;
      }
    };

    saveQueue.current = saveQueue.current.catch(() => false).then(task);
    return saveQueue.current;
  }, [isAuthenticated, user]);

  return {
    saveCurrentCharacter,
  };
};
