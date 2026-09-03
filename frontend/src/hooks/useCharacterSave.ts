import { useCharacterStore } from "@/lib/character_store";
import { toPersistedCharacter } from "@/lib/character_document";
import { api } from "@/utils/api";
import { t } from "@lingui/core/macro";
import { useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "./useAuth";

export const useCharacterSave = () => {
  const { user, isAuthenticated } = useAuth();
  const characterStore = useCharacterStore();
  const saveQueue = useRef<Promise<boolean>>(Promise.resolve(true));
  const latestVersionByCharacter = useRef(new Map<string, number>());

  const saveCurrentCharacter = async (): Promise<boolean> => {
    if (!isAuthenticated || !user) {
      return true;
    }

    const currentCharacter = characterStore.selected();

    if (!currentCharacter.name.trim()) {
      return true;
    }

    const characterPayload = {
      name: currentCharacter.name,
      data: toPersistedCharacter(currentCharacter),
    };
    const characterKey = currentCharacter.id ?? `local:${user.id}:${currentCharacter.localId}`;

    const task = async (): Promise<boolean> => {
      try {
        const latestCharacter = characterStore.selected();
        const version =
          latestVersionByCharacter.current.get(characterKey) ?? latestCharacter?.version ?? 1;

        const result = latestCharacter?.id
          ? await api.updateCharacter(latestCharacter.id, { ...characterPayload, version })
          : await api.createCharacter({ ...characterPayload, version });
        characterStore.updateSelectedRemoteVersion(result.id, result.version);
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
  };

  return {
    saveCurrentCharacter,
  };
};
