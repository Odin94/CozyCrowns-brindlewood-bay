import { z } from "zod"

export const abilitySchema = z.object({
    name: z.string(),
    value: z.number(),
})

export const cozyItemSchema = z.object({
    checked: z.boolean(),
    text: z.string(),
})

export const characterDataSchema = z.object({
    name: z.string().optional().default(""),
    style: z.string().optional().default(""),
    activity: z.string().optional().default(""),
    abilities: z.array(abilitySchema).optional().default([]),
    xp: z.number().optional().default(0),
    conditions: z.string().optional().default(""),
    endOfSessionChecks: z.array(z.boolean()).optional().default([]),
    advancementChecks: z.array(z.boolean()).optional().default([]),
    mavenMoves: z.string().optional().default(""),
    crownChecks: z.array(z.boolean()).optional().default([]),
    voidChecks: z.array(z.boolean()).optional().default([]),
    cozyItems: z.array(cozyItemSchema).optional().default([]),
})

export const createCharacterSchema = z.object({
    name: z.string().min(1).max(255),
    data: characterDataSchema,
    version: z.number().int().positive().optional().default(1),
})

export const updateCharacterSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    data: characterDataSchema.optional(),
    version: z.number().int().positive().optional(),
})

export const characterParamsSchema = z.object({
    id: z.string().min(1),
})

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>
export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>
export type CharacterParams = z.infer<typeof characterParamsSchema>
