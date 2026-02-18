import type { FastifyInstance } from "fastify"
import { db } from "../db/index.js"
import { characters, characterShares } from "../db/schema.js"
import { eq, and, sql, isNull } from "drizzle-orm"
import { nanoid } from "nanoid"
import { trackEvent } from "../utils/tracker.js"
import { logger } from "../utils/logger.js"
import { authenticateUser } from "../middleware/auth.js"
import { zodToFastifySchema } from "../utils/zodToFastifySchema.js"
import {
    createCharacterSchema,
    updateCharacterSchema,
    characterParamsSchema,
    type CreateCharacterInput,
    type UpdateCharacterInput,
    type CharacterParams,
} from "../schema/character.js"

export const characterRoutes = async (fastify: FastifyInstance) => {
    fastify.get("/characters", { preHandler: authenticateUser }, async (request, reply) => {
        const userId = request.userId!

        const userCharacters = await db
            .select()
            .from(characters)
            .where(and(eq(characters.userId, userId), isNull(characters.deletedAt)))

        const sharedCharacters = await db
            .select({
                id: characters.id,
                name: characters.name,
                data: characters.data,
                version: characters.version,
                characterVersion: characters.characterVersion,
                createdAt: characters.createdAt,
                updatedAt: characters.updatedAt,
            })
            .from(characterShares)
            .innerJoin(characters, eq(characterShares.characterId, characters.id))
            .where(and(eq(characterShares.sharedWithUserId, userId), isNull(characters.deletedAt)))

        const allCharacters = [
            ...userCharacters.map((char) => ({
                id: char.id,
                name: char.name,
                data: JSON.parse(char.data),
                version: char.version,
                characterVersion: char.characterVersion,
                createdAt: char.createdAt,
                updatedAt: char.updatedAt,
                owned: true,
            })),
            ...sharedCharacters.map((char) => ({
                id: char.id,
                name: char.name,
                data: JSON.parse(char.data),
                version: char.version,
                characterVersion: char.characterVersion,
                createdAt: char.createdAt,
                updatedAt: char.updatedAt,
                owned: false,
            })),
        ]

        return {
            characters: allCharacters,
        }
    })

    fastify.get<{ Params: CharacterParams }>(
        "/characters/:id",
        {
            preHandler: authenticateUser,
            schema: {
                params: zodToFastifySchema(characterParamsSchema),
            },
        },
        async (request, reply) => {
            const userId = request.userId!
            const { id } = request.params

            const character = await db
                .select()
                .from(characters)
                .where(and(eq(characters.id, id), isNull(characters.deletedAt)))
                .limit(1)
                .get()

            if (!character) {
                reply.code(404)
                return { error: "Character not found" }
            }

            if (character.userId !== userId) {
                const share = await db
                    .select()
                    .from(characterShares)
                    .where(and(eq(characterShares.characterId, id), eq(characterShares.sharedWithUserId, userId)))
                    .limit(1)
                    .get()

                if (!share) {
                    reply.code(403)
                    return { error: "Forbidden" }
                }
            }

            return {
                id: character.id,
                name: character.name,
                data: JSON.parse(character.data),
                version: character.version,
                characterVersion: character.characterVersion,
                createdAt: character.createdAt,
                updatedAt: character.updatedAt,
            }
        },
    )

    fastify.post<{ Body: CreateCharacterInput }>(
        "/characters",
        {
            preHandler: authenticateUser,
            schema: {
                body: zodToFastifySchema(createCharacterSchema),
            },
        },
        async (request, reply) => {
            const userId = request.userId!
            const body = request.body

            const characterCount = await db
                .select({ count: sql<number>`count(*)` })
                .from(characters)
                .where(and(eq(characters.userId, userId), isNull(characters.deletedAt)))

            if (characterCount[0]?.count >= 100) {
                logger.warn("Character limit reached", {
                    endpoint: "/characters",
                    method: "POST",
                    userId,
                    characterCount: characterCount[0]?.count,
                })
                await trackEvent(
                    "character_limit_exceeded",
                    {
                        endpoint: "/characters",
                        method: "POST",
                        userId,
                        characterCount: characterCount[0]?.count,
                        limit: 100,
                    },
                    userId,
                    request,
                )
                reply.code(403).send({
                    error: "Character limit reached",
                    message:
                        "You have reached the maximum limit of 100 characters. Please delete some characters before creating new ones.",
                })
                return
            }

            const id = nanoid()
            const now = new Date()

            const [character] = await db
                .insert(characters)
                .values({
                    id,
                    userId,
                    name: body.name,
                    data: JSON.stringify(body.data),
                    version: body.version ?? 1,
                    characterVersion: 0,
                    createdAt: now,
                    updatedAt: now,
                })
                .returning()

            return {
                id: character.id,
                name: character.name,
                data: JSON.parse(character.data),
                version: character.version,
                characterVersion: character.characterVersion,
                createdAt: character.createdAt,
                updatedAt: character.updatedAt,
            }
        },
    )

    fastify.put<{ Params: CharacterParams; Body: UpdateCharacterInput }>(
        "/characters/:id",
        {
            preHandler: authenticateUser,
            schema: {
                params: zodToFastifySchema(characterParamsSchema),
                body: zodToFastifySchema(updateCharacterSchema),
            },
        },
        async (request, reply) => {
            const userId = request.userId!
            const { id } = request.params
            const body = request.body

            const existing = await db
                .select()
                .from(characters)
                .where(and(eq(characters.id, id), isNull(characters.deletedAt)))
                .limit(1)
                .get()

            if (!existing) {
                reply.code(404)
                return { error: "Character not found" }
            }

            if (existing.userId !== userId) {
                reply.code(403)
                return { error: "Forbidden" }
            }

            const existingData = JSON.parse(existing.data)
            let hasDataChanges = false

            if (body.data !== undefined) {
                const newDataStr = JSON.stringify(body.data)
                const existingDataStr = JSON.stringify(existingData)
                hasDataChanges = newDataStr !== existingDataStr
            }

            const hasNameChange = body.name !== undefined && body.name !== existing.name

            const updates: any = {
                updatedAt: new Date(),
            }

            if (body.name !== undefined) {
                updates.name = body.name
            }

            if (body.data !== undefined) {
                updates.data = JSON.stringify(body.data)
                if (hasDataChanges) {
                    updates.characterVersion = existing.characterVersion + 1
                }
            }

            if (hasDataChanges || hasNameChange) {
                updates.version = (body.version ?? existing.version) + 1
            } else {
                updates.version = existing.version
            }

            const [character] = await db.update(characters).set(updates).where(eq(characters.id, id)).returning()

            return {
                id: character.id,
                name: character.name,
                data: JSON.parse(character.data),
                version: character.version,
                characterVersion: character.characterVersion,
                createdAt: character.createdAt,
                updatedAt: character.updatedAt,
            }
        },
    )

    fastify.delete<{ Params: CharacterParams }>(
        "/characters/:id",
        {
            preHandler: authenticateUser,
            schema: {
                params: zodToFastifySchema(characterParamsSchema),
            },
        },
        async (request, reply) => {
            const userId = request.userId!
            const { id } = request.params

            const existing = await db
                .select()
                .from(characters)
                .where(and(eq(characters.id, id), isNull(characters.deletedAt)))
                .limit(1)
                .get()

            if (!existing) {
                reply.code(404)
                return { error: "Character not found" }
            }

            if (existing.userId !== userId) {
                reply.code(403)
                return { error: "Forbidden" }
            }

            await db.update(characters).set({ deletedAt: new Date() }).where(eq(characters.id, id))

            return { success: true }
        },
    )
}
