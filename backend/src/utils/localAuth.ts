import { randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { env } from "../config/env.js";

const LOCAL_SESSION_PREFIX = "local_development_";
const LOCAL_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export const localDevelopmentUser = {
  id: "local-development-user",
  email: "local@cozycrowns.test",
  firstName: "Local",
  lastName: "Tester",
};

type LocalSession = {
  user: typeof localDevelopmentUser;
  expiresAt: number;
};

const sessions = new Map<string, LocalSession>();

const isLoopbackHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

const isLoopbackAddress = (address: string) =>
  address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";

/**
 * Local development sessions are intentionally restricted to a browser and
 * backend communicating over the loopback interface. Never loosen this check.
 */
export const canUseLocalAuth = (request: FastifyRequest) =>
  env.LOCAL_AUTH_ENABLED &&
  env.NODE_ENV !== "production" &&
  isLoopbackHost(request.hostname) &&
  isLoopbackAddress(request.ip);

export const isLocalSessionToken = (token: string) => token.startsWith(LOCAL_SESSION_PREFIX);

export const issueLocalSession = (request: FastifyRequest) => {
  if (!canUseLocalAuth(request)) return null;

  const token = `${LOCAL_SESSION_PREFIX}${randomBytes(32).toString("base64url")}`;
  sessions.set(token, {
    user: localDevelopmentUser,
    expiresAt: Date.now() + LOCAL_SESSION_TTL_MS,
  });
  return token;
};

export const getLocalSession = (token: string, request: FastifyRequest) => {
  if (!canUseLocalAuth(request) || !isLocalSessionToken(token)) return null;

  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session;
};

export const revokeLocalSession = (token: string) => sessions.delete(token);
