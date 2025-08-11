import { z } from "zod"
import { advancementOptions, crownOfTheVoid, endOfSessionQuestions } from "@/game_data"
import { getDefaultAbilities } from "@/store/characterStore"

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
        .default(endOfSessionQuestions.map(() => false)),
    advancementChecks: z
        .array(z.boolean())
        .optional()
        .default(advancementOptions.map(() => false)),
    mavenMoves: z.string().optional().default(""),
    crownChecks: z
        .array(z.boolean())
        .optional()
        .default(crownOfTheVoid.map(() => false)),
    voidChecks: z
        .array(z.boolean())
        .optional()
        .default(crownOfTheVoid.map(() => false)),
    cozyItems: z.array(CozyItemSchema).optional().default([]),
})

export type Ability = z.infer<typeof AbilitySchema>
export type CozyItem = z.infer<typeof CozyItemSchema>
export type CharacterData = z.infer<typeof CharacterDataSchema>
