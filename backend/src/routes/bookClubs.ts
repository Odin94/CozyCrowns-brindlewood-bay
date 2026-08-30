import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { authenticateSealedSession, authenticateUser } from "../middleware/auth.js";
import { notifyBookClub } from "../realtime/bookClubNotifications.js";
import { notifyBookClubUsers, registerBookClubSocket } from "../realtime/bookClubUpdates.js";
import { characterDataSchema } from "../schema/character.js";

const idInput = z.object({ id: z.string().min(1) });
const memberParams = z.object({ id: z.string().min(1), userId: z.string().min(1) });
const characterParams = z.object({ id: z.string().min(1), characterId: z.string().min(1) });
const mysteryParams = z.object({ id: z.string().min(1), mysteryId: z.string().min(1) });
const clueParams = z.object({
  id: z.string().min(1),
  mysteryId: z.string().min(1),
  clueId: z.string().min(1),
});
const nameInput = z.object({ name: z.string().trim().min(2).max(80) });
const mysteryInput = z.object({
  name: z.string().trim().min(2).max(80),
  clues: z.array(z.string().trim().min(1).max(500)).max(100).default([]),
});
const inviteInput = z.object({ nickname: z.string().trim().min(3).max(30) });
const characterInput = z.object({ characterId: z.string().min(1) });
const gameMasterInput = z.object({ isGameMaster: z.literal(true) });
const rollInput = z.object({
  label: z.string().trim().min(1).max(160),
  dice: z.string().trim().min(1).max(80),
  result: z.string().trim().min(1).max(160),
  characterId: z.string().min(1),
});
const clueInput = z.object({ text: z.string().trim().min(1).max(500), isVoid: z.boolean() });
const clueUpdateInput = z.object({
  checked: z.boolean().optional(),
  text: z.string().trim().min(1).max(500).optional(),
});
const websocketAuthInput = z.object({ type: z.literal("authenticate"), token: z.string().min(1) });

async function membership(bookClubId: string, userId: string) {
  return db
    .select()
    .from(schema.bookClubMembers)
    .where(
      and(
        eq(schema.bookClubMembers.bookClubId, bookClubId),
        eq(schema.bookClubMembers.userId, userId),
      ),
    )
    .get();
}

async function gameMaster(bookClubId: string, userId: string) {
  return db
    .select()
    .from(schema.bookClubMembers)
    .where(
      and(
        eq(schema.bookClubMembers.bookClubId, bookClubId),
        eq(schema.bookClubMembers.userId, userId),
        eq(schema.bookClubMembers.isGameMaster, true),
      ),
    )
    .get();
}

function characterOverview(rawData: string) {
  try {
    const parsed = characterDataSchema.safeParse(JSON.parse(rawData));
    if (parsed.success) {
      return {
        conditions: parsed.data.conditions,
        mavenMoves: parsed.data.mavenMoves,
        voidChecks: parsed.data.voidChecks,
        cozyItems: parsed.data.cozyItems,
      };
    }
  } catch {
    // A legacy/corrupt sheet should never make an entire Book Club unavailable.
  }
  return { conditions: "", mavenMoves: "", voidChecks: [], cozyItems: [] };
}

