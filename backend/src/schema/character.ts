import { z } from "zod";

export const abilitySchema = z.object({
  name: z.string(),
  value: z.number(),
});

export const cozyItemSchema = z.object({
  checked: z.boolean(),
  text: z.string(),
});

const defaultAbilities = () => [
  { name: "Vitality", value: 0 },
  { name: "Composure", value: 1 },
  { name: "Reason", value: 1 },
  { name: "Presence", value: 0 },
  { name: "Sensitivity", value: -1 },
];

const defaultChecks = (length: number) => Array.from({ length }, () => false);
const defaultCozyItems = () => Array.from({ length: 12 }, () => ({ checked: false, text: "" }));

export const characterDataSchema = z.object({
  name: z.string().optional().default(""),
  style: z.string().optional().default(""),
  activity: z.string().optional().default(""),
  abilities: z.array(abilitySchema).min(1).optional().default(defaultAbilities),
  xp: z.number().optional().default(0),
  conditions: z.string().optional().default(""),
  endOfSessionChecks: z
    .array(z.boolean())
    .length(7)
    .optional()
    .default(() => defaultChecks(7)),
  advancementChecks: z
    .array(z.boolean())
    .length(5)
    .optional()
    .default(() => defaultChecks(5)),
  mavenMoves: z.string().optional().default(""),
  crownChecks: z
    .array(z.boolean())
    .length(7)
    .optional()
    .default(() => defaultChecks(7)),
  voidChecks: z
    .array(z.boolean())
    .length(5)
    .optional()
    .default(() => defaultChecks(5)),
  cozyItems: z.array(cozyItemSchema).length(12).optional().default(defaultCozyItems),
});

export const createCharacterSchema = z.object({
  name: z.string().min(1).max(255),
  data: characterDataSchema,
  version: z.number().int().positive().optional().default(1),
});

export const updateCharacterSchema = z.object({
  name: z.string().max(255).optional(),
  data: characterDataSchema.optional(),
  version: z.number().int().positive(),
});

export const characterParamsSchema = z.object({
  id: z.string().min(1),
});

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;
export type CharacterParams = z.infer<typeof characterParamsSchema>;
