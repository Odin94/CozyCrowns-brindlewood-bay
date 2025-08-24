import { z } from "zod"
import { getAdvancementOptions, getCrownOfTheVoid, getEndOfSessionQuestions } from "@/game_data"
import { getDefaultAbilities } from "@/lib/character_store"

export const AbilitySchema = z.object({
    name: z.string(),
    value: z.number(),
})

export const CozyItemSchema = z.object({
    checked: z.boolean(),
    text: z.string(),
})

export const CharacterDataSchema = z.object({
    name: z.string().optional().default(""),
    style: z.string().optional().default(""),
    activity: z.string().optional().default(""),
    abilities: z.array(AbilitySchema).optional().default(getDefaultAbilities()),
    xp: z.number().optional().default(0),
    conditions: z.string().optional().default(""),
    endOfSessionChecks: z
        .array(z.boolean())
        .optional()
        .default(getEndOfSessionQuestions().map(() => false)),
    advancementChecks: z
        .array(z.boolean())
        .optional()
        .default(getAdvancementOptions().map(() => false)),
    mavenMoves: z.string().optional().default(""),
    crownChecks: z
        .array(z.boolean())
        .optional()
        .default(getCrownOfTheVoid().map(() => false)),
    voidChecks: z
        .array(z.boolean())
        .optional()
        .default(getCrownOfTheVoid().map(() => false)),
    cozyItems: z.array(CozyItemSchema).optional().default([]),
})

export type Ability = z.infer<typeof AbilitySchema>
export type CozyItem = z.infer<typeof CozyItemSchema>
export type CharacterData = z.infer<typeof CharacterDataSchema>
