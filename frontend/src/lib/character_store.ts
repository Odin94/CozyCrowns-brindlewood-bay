import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Ability, CozyItem } from "@/types/characterSchema"
import { getAdvancementOptions, getCrownsOfTheQueen, getCrownOfTheVoid, getEndOfSessionQuestions } from "@/game_data"
import { t } from "@lingui/core/macro"

export const getDefaultAbilities = (): Ability[] => [
    { name: t`Vitality`, value: 0 },
    { name: t`Composure`, value: 1 },
    { name: t`Reason`, value: 1 },
    { name: t`Presence`, value: 0 },
    { name: t`Sensitivity`, value: -1 },
]

export const getDefaultCharacterData = (): CharacterData => ({
    name: "",
    style: "",
    activity: "",
    abilities: getDefaultAbilities(),
    xp: 0,
    conditions: "",
    endOfSessionChecks: getEndOfSessionQuestions().map(() => false),
    advancementChecks: getAdvancementOptions().map(() => false),
    mavenMoves: "",
    crownChecks: getCrownsOfTheQueen().map(() => false),
    voidChecks: getCrownOfTheVoid().map(() => false),
    cozyItems: Array(12)
        .fill(null)
        .map(() => ({ checked: false, text: "" })),
})

export type CharacterData = {
    id?: string
    version?: number
    schemaVersion?: number
    name: string
    style: string
    activity: string
    abilities: Ability[]
    xp: number
    conditions: string
    endOfSessionChecks: boolean[]
    advancementChecks: boolean[]
    mavenMoves: string
    crownChecks: boolean[]
    voidChecks: boolean[]
    cozyItems: CozyItem[]
}

export type BackendCharacterData = Omit<CharacterData, "id" | "version">

export type BackendCharacter = {
    id: string
    version: number
    data: BackendCharacterData
}

export type CharacterState = {
    characters: CharacterData[]
    currentCharacterIndex: number

    name: string
    style: string
    activity: string
    abilities: Ability[]
    xp: number
    conditions: string
    endOfSessionChecks: boolean[]
    advancementChecks: boolean[]
    mavenMoves: string
    crownChecks: boolean[]
    voidChecks: boolean[]
    cozyItems: CozyItem[]

    setName: (name: string) => void
    setStyle: (style: string) => void
    setActivity: (activity: string) => void
    setAbilities: (abilities: Ability[]) => void
    setXp: (xp: number) => void
    setConditions: (conditions: string) => void
    setEndOfSessionChecks: (checks: boolean[]) => void
    setAdvancementChecks: (checks: boolean[]) => void
    setMavenMoves: (moves: string) => void
    setCrownChecks: (checks: boolean[]) => void
    setVoidChecks: (checks: boolean[]) => void
    setCozyItems: (items: Array<{ checked: boolean; text: string }>) => void

    addCharacter: () => void
    removeCharacter: (index: number) => void
    setCurrentCharacter: (index: number) => void
    getCharacterData: () => CharacterData
    updateCharacterIdAndVersion: (index: number, id: string, version: number) => void
    clearCurrentCharacterIdAndVersion: () => void
    syncCharactersFromBackend: (backendCharacters: BackendCharacter[]) => void
}

