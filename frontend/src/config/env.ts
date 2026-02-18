import { z } from "zod"

const raw = import.meta.env

const envSchema = z.object({
    VITE_API_URL: z.url().default("http://localhost:3001"),
    VITE_PUBLIC_POSTHOG_KEY: z.string().optional(),
    VITE_PUBLIC_POSTHOG_HOST: z.url().optional().default("https://eu.i.posthog.com"),
})

export type Env = z.infer<typeof envSchema>

const loadEnv = (): Env => {
    try {
        return envSchema.parse({
            VITE_API_URL: raw.VITE_API_URL,
            VITE_PUBLIC_POSTHOG_KEY: raw.VITE_PUBLIC_POSTHOG_KEY,
            VITE_PUBLIC_POSTHOG_HOST: raw.VITE_PUBLIC_POSTHOG_HOST,
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            const missingVars = error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("\n")
            throw new Error(`Environment validation failed:\n${missingVars}`)
        }
        throw error
    }
}

export const env = loadEnv()
