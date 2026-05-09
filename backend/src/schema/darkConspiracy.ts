import { z } from "zod";

const mysteryRecordSchema = z.object({
  name: z.string().optional().default(""),
  resolution: z.string().optional().default(""),
});

export const darkConspiracyDataSchema = z.object({
  schemaVersion: z.number().optional().default(1),
  title: z.string().optional().default("The Dark Conspiracy"),
  firstVoidClue: z.string().optional().default(""),
  childOfPersephone: z.string().optional().default(""),
  connectedCharactersLayerOne: z.string().optional().default(""),
  layerTwoChecks: z.array(z.boolean()).optional().default([]),
  returningCharacter: z.string().optional().default(""),
  childRevisionLayerTwo: z.string().optional().default(""),
  connectedCharactersLayerTwo: z.string().optional().default(""),
  layerThreeChecks: z.array(z.boolean()).optional().default([]),
  leaderOfTheMidwives: z.string().optional().default(""),
  midwivesGoalRevision: z.string().optional().default(""),
  connectedCharactersLayerThree: z.string().optional().default(""),
  servitors: z.string().optional().default(""),
  finalChildRevision: z.string().optional().default(""),
  mysteries: z.array(mysteryRecordSchema).optional().default([]),
});

export const createDarkConspiracySchema = z.object({
  title: z.string().min(1).max(255),
  data: darkConspiracyDataSchema,
  version: z.number().int().positive().optional().default(1),
});

export const updateDarkConspiracySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  data: darkConspiracyDataSchema.optional(),
  version: z.number().int().positive().optional(),
});

export const darkConspiracyParamsSchema = z.object({
  id: z.string().min(1),
});

export type CreateDarkConspiracyInput = z.infer<typeof createDarkConspiracySchema>;
export type UpdateDarkConspiracyInput = z.infer<typeof updateDarkConspiracySchema>;
export type DarkConspiracyParams = z.infer<typeof darkConspiracyParamsSchema>;
