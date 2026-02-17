import type { FastifyRequest, FastifyReply } from "fastify"
import { getSessionFromRequest } from "../utils/workos.js"

declare module "fastify" {
    interface FastifyRequest {
        userId?: string
    }
}

export const authenticateUser = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const auth = await getSessionFromRequest(request)
    if (!auth || !auth.user) {
        reply.code(401)
        throw new Error("Unauthorized")
    }
    request.userId = auth.user.id
}