export const useCharacterStore = create<CharacterState>()(
    persist(
        (set, get) => {
            const getCurrentCharacter = () => {
                const state = get()
                return state.characters[state.currentCharacterIndex] || getDefaultCharacterData()
            }

            const updateCurrentCharacter = (updates: Partial<CharacterData>) => {
                const state = get()
                const newCharacters = [...state.characters]
                const currentIndex = state.currentCharacterIndex

                if (!newCharacters[currentIndex]) {
                    newCharacters[currentIndex] = getDefaultCharacterData()
                }

                newCharacters[currentIndex] = { ...newCharacters[currentIndex], ...updates }

                // Update the top-level state properties to match the current character
                // top-level state can't be functions because then they don't trigger re-renders
                const updatedCharacter = newCharacters[currentIndex]
                set({
                    characters: newCharacters,
                    name: updatedCharacter.name,
                    style: updatedCharacter.style,
                    activity: updatedCharacter.activity,
                    abilities: updatedCharacter.abilities,
                    xp: updatedCharacter.xp,
                    conditions: updatedCharacter.conditions,
                    endOfSessionChecks: updatedCharacter.endOfSessionChecks,
                    advancementChecks: updatedCharacter.advancementChecks,
                    mavenMoves: updatedCharacter.mavenMoves,
                    crownChecks: updatedCharacter.crownChecks,
                    voidChecks: updatedCharacter.voidChecks,
                    cozyItems: updatedCharacter.cozyItems,
                })
            }

            return {
                characters: [getDefaultCharacterData()],
                currentCharacterIndex: 0,

                name: getDefaultCharacterData().name,
                style: getDefaultCharacterData().style,
                activity: getDefaultCharacterData().activity,
                abilities: getDefaultCharacterData().abilities,
                xp: getDefaultCharacterData().xp,
                conditions: getDefaultCharacterData().conditions,
                endOfSessionChecks: getDefaultCharacterData().endOfSessionChecks,
                advancementChecks: getDefaultCharacterData().advancementChecks,
                mavenMoves: getDefaultCharacterData().mavenMoves,
                crownChecks: getDefaultCharacterData().crownChecks,
                voidChecks: getDefaultCharacterData().voidChecks,
                cozyItems: getDefaultCharacterData().cozyItems,

                setName: (name) => updateCurrentCharacter({ name }),
                setStyle: (style) => updateCurrentCharacter({ style }),
                setActivity: (activity) => updateCurrentCharacter({ activity }),
                setAbilities: (abilities) => updateCurrentCharacter({ abilities }),
                setXp: (xp) => updateCurrentCharacter({ xp }),
                setConditions: (conditions) => updateCurrentCharacter({ conditions }),
                setEndOfSessionChecks: (endOfSessionChecks) => updateCurrentCharacter({ endOfSessionChecks }),
                setAdvancementChecks: (advancementChecks) => updateCurrentCharacter({ advancementChecks }),
                setMavenMoves: (mavenMoves) => updateCurrentCharacter({ mavenMoves }),
                setCrownChecks: (crownChecks) => updateCurrentCharacter({ crownChecks }),
                setVoidChecks: (voidChecks) => updateCurrentCharacter({ voidChecks }),
                setCozyItems: (cozyItems) => updateCurrentCharacter({ cozyItems }),

                addCharacter: () => {
                    const state = get()
                    const newCharacter = getDefaultCharacterData()
                    set({
                        characters: [...state.characters, newCharacter],
                        currentCharacterIndex: state.characters.length,
                        name: newCharacter.name,
                        style: newCharacter.style,
                        activity: newCharacter.activity,
                        abilities: newCharacter.abilities,
                        xp: newCharacter.xp,
                        conditions: newCharacter.conditions,
                        endOfSessionChecks: newCharacter.endOfSessionChecks,
                        advancementChecks: newCharacter.advancementChecks,
                        mavenMoves: newCharacter.mavenMoves,
                        crownChecks: newCharacter.crownChecks,
                        voidChecks: newCharacter.voidChecks,
                        cozyItems: newCharacter.cozyItems,
                    })
                },
                removeCharacter: (index) => {
                    const state = get()
                    const newCharacters = state.characters.filter((_, i) => i !== index)
                    const newIndex = Math.min(state.currentCharacterIndex, newCharacters.length - 1)
                    const character = newCharacters[newIndex] || getDefaultCharacterData()
                    set({
                        characters: newCharacters,
                        currentCharacterIndex: Math.max(0, newIndex),
                        name: character.name,
                        style: character.style,
                        activity: character.activity,
                        abilities: character.abilities,
                        xp: character.xp,
                        conditions: character.conditions,
                        endOfSessionChecks: character.endOfSessionChecks,
                        advancementChecks: character.advancementChecks,
                        mavenMoves: character.mavenMoves,
                        crownChecks: character.crownChecks,
                        voidChecks: character.voidChecks,
                        cozyItems: character.cozyItems,
                    })
                },
                setCurrentCharacter: (index) => {
                    const state = get()
                    if (index >= 0 && index < state.characters.length) {
                        const character = state.characters[index] || getDefaultCharacterData()
                        set({
                            currentCharacterIndex: index,
                            name: character.name,
                            style: character.style,
                            activity: character.activity,
                            abilities: character.abilities,
                            xp: character.xp,
                            conditions: character.conditions,
                            endOfSessionChecks: character.endOfSessionChecks,
                            advancementChecks: character.advancementChecks,
                            mavenMoves: character.mavenMoves,
                            crownChecks: character.crownChecks,
                            voidChecks: character.voidChecks,
                            cozyItems: character.cozyItems,
                        })
                    }
                },
                getCharacterData: () => getCurrentCharacter(),
                updateCharacterIdAndVersion: (index, id, version) => {
                    const state = get()
                    const newCharacters = [...state.characters]
                    if (newCharacters[index]) {
                        newCharacters[index] = { ...newCharacters[index], id, version }
                        set({ characters: newCharacters })
                    }
                },
                clearCurrentCharacterIdAndVersion: () => {
                    const state = get()
                    const newCharacters = [...state.characters]
                    const currentIndex = state.currentCharacterIndex
                    if (newCharacters[currentIndex]) {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { id, version, ...rest } = newCharacters[currentIndex]
                        newCharacters[currentIndex] = rest as CharacterData
                        set({ characters: newCharacters })
                    }
                },
                syncCharactersFromBackend: (backendCharacters) => {
                    const state = get()
                    const existingCharacters = state.characters
                    const updatedCharacters = [...existingCharacters]

                    backendCharacters.forEach((backendCharacter) => {
                        const existingIndex = updatedCharacters.findIndex(
                            (character) => character.id === backendCharacter.id,
                        )

                        if (existingIndex === -1) {
                            const defaultCharacter = getDefaultCharacterData()
                            updatedCharacters.push({
                                ...defaultCharacter,
                                ...backendCharacter.data,
                                id: backendCharacter.id,
                                version: backendCharacter.version,
                            })
                        } else {
                            const existingCharacter = updatedCharacters[existingIndex]
                            const existingVersion = existingCharacter.version ?? 0

                            if (backendCharacter.version > existingVersion) {
                                updatedCharacters[existingIndex] = {
                                    ...existingCharacter,
                                    ...backendCharacter.data,
                                    id: backendCharacter.id,
                                    version: backendCharacter.version,
                                }
                            }
                        }
                    })

                    const newIndex = Math.min(state.currentCharacterIndex, updatedCharacters.length - 1)
                    const currentCharacter = updatedCharacters[newIndex] || getDefaultCharacterData()

                    set({
                        characters: updatedCharacters,
                        currentCharacterIndex: Math.max(0, newIndex),
                        name: currentCharacter.name,
                        style: currentCharacter.style,
                        activity: currentCharacter.activity,
                        abilities: currentCharacter.abilities,
                        xp: currentCharacter.xp,
                        conditions: currentCharacter.conditions,
                        endOfSessionChecks: currentCharacter.endOfSessionChecks,
                        advancementChecks: currentCharacter.advancementChecks,
                        mavenMoves: currentCharacter.mavenMoves,
                        crownChecks: currentCharacter.crownChecks,
                        voidChecks: currentCharacter.voidChecks,
                        cozyItems: currentCharacter.cozyItems,
                    })
                },
            }
        },
        {
            name: "cozycrowns-character-storage",
        },
    ),
)
