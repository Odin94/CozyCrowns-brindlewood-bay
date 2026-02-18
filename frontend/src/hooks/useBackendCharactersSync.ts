import { useEffect, useRef } from "react"
import { api } from "@/utils/api"
import { useAuth } from "./useAuth"
import { useCharacterStore, type BackendCharacter } from "@/lib/character_store"

export const useBackendCharactersSync = () => {
    const { isAuthenticated, user } = useAuth()
    const characterStore = useCharacterStore()
    const hasSyncedRef = useRef(false)
    const syncedUserIdRef = useRef<string | null>(null)

    useEffect(() => {
        if (!isAuthenticated || !user) {
            hasSyncedRef.current = false
            syncedUserIdRef.current = null
            return
        }

        if (hasSyncedRef.current && syncedUserIdRef.current === user.id) {
            return
        }

        const syncCharacters = async () => {
            try {
                const response = await api.getCharacters()

                const backendCharacters: BackendCharacter[] = response.characters
                    .filter((character) => character.owned)
                    .map((character) => ({
                        id: character.id,
                        version: character.version,
                        data: character.data,
                    }))

                if (backendCharacters.length > 0) {
                    characterStore.syncCharactersFromBackend(backendCharacters)
                }

                hasSyncedRef.current = true
                syncedUserIdRef.current = user.id
            } catch (error) {
                console.error("Failed to sync characters from backend:", error)
            }
        }

        void syncCharacters()
        // Can't include character store here, or else we infinite-loop
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, user?.id])
}
