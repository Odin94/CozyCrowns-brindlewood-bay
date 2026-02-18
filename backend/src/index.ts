import Fastify from "fastify"
import cors from "@fastify/cors"
import cookie from "@fastify/cookie"
import rateLimit from "@fastify/rate-limit"
import { readFileSync } from "fs"
import { characterRoutes } from "./routes/characters.js"
import { shareRoutes } from "./routes/shares.js"
import { authRoutes } from "./routes/auth.js"
import { env } from "./config/env.js"
import { generateRequestId, setRequestId } from "./middleware/requestId.js"

const httpsOptions =
    env.SSL_CERT_PATH && env.SSL_KEY_PATH
        ? {
              cert: readFileSync(env.SSL_CERT_PATH),
              key: readFileSync(env.SSL_KEY_PATH),
          }
        : null

const fastify = Fastify({
    https: httpsOptions,
    trustProxy: true,
    logger:
        env.NODE_ENV === "development"
            ? {
                  transport: {
                      target: "pino-pretty",
                      options: {
                          colorize: true,
                          translateTime: "HH:MM:ss Z",
                          ignore: "pid,hostname",
                      },
                  },
              }
            : true,
})

await fastify.register(cors, {
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true)
        }

        if (
            origin.startsWith("http://localhost:") ||
            origin.startsWith("http://127.0.0.1:") ||
            origin.startsWith("https://localhost:") ||
            origin.startsWith("https://127.0.0.1:")
        ) {
            return callback(null, true)
        }

        const frontendUrl = new URL(env.FRONTEND_URL)
        if (origin.startsWith(frontendUrl.origin)) {
            return callback(null, true)
        }

        callback(new Error("Not allowed by CORS"), false)
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
})

await fastify.register(cookie, {
    secret: env.WORKOS_COOKIE_PASSWORD,
})

await fastify.register(rateLimit, {
    max: 1000,
    timeWindow: "15 minutes",
    skipOnError: true,
})

fastify.addHook("onRequest", async (request, reply) => {
    const requestId = (request.headers["x-request-id"] as string | undefined) || generateRequestId()
    setRequestId(request, reply, requestId)
})

await fastify.register(authRoutes)
await fastify.register(characterRoutes)
await fastify.register(shareRoutes)

fastify.get(
    "/health",
    {
        config: {
            rateLimit: false,
        },
    },
    async () => {
        return { status: "ok" }
    },
)

const start = async () => {
    try {
        await fastify.listen({ port: env.PORT, host: env.HOST })
        const protocol = httpsOptions ? "https" : "http"
        fastify.log.info(`Server listening on ${protocol}://${env.HOST}:${env.PORT}`)
        fastify.log.info(`Environment: ${env.NODE_ENV}`)
        if (httpsOptions) {
            fastify.log.info("HTTPS enabled with SSL certificates")
        }
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}

process.on("SIGTERM", async () => {
    await fastify.close()
    process.exit(0)
})

process.on("SIGINT", async () => {
    await fastify.close()
    process.exit(0)
})

start()
