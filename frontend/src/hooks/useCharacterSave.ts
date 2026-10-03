import { useCharacterStore } from "@/lib/character_store";
import { toPersistedCharacter } from "@/lib/character_document";
import { characterCoordinator } from "@/lib/character_sync_runtime";
import { t } from "@lingui/core/macro";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "./useAuth";

export const useCharacterSave = () => {
  const { user, isAuthenticated, loading } = useAuth();
  if (!loading) characterCoordinator.setOwner(user?.id);
  const currentOwner = useRef(user?.id);
  currentOwner.current = user?.id;

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
    const task = async (): Promise<boolean> => {
      try {
        return await characterCoordinator.save(
          user.id,
          localId,
          characterPayload,
          () => currentOwner.current === user.id,
        );
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

    return task();
  }, [isAuthenticated, user]);

  return {
    saveCurrentCharacter,
  };
};
