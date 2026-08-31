import { useCharacterStore } from "@/lib/character_store";
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

    const characterData = characterStore.getCharacterData();
    const currentIndex = characterStore.currentCharacterIndex;
    const currentCharacter = characterStore.characters[currentIndex];

    if (!characterData.name.trim()) {
      return true;
    }

    const characterPayload = {
      name: characterData.name,
      data: {
        name: characterData.name,
        style: characterData.style,
        activity: characterData.activity,
        abilities: characterData.abilities,
        xp: characterData.xp,
        conditions: characterData.conditions,
        endOfSessionChecks: characterData.endOfSessionChecks,
        advancementChecks: characterData.advancementChecks,
        mavenMoves: characterData.mavenMoves,
        crownChecks: characterData.crownChecks,
        voidChecks: characterData.voidChecks,
        cozyItems: characterData.cozyItems,
      },
    };
    const characterKey = currentCharacter?.id ?? `local:${user.id}:${currentIndex}`;

    const task = async (): Promise<boolean> => {
      try {
        const latestCharacter = characterStore.characters[currentIndex];
        const version =
          latestVersionByCharacter.current.get(characterKey) ?? latestCharacter?.version ?? 1;

        const result = latestCharacter?.id
          ? await api.updateCharacter(latestCharacter.id, { ...characterPayload, version })
          : await api.createCharacter({ ...characterPayload, version });
        characterStore.updateCharacterIdAndVersion(currentIndex, result.id, result.version);
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
