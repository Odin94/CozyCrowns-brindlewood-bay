import type { FastifyRequest, FastifyReply } from "fastify";
import { workos } from "../config/workos.js";
import { env } from "../config/env.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
    userId?: string;
  }
}

export type AuthenticatedRequest = FastifyRequest & {
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
};

type AuthenticatedSession = {
  user: NonNullable<AuthenticatedRequest["user"]>;
  refreshedToken?: string;
};

export const authenticateSealedSession = async (
  token: string,
): Promise<AuthenticatedSession | null> => {
  const cookiePassword = env.WORKOS_COOKIE_PASSWORD;
  if (!cookiePassword) return null;

  try {
    const session = workos.userManagement.loadSealedSession({
      sessionData: token,
      cookiePassword,
    });
    const authResult = await session.authenticate();

    if (authResult.authenticated && "user" in authResult) {
      return { user: authResult.user };
    }

    const refreshResult = await session.refresh();
    if (
      refreshResult.authenticated &&
      "sealedSession" in refreshResult &&
      "user" in refreshResult &&
      refreshResult.sealedSession
    ) {
      return { user: refreshResult.user, refreshedToken: refreshResult.sealedSession };
    }
  } catch {
    // Invalid sessions are handled by the caller.
  }

  return null;
};

export const authenticateUser = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  if (!env.WORKOS_COOKIE_PASSWORD) {
    reply.code(500).send({
      error: "Internal server error",
      message: "WORKOS_COOKIE_PASSWORD is not configured",
    });
    return;
  }

  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

  if (!token) {
    reply.code(401).send({
      error: "Unauthorized",
      message: "No token provided",
    });
    return;
  }

  const session = await authenticateSealedSession(token);
  if (!session) {
    reply.code(401).send({
      error: "Unauthorized",
      message: "Session is invalid",
    });
    return;
  }

  if (session.refreshedToken) reply.header("X-New-Token", session.refreshedToken);
  request.user = session.user;
  request.userId = session.user.id;
};
