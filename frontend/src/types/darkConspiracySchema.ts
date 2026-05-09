import { z } from "zod"

export const MysteryRecordSchema = z.object({
    name: z.string().optional().default(""),
    resolution: z.string().optional().default(""),
})

export const DarkConspiracyDataSchema = z.object({
    id: z.string().optional(),
    version: z.number().optional(),
    schemaVersion: z.number().optional().default(1),
    title: z.string().optional().default("The Dark Conspiracy"),
    firstVoidClue: z.string().optional().default(""),
    childOfPersephone: z.string().optional().default(""),
    connectedCharactersLayerOne: z.string().optional().default(""),
    layerTwoChecks: z.array(z.boolean()).optional().default(Array(5).fill(false)),
    returningCharacter: z.string().optional().default(""),
    childRevisionLayerTwo: z.string().optional().default(""),
    connectedCharactersLayerTwo: z.string().optional().default(""),
    layerThreeChecks: z.array(z.boolean()).optional().default(Array(4).fill(false)),
    leaderOfTheMidwives: z.string().optional().default(""),
    midwivesGoalRevision: z.string().optional().default(""),
    connectedCharactersLayerThree: z.string().optional().default(""),
    servitors: z.string().optional().default(""),
    finalChildRevision: z.string().optional().default(""),
    mysteries: z.array(MysteryRecordSchema).optional().default([]),
})

export type DarkConspiracyData = z.infer<typeof DarkConspiracyDataSchema>
