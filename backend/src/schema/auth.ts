import { z } from "zod"

export const authCallbackQuerySchema = z.object({
    code: z.string().min(1, "Authorization code is required"),
    state: z.string().optional(),
})

export type AuthCallbackQuery = z.infer<typeof authCallbackQuerySchema>
