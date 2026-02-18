import { useCharacterStore } from "@/lib/character_store"
import { api } from "@/utils/api"
import { useAuth } from "./useAuth"

export const useCharacterSave = () => {
    const { user, isAuthenticated } = useAuth()
    const characterStore = useCharacterStore()

    const saveCurrentCharacter = async (): Promise<boolean> => {
        if (!isAuthenticated || !user) {
            return true
        }

        try {
            const characterData = characterStore.getCharacterData()
            const currentIndex = characterStore.currentCharacterIndex
            const currentCharacter = characterStore.characters[currentIndex]

            if (!characterData.name.trim()) {
                return true
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
            }

            if (currentCharacter?.id) {
                const result = await api.updateCharacter(currentCharacter.id, characterPayload)
                characterStore.updateCharacterIdAndVersion(currentIndex, result.id, result.version)
            } else {
                const result = await api.createCharacter(characterPayload)
                characterStore.updateCharacterIdAndVersion(currentIndex, result.id, result.version)
            }

            return true
        } catch (error) {
            console.error("Failed to save character:", error)
            return false
        }
    }

    return {
        saveCurrentCharacter,
    }
}
