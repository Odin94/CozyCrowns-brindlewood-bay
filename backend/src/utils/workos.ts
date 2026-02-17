import { WorkOS } from "@workos-inc/node"
import { env } from "../config/env.js"

export const workos = new WorkOS(env.WORKOS_API_KEY)

export const getSessionFromRequest = async (request: any): Promise<{ user: any; session: any } | null> => {
    try {
        const sessionId = request.cookies["wos-session-id"]
        if (!sessionId) {
            return null
        }

        const { user, session } = await workos.userManagement.authenticateWithSessionCookie({
            cookie: sessionId,
        })

        return { user, session }
    } catch (error) {
        return null
    }
}

export const requireAuth = async (request: any, reply: any): Promise<string> => {
    const auth = await getSessionFromRequest(request)
    if (!auth || !auth.user) {
        reply.code(401)
        throw new Error("Unauthorized")
    }
    return auth.user.id
}
