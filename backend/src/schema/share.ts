import { z } from "zod"

export const createShareSchema = z.object({
    email: z.string().email(),
})

export const characterParamsSchema = z.object({
    id: z.string().min(1),
})

export const shareParamsSchema = z.object({
    id: z.string().min(1),
    shareId: z.string().min(1),
})

export type CreateShareInput = z.infer<typeof createShareSchema>
export type CharacterParams = z.infer<typeof characterParamsSchema>
export type ShareParams = z.infer<typeof shareParamsSchema>
