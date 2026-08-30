import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import { mysteries, mysteryVersions, publishedMysteries, users } from "../db/schema.js";
import { authenticateUser } from "../middleware/auth.js";
import {
  createMysterySchema,
  mysteryParamsSchema,
  publishedMysteryParamsSchema,
  updateMysterySchema,
  type CreateMysteryInput,
  type MysteryParams,
  type PublishedMysteryParams,
  type UpdateMysteryInput,
} from "../schema/mystery.js";
import { zodToFastifySchema } from "../utils/zodToFastifySchema.js";

const serializeMystery = (mystery: typeof mysteries.$inferSelect) => ({
  id: mystery.id,
  title: mystery.title,
  data: JSON.parse(mystery.data),
  version: mystery.version,
  createdAt: mystery.createdAt,
  updatedAt: mystery.updatedAt,
});

const keepVersionHistory = (mysteryId: string, kind: "auto" | "manual") => {
  const saved = db
    .select({ id: mysteryVersions.id })
    .from(mysteryVersions)
    .where(and(eq(mysteryVersions.mysteryId, mysteryId), eq(mysteryVersions.kind, kind)))
    .orderBy(desc(mysteryVersions.sourceVersion))
    .all();
  const discarded = saved.slice(10).map((version) => version.id);
  if (discarded.length)
    db.delete(mysteryVersions).where(inArray(mysteryVersions.id, discarded)).run();
};

const isSuperadmin = (userId: string) =>
  db.select({ isSuperadmin: users.isSuperadmin }).from(users).where(eq(users.id, userId)).get()
    ?.isSuperadmin === true;