async function overview(bookClubId: string) {
  const club = await db
    .select()
    .from(schema.bookClubs)
    .where(eq(schema.bookClubs.id, bookClubId))
    .get();
  if (!club) return undefined;
  const members = await db
    .select()
    .from(schema.bookClubMembers)
    .where(eq(schema.bookClubMembers.bookClubId, bookClubId));
  const userIds = members.map((member) => member.userId);
  const [users, characters, assignments, rolls, mysteries] = await Promise.all([
    userIds.length ? db.select().from(schema.users).where(inArray(schema.users.id, userIds)) : [],
    userIds.length
      ? db
          .select()
          .from(schema.characters)
          .where(
            and(inArray(schema.characters.userId, userIds), isNull(schema.characters.deletedAt)),
          )
      : [],
    db
      .select()
      .from(schema.bookClubCharacterAssignments)
      .where(eq(schema.bookClubCharacterAssignments.bookClubId, bookClubId)),
    db
      .select()
      .from(schema.bookClubRollEvents)
      .where(eq(schema.bookClubRollEvents.bookClubId, bookClubId))
      .orderBy(desc(schema.bookClubRollEvents.createdAt))
      .limit(30),
    db
      .select()
      .from(schema.bookClubMysteries)
      .where(eq(schema.bookClubMysteries.bookClubId, bookClubId))
      .orderBy(desc(schema.bookClubMysteries.updatedAt)),
  ]);
  const activeMystery = mysteries.find((mystery) => mystery.isActive);
  const clues = activeMystery
    ? await db
        .select()
        .from(schema.bookClubClues)
        .where(eq(schema.bookClubClues.mysteryId, activeMystery.id))
        .orderBy(desc(schema.bookClubClues.checked), desc(schema.bookClubClues.updatedAt))
    : [];
  const assigned = new Set(assignments.map((assignment) => assignment.characterId));
  return {
    id: club.id,
    name: club.name,
    ownerId: club.ownerId,
    createdAt: club.createdAt,
    members: members.map((member) => ({
      id: member.userId,
      nickname: users.find((user) => user.id === member.userId)?.nickname ?? null,
      joinedAt: member.joinedAt,
      isGameMaster: member.isGameMaster,
      characters: characters
        .filter((character) => character.userId === member.userId && assigned.has(character.id))
        .map((character) => ({
          id: character.id,
          name: character.name,
          data: characterOverview(character.data),
          version: character.version,
          updatedAt: character.updatedAt,
        })),
    })),
    rolls,
    mysteries: mysteries.map((mystery) => ({
      id: mystery.id,
      title: mystery.title,
      isActive: mystery.isActive,
      createdAt: mystery.createdAt,
    })),
    activeMystery: activeMystery ? { ...activeMystery, clues } : null,
  };
}

async function invitationsFor(userId: string) {
  const invitations = await db
    .select()
    .from(schema.bookClubInvitations)
    .where(eq(schema.bookClubInvitations.userId, userId));
  if (!invitations.length) return [];
  const [clubs, inviters] = await Promise.all([
    db
      .select()
      .from(schema.bookClubs)
      .where(
        inArray(
          schema.bookClubs.id,
          invitations.map((invitation) => invitation.bookClubId),
        ),
      ),
    db
      .select()
      .from(schema.users)
      .where(
        inArray(
          schema.users.id,
          invitations.map((invitation) => invitation.invitedByUserId),
        ),
      ),
  ]);
  return invitations.flatMap((invitation) => {
    const club = clubs.find((entry) => entry.id === invitation.bookClubId);
    if (!club) return [];
    return [
      {
        club: { id: club.id, name: club.name, ownerId: club.ownerId, createdAt: club.createdAt },
        invitedByNickname:
          inviters.find((user) => user.id === invitation.invitedByUserId)?.nickname ?? null,
        createdAt: invitation.createdAt,
      },
    ];
  });
}

