import { characterCoordinator } from "@/lib/character_sync_runtime";
import { useEffect, useRef } from "react";
import { api } from "@/utils/api";
import { useAuth } from "./useAuth";
import { useCharacterStore, type BackendCharacter } from "@/lib/character_store";

export const useBackendCharactersSync = () => {
  const { isAuthenticated, user, loading } = useAuth();
  if (!loading) characterCoordinator.setOwner(user?.id);
  const mergeRemote = useCharacterStore((state) => state.mergeRemote);
  const userId = user?.id;
  const hasSyncedRef = useRef(false);
  const syncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !userId) {
      hasSyncedRef.current = false;
      syncedUserIdRef.current = null;
      return;
    }

    if (hasSyncedRef.current && syncedUserIdRef.current === userId) {
      return;
    }

    const syncCharacters = async () => {
      try {
        const pending = characterCoordinator.pending(userId);
        await characterCoordinator.retryPending(userId);
        if (cancelled) return;
        const response = await api.getCharacters();

        const backendCharacters: BackendCharacter[] = response.characters
          .filter(
            (character) =>
              character.owned && !pending.some((deletion) => deletion.remoteId === character.id),
          )
          .map((character) => ({
            id: character.id,
            version: character.version,
            data: character.data,
          }));

        if (cancelled) {
          return;
        }

        if (backendCharacters.length > 0) {
          mergeRemote(backendCharacters);
        }

        hasSyncedRef.current = true;
        syncedUserIdRef.current = userId;
      } catch (error) {
        console.error("Failed to sync characters from backend:", error);
      }
    };

    void syncCharacters();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, mergeRemote, userId]);
};
