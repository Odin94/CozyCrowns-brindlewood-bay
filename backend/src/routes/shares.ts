import type { FastifyInstance } from "fastify"
import { db } from "../db/index.js"
import { characters, characterShares, users } from "../db/schema.js"
import { eq, and } from "drizzle-orm"
import { nanoid } from "nanoid"
import { authenticateUser } from "../middleware/auth.js"
import { zodToFastifySchema } from "../utils/zodToFastifySchema.js"
import {
    createShareSchema,
    characterParamsSchema,
    shareParamsSchema,
    type CreateShareInput,
    type CharacterParams,
    type ShareParams,
} from "../schema/share.js"

export const shareRoutes = async (fastify: FastifyInstance) => {
    fastify.get<{ Params: CharacterParams }>(
        "/characters/:id/shares",
        {
            preHandler: authenticateUser,
            schema: {
                params: zodToFastifySchema(characterParamsSchema),
            },
        },
        async (request, reply) => {
            const userId = request.userId!
            const { id } = request.params

            const character = await db.select().from(characters).where(eq(characters.id, id)).limit(1).get()

            if (!character) {
                reply.code(404)
                return { error: "Character not found" }
            }

            if (character.userId !== userId) {
                reply.code(403)
                return { error: "Forbidden" }
            }

            const shares = await db
                .select({
                    id: characterShares.id,
                    sharedWithUserId: characterShares.sharedWithUserId,
                    sharedById: characterShares.sharedById,
                    createdAt: characterShares.createdAt,
                    sharedWith: {
                        email: users.email,
                        firstName: users.firstName,
                        lastName: users.lastName,
                        nickname: users.nickname,
                    },
                })
                .from(characterShares)
                .innerJoin(users, eq(characterShares.sharedWithUserId, users.id))
                .where(eq(characterShares.characterId, id))

            return { shares }
        },
    )

    fastify.post<{ Params: CharacterParams; Body: CreateShareInput }>(
        "/characters/:id/shares",
        {
            preHandler: authenticateUser,
            schema: {
                params: zodToFastifySchema(characterParamsSchema),
                body: zodToFastifySchema(createShareSchema),
            },
        },
        async (request, reply) => {
            const userId = request.userId!
            const { id } = request.params
            const body = request.body

            const character = await db.select().from(characters).where(eq(characters.id, id)).limit(1).get()

            if (!character) {
                reply.code(404)
                return { error: "Character not found" }
            }

            if (character.userId !== userId) {
                reply.code(403)
                return { error: "Forbidden" }
            }

            const targetUser = await db.select().from(users).where(eq(users.email, body.email)).limit(1).get()

            if (!targetUser) {
                reply.code(404)
                return { error: "User not found" }
            }

            if (targetUser.id === userId) {
                reply.code(400)
                return { error: "Cannot share with yourself" }
            }

            const existingShare = await db
                .select()
                .from(characterShares)
                .where(and(eq(characterShares.characterId, id), eq(characterShares.sharedWithUserId, targetUser.id)))
                .limit(1)
                .get()

            if (existingShare) {
                reply.code(409)
                return { error: "Character already shared with this user" }
            }

            const shareId = nanoid()
            const [share] = await db
                .insert(characterShares)
                .values({
                    id: shareId,
                    characterId: id,
                    sharedWithUserId: targetUser.id,
                    sharedById: userId,
                    createdAt: new Date(),
                })
                .returning()

            return {
                id: share.id,
                characterId: share.characterId,
                sharedWithUserId: share.sharedWithUserId,
                sharedById: share.sharedById,
                createdAt: share.createdAt,
            }
        },
    )

    fastify.delete<{ Params: ShareParams }>(
        "/characters/:id/shares/:shareId",
        {
            preHandler: authenticateUser,
            schema: {
                params: zodToFastifySchema(shareParamsSchema),
            },
        },
        async (request, reply) => {
            const userId = request.userId!
            const { id, shareId } = request.params

            const character = await db.select().from(characters).where(eq(characters.id, id)).limit(1).get()

            if (!character) {
                reply.code(404)
                return { error: "Character not found" }
            }

            if (character.userId !== userId) {
                reply.code(403)
                return { error: "Forbidden" }
            }

            const share = await db.select().from(characterShares).where(eq(characterShares.id, shareId)).limit(1).get()

            if (!share || share.characterId !== id) {
                reply.code(404)
                return { error: "Share not found" }
            }

            await db.delete(characterShares).where(eq(characterShares.id, shareId))

            return { success: true }
        },
    )

    fastify.get("/shared-characters", { preHandler: authenticateUser }, async (request, reply) => {
        const userId = request.userId!

        const sharedCharacters = await db
            .select({
                id: characters.id,
                name: characters.name,
                data: characters.data,
                version: characters.version,
                characterVersion: characters.characterVersion,
                createdAt: characters.createdAt,
                updatedAt: characters.updatedAt,
                sharedBy: {
                    email: users.email,
                    firstName: users.firstName,
                    lastName: users.lastName,
                    nickname: users.nickname,
                },
            })
            .from(characterShares)
            .innerJoin(characters, eq(characterShares.characterId, characters.id))
            .innerJoin(users, eq(characterShares.sharedById, users.id))
            .where(eq(characterShares.sharedWithUserId, userId))

        return {
            characters: sharedCharacters.map((char) => ({
                id: char.id,
                name: char.name,
                data: JSON.parse(char.data),
                version: char.version,
                characterVersion: char.characterVersion,
                createdAt: char.createdAt,
                updatedAt: char.updatedAt,
                sharedBy: char.sharedBy,
            })),
        }
    })

    fastify.get<{ Params: CharacterParams }>(
        "/shared-characters/:id",
        {
            preHandler: authenticateUser,
            schema: {
                params: zodToFastifySchema(characterParamsSchema),
            },
        },
        async (request, reply) => {
            const userId = request.userId!
            const { id } = request.params

            const share = await db
                .select()
                .from(characterShares)
                .where(and(eq(characterShares.characterId, id), eq(characterShares.sharedWithUserId, userId)))
                .limit(1)
                .get()

            if (!share) {
                reply.code(404)
                return { error: "Shared character not found" }
            }

            const character = await db.select().from(characters).where(eq(characters.id, id)).limit(1).get()

            if (!character) {
                reply.code(404)
                return { error: "Character not found" }
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
}
