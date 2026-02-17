import type { FastifyInstance } from "fastify"
import { workos } from "../utils/workos.js"
import { env } from "../config/env.js"
import { db } from "../db/index.js"
import { users } from "../db/schema.js"
import { eq } from "drizzle-orm"
import { authenticateUser } from "../middleware/auth.js"
import { zodToFastifySchema } from "../utils/zodToFastifySchema.js"
import { authCallbackQuerySchema, type AuthCallbackQuery } from "../schema/auth.js"

export const authRoutes = async (fastify: FastifyInstance) => {
    fastify.get("/auth/me", { preHandler: authenticateUser }, async (request, reply) => {
        const userId = request.userId!

        const dbUser = await db.select().from(users).where(eq(users.id, userId)).limit(1).get()

        if (!dbUser) {
            reply.code(404)
            return { error: "User not found" }
        }

        return {
            user: {
                id: dbUser.id,
                email: dbUser.email,
                firstName: dbUser.firstName,
                lastName: dbUser.lastName,
                nickname: dbUser.nickname,
            },
        }
    })

    fastify.get<{ Querystring: AuthCallbackQuery }>(
        "/auth/callback",
        {
            schema: {
                querystring: zodToFastifySchema(authCallbackQuerySchema),
            },
        },
        async (request, reply) => {
            const { code } = request.query

            try {
                const { user, session } = await workos.userManagement.authenticateWithCode({
                    code,
                    clientId: env.WORKOS_CLIENT_ID,
                })

                reply.setCookie("wos-session-id", session.token, {
                    httpOnly: true,
                    secure: env.NODE_ENV === "production",
                    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
                    path: "/",
                    maxAge: 60 * 60 * 24 * 7,
                })

                let dbUser = await db.select().from(users).where(eq(users.id, user.id)).limit(1).get()

                if (!dbUser) {
                    await db.insert(users).values({
                        id: user.id,
                        email: user.email,
                        firstName: user.firstName || null,
                        lastName: user.lastName || null,
                    })
                } else {
                    await db
                        .update(users)
                        .set({
                            email: user.email,
                            firstName: user.firstName || null,
                            lastName: user.lastName || null,
                            updatedAt: new Date(),
                        })
                        .where(eq(users.id, user.id))
                }

                reply.redirect(env.FRONTEND_URL)
            } catch (error) {
                reply.code(400)
                return { error: "Authentication failed" }
            }
        },
    )

    fastify.post("/auth/signout", { preHandler: authenticateUser }, async (request, reply) => {
        reply.clearCookie("wos-session-id", {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: env.NODE_ENV === "production" ? "none" : "lax",
            path: "/",
        })

        return { success: true }
    })
}
