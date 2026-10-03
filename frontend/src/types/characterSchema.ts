import { z } from "zod";
import {
  createDefaultCharacter,
  normalizeCharacter,
  type Ability,
  type CharacterData,
  type CozyItem,
} from "@/lib/character_document";

export const AbilitySchema = z.object({
  name: z.string(),
  value: z.number(),
});

export const CozyItemSchema = z.object({
  checked: z.boolean(),
  text: z.string(),
});

export const CharacterDataSchema = z
  .object({
    schemaVersion: z.number().optional(),
    name: z.string().optional(),
    style: z.string().optional(),
    activity: z.string().optional(),
    abilities: z.array(AbilitySchema).optional(),
    xp: z.number().optional(),
    conditions: z.string().optional(),
    endOfSessionChecks: z.array(z.boolean()).optional(),
    advancementChecks: z.array(z.boolean()).optional(),
    mavenMoves: z.string().optional(),
    crownChecks: z.array(z.boolean()).optional(),
    voidChecks: z.array(z.boolean()).optional(),
    cozyItems: z.array(CozyItemSchema).optional(),
  })
  .transform(normalizeCharacter);

export { createDefaultCharacter };
export type { Ability, CharacterData, CozyItem };