export async function bookClubRoutes(fastify: FastifyInstance) {
  fastify.get("/book-clubs/live", { websocket: true }, (socket) => {
    let unregister: (() => void) | undefined;

    socket.on("close", () => unregister?.());
    socket.on("message", async (payload: { toString: () => string }) => {
      if (unregister) return;

      let message: unknown;
      try {
        message = JSON.parse(payload.toString());
      } catch {
        socket.close(1008, "Invalid authentication message");
        return;
      }

      const parsed = websocketAuthInput.safeParse(message);
      if (!parsed.success) {
        socket.close(1008, "Invalid authentication message");
        return;
      }

      const session = await authenticateSealedSession(parsed.data.token);
      if (!session) {
        socket.close(1008, "Unauthorized");
        return;
      }

      unregister = registerBookClubSocket(session.user.id, socket);
      socket.send(JSON.stringify({ type: "ready", token: session.refreshedToken }));
    });
  });

  fastify.get("/book-clubs", { preHandler: authenticateUser }, async (request) => {
    const memberships = await db
      .select({ bookClubId: schema.bookClubMembers.bookClubId })
      .from(schema.bookClubMembers)
      .where(eq(schema.bookClubMembers.userId, request.userId!));
    const [clubs, invitations] = await Promise.all([
      Promise.all(memberships.map(({ bookClubId }) => overview(bookClubId))),
      invitationsFor(request.userId!),
    ]);
    return { clubs: clubs.filter(Boolean), invitations };
  });

  fastify.post("/book-clubs", { preHandler: authenticateUser }, async (request, reply) => {
    const parsed = nameInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "A book club needs a name" });
    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, request.userId!))
      .get();
    if (!user?.nickname)
      return reply.code(422).send({ error: "Choose a nickname before creating a book club" });
    const id = nanoid();
    db.transaction((tx) => {
      tx.insert(schema.bookClubs)
        .values({ id, name: parsed.data.name, ownerId: request.userId! })
        .run();
      tx.insert(schema.bookClubMembers)
        .values({ bookClubId: id, userId: request.userId!, isGameMaster: true })
        .run();
    });
    const result = await overview(id);
    await notifyBookClub(id);
    return result;
  });

  fastify.post(
    "/book-clubs/:id/invitations",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = idInput.safeParse(request.params);
      const parsed = inviteInput.safeParse(request.body);
      if (!params.success || !parsed.success)
        return reply.code(400).send({ error: "Invalid invitation" });
      if (!(await membership(params.data.id, request.userId!)))
        return reply.code(403).send({ error: "You are not in this book club" });
      const recipient = await db
        .select()
        .from(schema.users)
        .where(sql`lower(${schema.users.nickname}) = lower(${parsed.data.nickname})`)
        .get();
      if (!recipient) return reply.code(404).send({ error: "No player has that nickname" });
      if (await membership(params.data.id, recipient.id))
        return reply.code(409).send({ error: "That player is already in the book club" });
      try {
        await db.insert(schema.bookClubInvitations).values({
          bookClubId: params.data.id,
          userId: recipient.id,
          invitedByUserId: request.userId!,
        });
      } catch {
        return reply.code(409).send({ error: "That player already has an invitation" });
      }
      notifyBookClubUsers([recipient.id]);
      return { success: true };
    },
  );

  fastify.post(
    "/book-clubs/:id/invitations/accept",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = idInput.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: "Invalid invitation" });
      const invitation = await db
        .select()
        .from(schema.bookClubInvitations)
        .where(
          and(
            eq(schema.bookClubInvitations.bookClubId, params.data.id),
            eq(schema.bookClubInvitations.userId, request.userId!),
          ),
        )
        .get();
      if (!invitation) return reply.code(404).send({ error: "Invitation not found" });
      db.transaction((tx) => {
        tx.insert(schema.bookClubMembers)
          .values({ bookClubId: params.data.id, userId: request.userId! })
          .onConflictDoNothing()
          .run();
        tx.delete(schema.bookClubInvitations)
          .where(
            and(
              eq(schema.bookClubInvitations.bookClubId, params.data.id),
              eq(schema.bookClubInvitations.userId, request.userId!),
            ),
          )
          .run();
      });
      const result = await overview(params.data.id);
      await notifyBookClub(params.data.id);
      return result;
    },
  );

  fastify.delete(
    "/book-clubs/:id/invitations",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = idInput.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: "Invalid invitation" });
      const deleted = await db
        .delete(schema.bookClubInvitations)
        .where(
          and(
            eq(schema.bookClubInvitations.bookClubId, params.data.id),
            eq(schema.bookClubInvitations.userId, request.userId!),
          ),
        )
        .returning();
      if (deleted.length) notifyBookClubUsers([request.userId!]);
      return deleted.length
        ? { success: true }
        : reply.code(404).send({ error: "Invitation not found" });
    },
  );

  fastify.put(
    "/book-clubs/:id/members/:userId/game-master",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = memberParams.safeParse(request.params);
      const parsed = gameMasterInput.safeParse(request.body);
      if (!params.success || !parsed.success)
        return reply.code(400).send({ error: "Invalid GM update" });
      const club = await db
        .select()
        .from(schema.bookClubs)
        .where(
          and(
            eq(schema.bookClubs.id, params.data.id),
            eq(schema.bookClubs.ownerId, request.userId!),
          ),
        )
        .get();
      if (!club)
        return reply.code(403).send({ error: "Only the book club owner can assign the GM" });
      const target = await membership(params.data.id, params.data.userId);
      if (!target) return reply.code(404).send({ error: "Book Club member not found" });
      db.transaction((tx) => {
        tx.update(schema.bookClubMembers)
          .set({ isGameMaster: false })
          .where(eq(schema.bookClubMembers.bookClubId, params.data.id))
          .run();
        tx.update(schema.bookClubMembers)
          .set({ isGameMaster: true })
          .where(
            and(
              eq(schema.bookClubMembers.bookClubId, params.data.id),
              eq(schema.bookClubMembers.userId, params.data.userId),
            ),
          )
          .run();
      });
      const result = await overview(params.data.id);
      await notifyBookClub(params.data.id);
      return result;
    },
  );

  fastify.post(
    "/book-clubs/:id/characters",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = idInput.safeParse(request.params);
      const parsed = characterInput.safeParse(request.body);
      if (!params.success || !parsed.success)
        return reply.code(400).send({ error: "Invalid character" });
      if (!(await membership(params.data.id, request.userId!)))
        return reply.code(403).send({ error: "You are not in this book club" });
      const character = await db
        .select({ id: schema.characters.id })
        .from(schema.characters)
        .where(
          and(
            eq(schema.characters.id, parsed.data.characterId),
            eq(schema.characters.userId, request.userId!),
            isNull(schema.characters.deletedAt),
          ),
        )
        .get();
      if (!character) return reply.code(404).send({ error: "Character not found" });
      await db
        .insert(schema.bookClubCharacterAssignments)
        .values({ bookClubId: params.data.id, characterId: character.id })
        .onConflictDoNothing();
      const result = await overview(params.data.id);
      await notifyBookClub(params.data.id);
      return result;
    },
  );

  fastify.delete(
    "/book-clubs/:id/characters/:characterId",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = characterParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: "Invalid character" });
      if (!(await membership(params.data.id, request.userId!)))
        return reply.code(403).send({ error: "You are not in this book club" });
      const character = await db
        .select({ id: schema.characters.id })
        .from(schema.characters)
        .where(
          and(
            eq(schema.characters.id, params.data.characterId),
            eq(schema.characters.userId, request.userId!),
            isNull(schema.characters.deletedAt),
          ),
        )
        .get();
      if (!character) return reply.code(404).send({ error: "Character not found" });
      await db
        .delete(schema.bookClubCharacterAssignments)
        .where(
          and(
            eq(schema.bookClubCharacterAssignments.bookClubId, params.data.id),
            eq(schema.bookClubCharacterAssignments.characterId, character.id),
          ),
        );
      await notifyBookClub(params.data.id);
      return { success: true };
    },
  );

  fastify.post(
    "/book-clubs/:id/rolls",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = idInput.safeParse(request.params);
      const parsed = rollInput.safeParse(request.body);
      if (!params.success || !parsed.success)
        return reply.code(400).send({ error: "Invalid roll" });
      if (!(await membership(params.data.id, request.userId!)))
        return reply.code(403).send({ error: "You are not in this book club" });
      const character = await db
        .select({ id: schema.characters.id, name: schema.characters.name })
        .from(schema.characters)
        .innerJoin(
          schema.bookClubCharacterAssignments,
          eq(schema.bookClubCharacterAssignments.characterId, schema.characters.id),
        )
        .where(
          and(
            eq(schema.characters.id, parsed.data.characterId),
            eq(schema.characters.userId, request.userId!),
            eq(schema.bookClubCharacterAssignments.bookClubId, params.data.id),
            isNull(schema.characters.deletedAt),
          ),
        )
        .get();
      if (!character)
        return reply.code(404).send({ error: "Your character is not at this book club" });
      const [roll] = await db
        .insert(schema.bookClubRollEvents)
        .values({
          id: nanoid(),
          bookClubId: params.data.id,
          userId: request.userId!,
          characterId: character.id,
          characterName: character.name || "Unnamed Maven",
          label: parsed.data.label,
          dice: parsed.data.dice,
          result: parsed.data.result,
        })
        .returning();
      await notifyBookClub(params.data.id);
      return roll;
    },
  );

  fastify.post(
    "/book-clubs/:id/mysteries",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = idInput.safeParse(request.params);
      const parsed = mysteryInput.safeParse(request.body);
      if (!params.success || !parsed.success)
        return reply.code(400).send({ error: "A mystery needs a title" });
      if (!(await gameMaster(params.data.id, request.userId!)))
        return reply.code(403).send({ error: "Only the GM can create a mystery" });
      const id = nanoid();
      db.transaction((tx) => {
        tx.insert(schema.bookClubMysteries)
          .values({ id, bookClubId: params.data.id, title: parsed.data.name, isActive: false })
          .run();
        if (parsed.data.clues.length) {
          tx.insert(schema.bookClubClues)
            .values(
              parsed.data.clues.map((text) => ({
                id: nanoid(),
                mysteryId: id,
                text,
                isVoid: false,
              })),
            )
            .run();
        }
      });
      const result = await overview(params.data.id);
      await notifyBookClub(params.data.id);
      return result;
    },
  );

  fastify.put(
    "/book-clubs/:id/mysteries/:mysteryId/activate",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = mysteryParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: "Invalid mystery" });
      if (!(await gameMaster(params.data.id, request.userId!)))
        return reply.code(403).send({ error: "Only the GM can activate a mystery" });
      const mystery = await db
        .select()
        .from(schema.bookClubMysteries)
        .where(
          and(
            eq(schema.bookClubMysteries.id, params.data.mysteryId),
            eq(schema.bookClubMysteries.bookClubId, params.data.id),
          ),
        )
        .get();
      if (!mystery) return reply.code(404).send({ error: "Mystery not found" });
      db.transaction((tx) => {
        tx.update(schema.bookClubMysteries)
          .set({ isActive: false })
          .where(eq(schema.bookClubMysteries.bookClubId, params.data.id))
          .run();
        tx.update(schema.bookClubMysteries)
          .set({ isActive: true, updatedAt: new Date() })
          .where(eq(schema.bookClubMysteries.id, params.data.mysteryId))
          .run();
      });
      const result = await overview(params.data.id);
      await notifyBookClub(params.data.id);
      return result;
    },
  );

  fastify.post(
    "/book-clubs/:id/mysteries/:mysteryId/clues",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = mysteryParams.safeParse(request.params);
      const parsed = clueInput.safeParse(request.body);
      if (!params.success || !parsed.success)
        return reply.code(400).send({ error: "A clue needs text" });
      if (!(await gameMaster(params.data.id, request.userId!)))
        return reply.code(403).send({ error: "Only the GM can manage clues" });
      const mystery = await db
        .select()
        .from(schema.bookClubMysteries)
        .where(
          and(
            eq(schema.bookClubMysteries.id, params.data.mysteryId),
            eq(schema.bookClubMysteries.bookClubId, params.data.id),
          ),
        )
        .get();
      if (!mystery) return reply.code(404).send({ error: "Mystery not found" });
      await db.insert(schema.bookClubClues).values({
        id: nanoid(),
        mysteryId: mystery.id,
        text: parsed.data.text,
        isVoid: parsed.data.isVoid,
      });
      const result = await overview(params.data.id);
      await notifyBookClub(params.data.id);
      return result;
    },
  );

  fastify.put(
    "/book-clubs/:id/mysteries/:mysteryId/clues/:clueId",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = clueParams.safeParse(request.params);
      const parsed = clueUpdateInput.safeParse(request.body);
      if (
        !params.success ||
        !parsed.success ||
        (!Object.hasOwn(parsed.data, "checked") && !Object.hasOwn(parsed.data, "text"))
      )
        return reply.code(400).send({ error: "Invalid clue update" });
      if (!(await gameMaster(params.data.id, request.userId!)))
        return reply.code(403).send({ error: "Only the GM can manage clues" });
      const clue = await db
        .select({ id: schema.bookClubClues.id })
        .from(schema.bookClubClues)
        .innerJoin(
          schema.bookClubMysteries,
          eq(schema.bookClubClues.mysteryId, schema.bookClubMysteries.id),
        )
        .where(
          and(
            eq(schema.bookClubClues.id, params.data.clueId),
            eq(schema.bookClubClues.mysteryId, params.data.mysteryId),
            eq(schema.bookClubMysteries.bookClubId, params.data.id),
          ),
        )
        .get();
      if (!clue) return reply.code(404).send({ error: "Clue not found" });
      await db
        .update(schema.bookClubClues)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(schema.bookClubClues.id, clue.id));
      const result = await overview(params.data.id);
      await notifyBookClub(params.data.id);
      return result;
    },
  );
}
