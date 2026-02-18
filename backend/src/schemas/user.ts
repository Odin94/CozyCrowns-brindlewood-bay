import { z } from "zod"

export const updateUserSchema = z.object({
    nickname: z.string().min(1).max(100).nullable().optional(),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>
