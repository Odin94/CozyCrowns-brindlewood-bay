import type { FastifyRequest, FastifyReply } from "fastify"
import { nanoid } from "nanoid"
import { env } from "../config/env.js"

const CSRF_TOKEN_COOKIE_NAME = "csrf-token"
export const CSRF_TOKEN_HEADER_NAME = "x-csrf-token"

export const generateCsrfToken = (): string => {
    return nanoid(32)
}

export const setCsrfToken = (reply: FastifyReply, token: string, request: FastifyRequest): void => {
    const origin = request.headers.origin
    let domain: string | undefined

    if (origin) {
        if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
            domain = undefined
        }
    }

    reply.setCookie(CSRF_TOKEN_COOKIE_NAME, token, {
        httpOnly: false,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
        domain: env.NODE_ENV === "production" ? domain : undefined,
    })
}

export const validateCsrfToken = async (request: FastifyRequest, reply: FastifyReply): Promise<boolean> => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        return true
    }

    if (request.url === "/health" || request.url.startsWith("/metrics")) {
        return true
    }

    const cookieToken = request.cookies[CSRF_TOKEN_COOKIE_NAME]
    const headerToken = request.headers[CSRF_TOKEN_HEADER_NAME] as string | undefined

    if (!cookieToken || !headerToken) {
        const error = new Error("CSRF token missing") as Error & { statusCode?: number }
        error.statusCode = 403
        reply.code(403)
        throw error
    }

    if (cookieToken !== headerToken) {
        const error = new Error("CSRF token mismatch") as Error & { statusCode?: number }
        error.statusCode = 403
        reply.code(403)
        throw error
    }

    return true
}
