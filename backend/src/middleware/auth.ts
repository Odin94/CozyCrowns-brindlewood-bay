import type { FastifyRequest, FastifyReply } from "fastify"
import { workos } from "../config/workos.js"
import { env } from "../config/env.js"

declare module "fastify" {
    interface FastifyRequest {
        user?: {
            id: string
            email: string
            firstName: string | null
            lastName: string | null
        }
        userId?: string
    }
}

export type AuthenticatedRequest = FastifyRequest & {
    user?: {
        id: string
        email: string
        firstName: string | null
        lastName: string | null
    }
}

export const authenticateUser = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const cookiePassword = env.WORKOS_COOKIE_PASSWORD
    if (!cookiePassword) {
        reply.code(500).send({
            error: "Internal server error",
            message: "WORKOS_COOKIE_PASSWORD is not configured",
        })
        return
    }

    const sessionData = request.cookies["wos-session"]

    if (!sessionData) {
        reply.code(401).send({
            error: "Unauthorized",
            message: "No session found",
        })
        return
    }

    try {
        const session = workos.userManagement.loadSealedSession({
            sessionData,
            cookiePassword,
        })

        const authResult = await session.authenticate()

        if (!authResult.authenticated || !("user" in authResult)) {
            try {
                const refreshResult = await session.refresh()
                if (
                    refreshResult.authenticated &&
                    "sealedSession" in refreshResult &&
                    "user" in refreshResult &&
                    refreshResult.sealedSession
                ) {
                    reply.setCookie("wos-session", refreshResult.sealedSession, {
                        path: "/",
                        httpOnly: true,
                        secure: env.NODE_ENV === "production",
                        sameSite: (env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
                    })

                    request.user = refreshResult.user
                    request.userId = refreshResult.user.id
                    return
                }
            } catch (_refreshError) {
                // Refresh failed, continue to unauthorized
            }

            reply.code(401).send({
                error: "Unauthorized",
                message: "Session is invalid",
            })
            return
        }

        if ("user" in authResult) {
            request.user = authResult.user
            request.userId = authResult.user.id
        } else {
            reply.code(401).send({
                error: "Unauthorized",
                message: "Session is invalid",
            })
        }
    } catch (error) {
        reply.code(401).send({
            error: "Unauthorized",
            message: "Failed to authenticate session",
        })
    }
}
