import { z } from "zod";

const text = z.string().max(20_000).optional().default("");
const title = z.string().max(255).optional().default("");

const locationSchema = z.object({
  id: z.string().optional(),
  title,
  description: text,
  prompt: text,
});
const suspectSchema = z.object({
  id: z.string().optional(),
  name: title,
  title,
  description: text,
  quote: text,
});
const clueSchema = z.object({ id: z.string().optional(), title, description: text });
const momentSchema = z.object({ id: z.string().optional(), description: text });

export const mysteryDataSchema = z.object({
  schemaVersion: z.number().int().positive().optional().default(1),
  title: title.default("Untitled Mystery"),
  intro: text,
  establishingQuestions: z.array(text).max(30).optional().default([]),
  complexity: z.number().int().min(1).max(12).optional().default(4),
  locations: z.array(locationSchema).max(100).optional().default([]),
  suspects: z.array(suspectSchema).max(100).optional().default([]),
  clues: z.array(clueSchema).max(200).optional().default([]),
  voidClues: z.array(clueSchema).max(200).optional().default([]),
  moments: z.array(momentSchema).max(100).optional().default([]),
});

export const createMysterySchema = z.object({
  title: z.string().trim().min(1).max(255),
  data: mysteryDataSchema,
});

export const updateMysterySchema = z.object({
  title: z.string().trim().min(1).max(255),
  data: mysteryDataSchema,
  version: z.number().int().positive(),
  saveKind: z.enum(["auto", "manual"]),
});

export const mysteryParamsSchema = z.object({ id: z.string().min(1) });
export const publishedMysteryParamsSchema = z.object({ id: z.string().min(1) });

export type CreateMysteryInput = z.infer<typeof createMysterySchema>;
export type UpdateMysteryInput = z.infer<typeof updateMysterySchema>;
export type MysteryParams = z.infer<typeof mysteryParamsSchema>;
export type PublishedMysteryParams = z.infer<typeof publishedMysteryParamsSchema>;