export const mysteryRoutes = async (fastify: FastifyInstance) => {
  fastify.get("/mysteries", { preHandler: authenticateUser }, async (request) => {
    const rows = await db
      .select()
      .from(mysteries)
      .where(and(eq(mysteries.userId, request.userId!), isNull(mysteries.deletedAt)))
      .orderBy(desc(mysteries.updatedAt));
    return { mysteries: rows.map(serializeMystery) };
  });

  fastify.get<{ Params: MysteryParams }>(
    "/mysteries/:id",
    { preHandler: authenticateUser, schema: { params: zodToFastifySchema(mysteryParamsSchema) } },
    async (request, reply) => {
      const mystery = db
        .select()
        .from(mysteries)
        .where(and(eq(mysteries.id, request.params.id), isNull(mysteries.deletedAt)))
        .get();
      if (!mystery) return reply.code(404).send({ error: "Mystery not found" });
      if (mystery.userId !== request.userId) return reply.code(403).send({ error: "Forbidden" });
      return serializeMystery(mystery);
    },
  );

  fastify.post<{ Body: CreateMysteryInput }>(
    "/mysteries",
    { preHandler: authenticateUser, schema: { body: zodToFastifySchema(createMysterySchema) } },
    async (request) => {
      const now = new Date();
      const [mystery] = await db
        .insert(mysteries)
        .values({
          id: nanoid(),
          userId: request.userId!,
          title: request.body.title,
          data: JSON.stringify(request.body.data),
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      db.insert(mysteryVersions)
        .values({
          id: nanoid(),
          mysteryId: mystery.id,
          title: mystery.title,
          data: mystery.data,
          sourceVersion: mystery.version,
          kind: "manual",
          createdAt: now,
        })
        .run();
      return serializeMystery(mystery);
    },
  );

  fastify.put<{ Params: MysteryParams; Body: UpdateMysteryInput }>(
    "/mysteries/:id",
    {
      preHandler: authenticateUser,
      schema: {
        params: zodToFastifySchema(mysteryParamsSchema),
        body: zodToFastifySchema(updateMysterySchema),
      },
    },
    async (request, reply) => {
      const existing = db
        .select()
        .from(mysteries)
        .where(and(eq(mysteries.id, request.params.id), isNull(mysteries.deletedAt)))
        .get();
      if (!existing) return reply.code(404).send({ error: "Mystery not found" });
      if (existing.userId !== request.userId) return reply.code(403).send({ error: "Forbidden" });
      if (existing.version !== request.body.version) {
        return reply
          .code(409)
          .send({
            error: "This mystery changed elsewhere. Reload it before saving again.",
            current: serializeMystery(existing),
          });
      }

      const now = new Date();
      const nextVersion = existing.version + 1;
      const data = JSON.stringify(request.body.data);
      const saved = db.transaction(() => {
        const mystery = db
          .update(mysteries)
          .set({ title: request.body.title, data, version: nextVersion, updatedAt: now })
          .where(and(eq(mysteries.id, existing.id), eq(mysteries.version, existing.version)))
          .returning()
          .get();
        if (!mystery) return null;
        db.insert(mysteryVersions)
          .values({
            id: nanoid(),
            mysteryId: mystery.id,
            title: mystery.title,
            data: mystery.data,
            sourceVersion: mystery.version,
            kind: request.body.saveKind,
            createdAt: now,
          })
          .run();
        keepVersionHistory(mystery.id, request.body.saveKind);
        return mystery;
      });
      if (!saved)
        return reply
          .code(409)
          .send({ error: "This mystery changed elsewhere. Reload it before saving again." });
      return serializeMystery(saved);
    },
  );

  fastify.get<{ Params: MysteryParams }>(
    "/mysteries/:id/versions",
    { preHandler: authenticateUser, schema: { params: zodToFastifySchema(mysteryParamsSchema) } },
    async (request, reply) => {
      const mystery = db.select().from(mysteries).where(eq(mysteries.id, request.params.id)).get();
      if (!mystery) return reply.code(404).send({ error: "Mystery not found" });
      if (mystery.userId !== request.userId) return reply.code(403).send({ error: "Forbidden" });
      const versions = db
        .select()
        .from(mysteryVersions)
        .where(eq(mysteryVersions.mysteryId, mystery.id))
        .orderBy(desc(mysteryVersions.sourceVersion))
        .all();
      return {
        versions: versions.map((version) => ({
          ...serializeMystery({
            ...mystery,
            title: version.title,
            data: version.data,
            version: version.sourceVersion,
          }),
          id: version.id,
          kind: version.kind,
          savedAt: version.createdAt,
        })),
      };
    },
  );

  fastify.delete<{ Params: MysteryParams }>(
    "/mysteries/:id",
    { preHandler: authenticateUser, schema: { params: zodToFastifySchema(mysteryParamsSchema) } },
    async (request, reply) => {
      const result = db
        .update(mysteries)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(mysteries.id, request.params.id),
            eq(mysteries.userId, request.userId!),
            isNull(mysteries.deletedAt),
          ),
        )
        .run();
      if (!result.changes) return reply.code(404).send({ error: "Mystery not found" });
      return { success: true };
    },
  );

  fastify.post<{ Params: MysteryParams }>(
    "/mysteries/:id/publish",
    { preHandler: authenticateUser, schema: { params: zodToFastifySchema(mysteryParamsSchema) } },
    async (request, reply) => {
      const mystery = db
        .select()
        .from(mysteries)
        .where(
          and(
            eq(mysteries.id, request.params.id),
            eq(mysteries.userId, request.userId!),
            isNull(mysteries.deletedAt),
          ),
        )
        .get();
      if (!mystery) return reply.code(404).send({ error: "Mystery not found" });
      const now = new Date();
      const existing = db
        .select()
        .from(publishedMysteries)
        .where(eq(publishedMysteries.mysteryId, mystery.id))
        .get();
      if (existing?.status === "approved") {
        const pending = db
          .select()
          .from(mysteryVersions)
          .where(
            and(
              eq(mysteryVersions.mysteryId, mystery.id),
              eq(mysteryVersions.kind, "publication"),
            ),
          )
          .get();
        const submission = pending
          ? db
              .update(mysteryVersions)
              .set({
                title: mystery.title,
                data: mystery.data,
                sourceVersion: mystery.version,
                createdAt: now,
              })
              .where(eq(mysteryVersions.id, pending.id))
              .returning()
              .get()
          : db
              .insert(mysteryVersions)
              .values({
                id: nanoid(),
                mysteryId: mystery.id,
                title: mystery.title,
                data: mystery.data,
                sourceVersion: mystery.version,
                kind: "publication",
                createdAt: now,
              })
              .returning()
              .get();
        return { id: submission.id, status: "pending", submittedAt: submission.createdAt };
      }
      const values = {
        ownerId: mystery.userId,
        title: mystery.title,
        data: mystery.data,
        sourceVersion: mystery.version,
        status: "pending" as const,
        submittedAt: now,
        approvedAt: null,
        approvedByUserId: null,
      };
      const published = existing
        ? db
            .update(publishedMysteries)
            .set(values)
            .where(eq(publishedMysteries.id, existing.id))
            .returning()
            .get()
        : db
            .insert(publishedMysteries)
            .values({ id: nanoid(), mysteryId: mystery.id, ...values })
            .returning()
            .get();
      return { id: published.id, status: published.status, submittedAt: published.submittedAt };
    },
  );

  fastify.get("/library", { preHandler: authenticateUser }, async () => {
    const rows = db
      .select()
      .from(publishedMysteries)
      .where(eq(publishedMysteries.status, "approved"))
      .orderBy(desc(publishedMysteries.approvedAt))
      .all();
    return {
      mysteries: rows.map((row) => ({
        id: row.id,
        title: row.title,
        data: JSON.parse(row.data),
        sourceVersion: row.sourceVersion,
        approvedAt: row.approvedAt,
      })),
    };
  });

  fastify.post<{ Params: PublishedMysteryParams }>(
    "/library/:id/copy",
    {
      preHandler: authenticateUser,
      schema: { params: zodToFastifySchema(publishedMysteryParamsSchema) },
    },
    async (request, reply) => {
      const published = db
        .select()
        .from(publishedMysteries)
        .where(
          and(
            eq(publishedMysteries.id, request.params.id),
            eq(publishedMysteries.status, "approved"),
          ),
        )
        .get();
      if (!published) return reply.code(404).send({ error: "Published mystery not found" });
      const now = new Date();
      const [mystery] = await db
        .insert(mysteries)
        .values({
          id: nanoid(),
          userId: request.userId!,
          title: published.title,
          data: published.data,
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      db.insert(mysteryVersions)
        .values({
          id: nanoid(),
          mysteryId: mystery.id,
          title: mystery.title,
          data: mystery.data,
          sourceVersion: mystery.version,
          kind: "manual",
          createdAt: now,
        })
        .run();
      return serializeMystery(mystery);
    },
  );

  fastify.get(
    "/superadmin/published-mysteries",
    { preHandler: authenticateUser },
    async (request, reply) => {
      if (!isSuperadmin(request.userId!))
        return reply.code(403).send({ error: "Superadmin access required" });
      const rows = db
        .select()
        .from(publishedMysteries)
        .where(eq(publishedMysteries.status, "pending"))
        .orderBy(desc(publishedMysteries.submittedAt))
        .all();
      const resubmissions = db
        .select({ version: mysteryVersions, mystery: mysteries })
        .from(mysteryVersions)
        .innerJoin(mysteries, eq(mysteryVersions.mysteryId, mysteries.id))
        .where(and(eq(mysteryVersions.kind, "publication"), isNull(mysteries.deletedAt)))
        .orderBy(desc(mysteryVersions.sourceVersion))
        .all();
      return {
        mysteries: [
          ...rows.map((row) => ({
            id: row.id,
            title: row.title,
            data: JSON.parse(row.data),
            ownerId: row.ownerId,
            submittedAt: row.submittedAt,
          })),
          ...resubmissions.map(({ version, mystery }) => ({
            id: version.id,
            title: version.title,
            data: JSON.parse(version.data),
            ownerId: mystery.userId,
            submittedAt: version.createdAt,
          })),
        ],
      };
    },
  );

  fastify.put<{ Params: PublishedMysteryParams }>(
    "/superadmin/published-mysteries/:id/approve",
    {
      preHandler: authenticateUser,
      schema: { params: zodToFastifySchema(publishedMysteryParamsSchema) },
    },
    async (request, reply) => {
      if (!isSuperadmin(request.userId!))
        return reply.code(403).send({ error: "Superadmin access required" });
      const submission = db
        .select()
        .from(mysteryVersions)
        .where(
          and(
            eq(mysteryVersions.id, request.params.id),
            eq(mysteryVersions.kind, "publication"),
          ),
        )
        .get();
      if (submission) {
        const approved = db.transaction(() => {
          const published = db
            .update(publishedMysteries)
            .set({
              title: submission.title,
              data: submission.data,
              sourceVersion: submission.sourceVersion,
              status: "approved",
              submittedAt: submission.createdAt,
              approvedAt: new Date(),
              approvedByUserId: request.userId!,
            })
            .where(eq(publishedMysteries.mysteryId, submission.mysteryId))
            .returning()
            .get();
          if (!published) return null;
          db.delete(mysteryVersions).where(eq(mysteryVersions.id, submission.id)).run();
          return published;
        });
        if (!approved) return reply.code(404).send({ error: "Published mystery not found" });
        return { id: approved.id, status: approved.status };
      }
      const published = db
        .update(publishedMysteries)
        .set({ status: "approved", approvedAt: new Date(), approvedByUserId: request.userId! })
        .where(
          and(
            eq(publishedMysteries.id, request.params.id),
            eq(publishedMysteries.status, "pending"),
          ),
        )
        .returning()
        .get();
      if (!published) return reply.code(404).send({ error: "Pending mystery not found" });
      return { id: published.id, status: published.status };
    },
  );
};
