import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Ability } from "@/types/character"
import { advancementOptions, crownsOfTheQueen, crownOfTheVoid, endOfSessionQuestions } from "@/game_data"

interface CharacterState {
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

    cozyItems: Array<{ checked: boolean; text: string }>

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
}

export const useCharacterStore = create<CharacterState>()(
    persist(
        (set) => ({
            name: "",
            style: "",
            activity: "",
            abilities: [
                { name: "Vitality", value: 0 },
                { name: "Composure", value: 0 },
                { name: "Reason", value: 0 },
                { name: "Presence", value: 0 },
                { name: "Sensitivity", value: 0 },
            ],
            xp: 0,
            conditions: "",
            endOfSessionChecks: endOfSessionQuestions.map(() => false),
            advancementChecks: advancementOptions.map(() => false),
            mavenMoves: "",
            crownChecks: crownsOfTheQueen.map(() => false),
            voidChecks: crownOfTheVoid.map(() => false),
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
        }),
        {
            name: "cozycrowns-character-storage",
        }
    )
)
