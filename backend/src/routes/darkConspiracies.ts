import type { FastifyInstance } from "fastify";
import { and, eq, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import { darkConspiracies } from "../db/schema.js";
import { authenticateUser } from "../middleware/auth.js";
import {
  createDarkConspiracySchema,
  darkConspiracyParamsSchema,
  updateDarkConspiracySchema,
  type CreateDarkConspiracyInput,
  type DarkConspiracyParams,
  type UpdateDarkConspiracyInput,
} from "../schema/darkConspiracy.js";
import { zodToFastifySchema } from "../utils/zodToFastifySchema.js";

export const darkConspiracyRoutes = async (fastify: FastifyInstance) => {
  fastify.get("/dark-conspiracies", { preHandler: authenticateUser }, async (request) => {
    const userId = request.userId!;

    const userDarkConspiracies = await db
      .select()
      .from(darkConspiracies)
      .where(and(eq(darkConspiracies.userId, userId), isNull(darkConspiracies.deletedAt)));

    return {
      darkConspiracies: userDarkConspiracies.map((conspiracy) => ({
        id: conspiracy.id,
        title: conspiracy.title,
        data: JSON.parse(conspiracy.data),
        version: conspiracy.version,
        createdAt: conspiracy.createdAt,
        updatedAt: conspiracy.updatedAt,
      })),
    };
  });

  fastify.post<{ Body: CreateDarkConspiracyInput }>(
    "/dark-conspiracies",
    {
      preHandler: authenticateUser,
      schema: {
        body: zodToFastifySchema(createDarkConspiracySchema),
      },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const body = request.body;

      const conspiracyCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(darkConspiracies)
        .where(and(eq(darkConspiracies.userId, userId), isNull(darkConspiracies.deletedAt)));

      if (conspiracyCount[0]?.count >= 25) {
        reply.code(403);
        return {
          error: "Dark conspiracy limit reached",
          message: "You have reached the maximum limit of 25 dark conspiracies.",
        };
      }

      const id = nanoid();
      const now = new Date();

      const [conspiracy] = await db
        .insert(darkConspiracies)
        .values({
          id,
          userId,
          title: body.title,
          data: JSON.stringify(body.data),
          version: body.version ?? 1,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return {
        id: conspiracy.id,
        title: conspiracy.title,
        data: JSON.parse(conspiracy.data),
        version: conspiracy.version,
        createdAt: conspiracy.createdAt,
        updatedAt: conspiracy.updatedAt,
      };
    },
  );

  fastify.put<{ Params: DarkConspiracyParams; Body: UpdateDarkConspiracyInput }>(
    "/dark-conspiracies/:id",
    {
      preHandler: authenticateUser,
      schema: {
        params: zodToFastifySchema(darkConspiracyParamsSchema),
        body: zodToFastifySchema(updateDarkConspiracySchema),
      },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const { id } = request.params;
      const body = request.body;

      const existing = await db
        .select()
        .from(darkConspiracies)
        .where(and(eq(darkConspiracies.id, id), isNull(darkConspiracies.deletedAt)))
        .limit(1)
        .get();

      if (!existing) {
        reply.code(404);
        return { error: "Dark conspiracy not found" };
      }

      if (existing.userId !== userId) {
        reply.code(403);
        return { error: "Forbidden" };
      }

      const existingData = JSON.parse(existing.data);
      const hasDataChanges =
        body.data !== undefined && JSON.stringify(body.data) !== JSON.stringify(existingData);
      const hasTitleChange = body.title !== undefined && body.title !== existing.title;

      const updates: {
        updatedAt: Date;
        title?: string;
        data?: string;
        version?: number;
      } = {
        updatedAt: new Date(),
      };

      if (body.title !== undefined) {
        updates.title = body.title;
      }

      if (body.data !== undefined) {
        updates.data = JSON.stringify(body.data);
      }

      updates.version =
        hasDataChanges || hasTitleChange
          ? (body.version ?? existing.version) + 1
          : existing.version;

      const [conspiracy] = await db
        .update(darkConspiracies)
        .set(updates)
        .where(eq(darkConspiracies.id, id))
        .returning();

      return {
        id: conspiracy.id,
        title: conspiracy.title,
        data: JSON.parse(conspiracy.data),
        version: conspiracy.version,
        createdAt: conspiracy.createdAt,
        updatedAt: conspiracy.updatedAt,
      };
    },
  );
};
