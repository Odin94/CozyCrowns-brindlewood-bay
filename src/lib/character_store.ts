import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Ability, CharacterData, CozyItem } from "@/types/characterSchema"
import { getAdvancementOptions, getCrownsOfTheQueen, getCrownOfTheVoid, getEndOfSessionQuestions } from "@/game_data"
import { t } from "@lingui/core/macro"

export const getDefaultAbilities = (): Ability[] => [
    { name: t`Vitality`, value: 0 },
    { name: t`Composure`, value: 1 },
    { name: t`Reason`, value: 1 },
    { name: t`Presence`, value: 0 },
    { name: t`Sensitivity`, value: -1 },
]

export type CharacterState = {
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
    getCharacterData: () => CharacterData
}

export const useCharacterStore = create<CharacterState>()(
    persist(
        (set, get) => ({
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

            setName: (name) => set({ name }),
            setStyle: (style) => set({ style }),
            setActivity: (activity) => set({ activity }),
            setAbilities: (abilities) => set({ abilities }),
            setXp: (xp) => set({ xp }),
            setConditions: (conditions) => set({ conditions }),
            setEndOfSessionChecks: (endOfSessionChecks) => set({ endOfSessionChecks }),
            setAdvancementChecks: (advancementChecks) => set({ advancementChecks }),
            setMavenMoves: (mavenMoves) => set({ mavenMoves }),
            setCrownChecks: (crownChecks) => set({ crownChecks }),
            setVoidChecks: (voidChecks) => set({ voidChecks }),
            setCozyItems: (cozyItems) => set({ cozyItems }),
            getCharacterData: (): CharacterData => get(),
        }),
        {
            name: "cozycrowns-character-storage",
        }
    )
)
