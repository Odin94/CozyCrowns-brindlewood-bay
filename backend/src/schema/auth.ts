import { z } from "zod"

export const authCallbackQuerySchema = z.object({
    code: z.string().min(1),
})

export type AuthCallbackQuery = z.infer<typeof authCallbackQuerySchema>
