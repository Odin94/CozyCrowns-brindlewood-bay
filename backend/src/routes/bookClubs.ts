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
const theoryParams = z.object({ id: z.string().min(1), mysteryId: z.string().min(1) });
const theoryNodeParams = theoryParams.extend({ nodeId: z.string().min(1) });
const theoryEdgeParams = theoryParams.extend({ edgeId: z.string().min(1) });
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
const theoryKind = z.enum(["clue", "voidClue", "suspect", "other"]);
const theoryTags = z.array(z.string().trim().min(1).max(40)).max(12);
const theoryNodeInput = z.object({
  kind: theoryKind,
  title: z.string().trim().min(1).max(400),
  description: z.string().trim().max(3_000).default(""),
  tags: theoryTags.default([]),
  x: z.number().int().min(-10_000).max(10_000).default(220),
  y: z.number().int().min(-10_000).max(10_000).default(180),
});
const theoryNodeUpdateInput = z.object({
  version: z.number().int().positive(),
  title: z.string().trim().min(1).max(400).optional(),
  description: z.string().trim().max(3_000).optional(),
  tags: theoryTags.optional(),
  x: z.number().int().min(-10_000).max(10_000).optional(),
  y: z.number().int().min(-10_000).max(10_000).optional(),
});
const theoryEdgeInput = z
  .object({
    sourceNodeId: z.string().min(1),
    targetNodeId: z.string().min(1),
    label: z.string().trim().max(120).default(""),
  })
  .refine((data) => data.sourceNodeId !== data.targetNodeId, {
    message: "A connection needs two different notes",
  });
const theoryEdgeUpdateInput = z.object({
  version: z.number().int().positive(),
  label: z.string().trim().max(120),
});
const theoryVersionInput = z.object({ version: z.number().int().positive() });
const websocketAuthInput = z.object({ type: z.literal("authenticate"), token: z.string().min(1) });
const unauthenticatedSocketsByIp = new Map<string, number>();
const maxUnauthenticatedSocketsPerIp = 5;
const socketsByIp = new Map<string, number>();
const maxSocketsPerIp = 10;
const maxBookClubSockets = 500;
let activeBookClubSockets = 0;

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
  return (await overviews([bookClubId]))[0];
}

async function overviews(bookClubIds: string[]) {
  if (!bookClubIds.length) return [];
  const [clubs, members, characterRows, mysteries, rollRows] = await Promise.all([
    db.select().from(schema.bookClubs).where(inArray(schema.bookClubs.id, bookClubIds)),
    db
      .select()
      .from(schema.bookClubMembers)
      .where(inArray(schema.bookClubMembers.bookClubId, bookClubIds)),
    db
      .select()
      .from(schema.bookClubCharacterAssignments)
      .innerJoin(
        schema.characters,
        eq(schema.bookClubCharacterAssignments.characterId, schema.characters.id),
      )
      .where(
        and(
          inArray(schema.bookClubCharacterAssignments.bookClubId, bookClubIds),
          isNull(schema.characters.deletedAt),
        ),
      )
      .then((rows) =>
        rows.map((row) => ({ bookClubId: row.book_club_character_assignments.bookClubId, character: row.characters })),
      ),
    db
      .select()
      .from(schema.bookClubMysteries)
      .where(inArray(schema.bookClubMysteries.bookClubId, bookClubIds))
      .orderBy(desc(schema.bookClubMysteries.updatedAt)),
    db.all<{
      id: string;
      bookClubId: string;
      userId: string;
      characterId: string | null;
      characterName: string;
      label: string;
      dice: string;
      result: string;
      createdAt: number;
    }>(sql`
      SELECT id, book_club_id AS bookClubId, user_id AS userId, character_id AS characterId,
        character_name AS characterName, label, dice, result, created_at AS createdAt
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY book_club_id ORDER BY created_at DESC) AS row_number
        FROM book_club_roll_events
        WHERE book_club_id IN (${sql.join(
          bookClubIds.map((id) => sql`${id}`),
          sql`, `,
        )})
      )
      WHERE row_number <= 30
      ORDER BY createdAt DESC
    `),
  ]);
  const userIds = [...new Set(members.map((member) => member.userId))];
  const users = userIds.length
    ? await db.select().from(schema.users).where(inArray(schema.users.id, userIds))
    : [];
  const activeMysteryIds = mysteries.filter((mystery) => mystery.isActive).map((mystery) => mystery.id);
  const clues = activeMysteryIds.length
    ? await db
        .select()
        .from(schema.bookClubClues)
        .where(inArray(schema.bookClubClues.mysteryId, activeMysteryIds))
        .orderBy(desc(schema.bookClubClues.checked), desc(schema.bookClubClues.updatedAt))
    : [];
  const usersById = new Map(users.map((user) => [user.id, user]));

  return clubs.map((club) => {
    const clubMembers = members.filter((member) => member.bookClubId === club.id);
    const clubMysteries = mysteries.filter((mystery) => mystery.bookClubId === club.id);
    const activeMystery = clubMysteries.find((mystery) => mystery.isActive);
    return {
      id: club.id,
      name: club.name,
      ownerId: club.ownerId,
      createdAt: club.createdAt,
      members: clubMembers.map((member) => ({
        id: member.userId,
        nickname: usersById.get(member.userId)?.nickname ?? null,
        joinedAt: member.joinedAt,
        isGameMaster: member.isGameMaster,
        characters: characterRows
          .filter((row) => row.bookClubId === club.id && row.character.userId === member.userId)
          .map(({ character }) => ({
            id: character.id,
            name: character.name,
            data: characterOverview(character.data),
            version: character.version,
            updatedAt: character.updatedAt,
          })),
      })),
      rolls: rollRows
        .filter((roll) => roll.bookClubId === club.id)
        .map((roll) => ({ ...roll, createdAt: new Date(roll.createdAt * 1000) })),
      mysteries: clubMysteries.map((mystery) => ({
        id: mystery.id,
        title: mystery.title,
        isActive: mystery.isActive,
        createdAt: mystery.createdAt,
      })),
      activeMystery: activeMystery
        ? {
            ...activeMystery,
            clues: clues.filter((clue) => clue.mysteryId === activeMystery.id),
          }
        : null,
    };
  });
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

const baseTagForKind = (kind: z.infer<typeof theoryKind>) =>
  kind === "voidClue" ? "void clue" : kind;

function normalizedTags(tags: string[]) {
  return [...new Map(tags.map((tag) => [tag.trim().toLocaleLowerCase(), tag.trim()])).values()];
}

function parsedTags(tags: string) {
  try {
    const value: unknown = JSON.parse(tags);
    return Array.isArray(value) && value.every((tag) => typeof tag === "string")
      ? normalizedTags(value)
      : [];
  } catch {
    return [];
  }
}

function isLockedByAnotherUser(
  node: typeof schema.bookClubTheoryNodes.$inferSelect,
  userId: string,
) {
  return (
    node.editingByUserId &&
    node.editingByUserId !== userId &&
    node.editLockExpiresAt &&
    node.editLockExpiresAt.getTime() > Date.now()
  );
}

async function theoryMystery(bookClubId: string, mysteryId: string) {
  return db
    .select({ id: schema.bookClubMysteries.id })
    .from(schema.bookClubMysteries)
    .where(
      and(
        eq(schema.bookClubMysteries.id, mysteryId),
        eq(schema.bookClubMysteries.bookClubId, bookClubId),
      ),
    )
    .get();
}

async function ensureTheoryClueNodes(mysteryId: string) {
  const [clues, nodes] = await Promise.all([
    db
      .select()
      .from(schema.bookClubClues)
      .where(eq(schema.bookClubClues.mysteryId, mysteryId))
      .orderBy(schema.bookClubClues.createdAt),
    db
      .select({ sourceClueId: schema.bookClubTheoryNodes.sourceClueId })
      .from(schema.bookClubTheoryNodes)
      .where(eq(schema.bookClubTheoryNodes.mysteryId, mysteryId)),
  ]);
  const present = new Set(nodes.flatMap((node) => (node.sourceClueId ? [node.sourceClueId] : [])));
  const missing = clues.filter((clue) => !present.has(clue.id));
  if (!missing.length) return;
  db.transaction((tx) => {
    missing.forEach((clue, index) => {
      const position = clues.findIndex((entry) => entry.id === clue.id);
      tx.insert(schema.bookClubTheoryNodes)
        .values({
          id: nanoid(),
          mysteryId,
          sourceClueId: clue.id,
          kind: clue.isVoid ? "voidClue" : "clue",
          title: clue.text,
          x: 160 + (position % 3) * 340,
          y: 140 + Math.floor(position / 3) * 180 + index * 8,
        })
        .onConflictDoNothing()
        .run();
    });
  });
}

async function syncTheoryClueNode(clue: { id: string; text: string; isVoid: boolean }) {
  await db
    .update(schema.bookClubTheoryNodes)
    .set({
      title: clue.text,
      kind: clue.isVoid ? "voidClue" : "clue",
      version: sql`${schema.bookClubTheoryNodes.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(schema.bookClubTheoryNodes.sourceClueId, clue.id));
}

export async function bookClubRoutes(fastify: FastifyInstance) {
  fastify.get("/book-clubs/live", { websocket: true }, (socket, request) => {
    let unregister: (() => void) | undefined;
    let authenticating = false;
    let closed = false;
    let pendingReleased = false;
    const clientIp = request.ip;
    const socketCount = socketsByIp.get(clientIp) ?? 0;
    if (socketCount >= maxSocketsPerIp || activeBookClubSockets >= maxBookClubSockets) {
      socket.close(1013, "Too many connections");
      return;
    }
    socketsByIp.set(clientIp, socketCount + 1);
    activeBookClubSockets += 1;
    const releaseSocket = () => {
      const count = socketsByIp.get(clientIp) ?? 0;
      if (count <= 1) socketsByIp.delete(clientIp);
      else socketsByIp.set(clientIp, count - 1);
      activeBookClubSockets = Math.max(0, activeBookClubSockets - 1);
    };
    const pendingSocketCount = unauthenticatedSocketsByIp.get(clientIp) ?? 0;
    if (pendingSocketCount >= maxUnauthenticatedSocketsPerIp) {
      releaseSocket();
      socket.close(1013, "Too many pending connections");
      return;
    }
    unauthenticatedSocketsByIp.set(clientIp, pendingSocketCount + 1);
    const releasePendingSocket = () => {
      if (pendingReleased) return;
      pendingReleased = true;
      const count = unauthenticatedSocketsByIp.get(clientIp) ?? 0;
      if (count <= 1) unauthenticatedSocketsByIp.delete(clientIp);
      else unauthenticatedSocketsByIp.set(clientIp, count - 1);
    };
    const authTimeout = setTimeout(() => socket.close(1008, "Authentication timed out"), 10_000);

    socket.on("close", () => {
      closed = true;
      clearTimeout(authTimeout);
      releaseSocket();
      releasePendingSocket();
      unregister?.();
    });
    socket.on("message", async (payload: { toString: () => string }, isBinary: boolean) => {
      if (unregister || authenticating) return;
      if (isBinary) {
        socket.close(1003, "Binary messages are not supported");
        return;
      }

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

      authenticating = true;
      const session = await authenticateSealedSession(parsed.data.token);
      if (!session) {
        socket.close(1008, "Unauthorized");
        return;
      }
      if (closed) return;

      const removeSocket = registerBookClubSocket(session.user.id, socket);
      if (!removeSocket) {
        socket.close(1013, "Too many connections");
        return;
      }
      unregister = removeSocket;
      releasePendingSocket();
      clearTimeout(authTimeout);
      socket.send(JSON.stringify({ type: "ready", token: session.refreshedToken }));
    });
  });

  fastify.get("/book-clubs", { preHandler: authenticateUser }, async (request) => {
    const memberships = await db
      .select({ bookClubId: schema.bookClubMembers.bookClubId })
      .from(schema.bookClubMembers)
      .where(eq(schema.bookClubMembers.userId, request.userId!));
    const [clubs, invitations] = await Promise.all([
      overviews(memberships.map(({ bookClubId }) => bookClubId)),
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
      await ensureTheoryClueNodes(id);
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
      await ensureTheoryClueNodes(mystery.id);
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
        .select({
          id: schema.bookClubClues.id,
          text: schema.bookClubClues.text,
          isVoid: schema.bookClubClues.isVoid,
        })
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
      if (parsed.data.text !== undefined) {
        await syncTheoryClueNode({ ...clue, text: parsed.data.text });
      }
      const result = await overview(params.data.id);
      await notifyBookClub(params.data.id);
      return result;
    },
  );

  fastify.get(
    "/book-clubs/:id/mysteries/:mysteryId/theorize",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = theoryParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: "Invalid mystery" });
      if (!(await membership(params.data.id, request.userId!)))
        return reply.code(403).send({ error: "You are not in this book club" });
      if (!(await theoryMystery(params.data.id, params.data.mysteryId)))
        return reply.code(404).send({ error: "Mystery not found" });
      await ensureTheoryClueNodes(params.data.mysteryId);
      const [nodes, edges] = await Promise.all([
        db
          .select({ node: schema.bookClubTheoryNodes, nickname: schema.users.nickname })
          .from(schema.bookClubTheoryNodes)
          .leftJoin(schema.users, eq(schema.bookClubTheoryNodes.editingByUserId, schema.users.id))
          .where(eq(schema.bookClubTheoryNodes.mysteryId, params.data.mysteryId)),
        db
          .select()
          .from(schema.bookClubTheoryEdges)
          .where(eq(schema.bookClubTheoryEdges.mysteryId, params.data.mysteryId)),
      ]);
      return {
        nodes: nodes.map(({ node, nickname }) => ({
          ...node,
          tags: parsedTags(node.tags),
          baseTag: baseTagForKind(node.kind),
          editingByNickname:
            node.editLockExpiresAt && node.editLockExpiresAt.getTime() > Date.now() ? nickname : null,
          editingByUserId:
            node.editLockExpiresAt && node.editLockExpiresAt.getTime() > Date.now()
              ? node.editingByUserId
              : null,
        })),
        edges,
      };
    },
  );

  fastify.post(
    "/book-clubs/:id/mysteries/:mysteryId/theorize/nodes",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = theoryParams.safeParse(request.params);
      const parsed = theoryNodeInput.safeParse(request.body);
      if (!params.success || !parsed.success)
        return reply.code(400).send({ error: "Enter a title and valid tags" });
      if (!(await membership(params.data.id, request.userId!)))
        return reply.code(403).send({ error: "You are not in this book club" });
      if (!(await theoryMystery(params.data.id, params.data.mysteryId)))
        return reply.code(404).send({ error: "Mystery not found" });
      const [node] = await db
        .insert(schema.bookClubTheoryNodes)
        .values({
          id: nanoid(),
          mysteryId: params.data.mysteryId,
          ...parsed.data,
          tags: JSON.stringify(normalizedTags(parsed.data.tags)),
        })
        .returning();
      await notifyBookClub(params.data.id);
      return { ...node, tags: parsedTags(node.tags), baseTag: baseTagForKind(node.kind) };
    },
  );

  fastify.put(
    "/book-clubs/:id/mysteries/:mysteryId/theorize/nodes/:nodeId/lock",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = theoryNodeParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: "Invalid board note" });
      if (!(await membership(params.data.id, request.userId!)))
        return reply.code(403).send({ error: "You are not in this book club" });
      if (!(await theoryMystery(params.data.id, params.data.mysteryId)))
        return reply.code(404).send({ error: "Mystery not found" });
      const result = db.transaction((tx) => {
        const node = tx
          .select()
          .from(schema.bookClubTheoryNodes)
          .where(
            and(
              eq(schema.bookClubTheoryNodes.id, params.data.nodeId),
              eq(schema.bookClubTheoryNodes.mysteryId, params.data.mysteryId),
            ),
          )
          .get();
        if (!node) return { status: "missing" as const };
        if (isLockedByAnotherUser(node, request.userId!))
          return { status: "locked" as const, node };
        const expiresAt = new Date(Date.now() + 60_000);
        tx.update(schema.bookClubTheoryNodes)
          .set({ editingByUserId: request.userId!, editLockExpiresAt: expiresAt })
          .where(eq(schema.bookClubTheoryNodes.id, node.id))
          .run();
        return { status: "ok" as const, node: { ...node, editingByUserId: request.userId!, editLockExpiresAt: expiresAt } };
      });
      if (result.status === "missing") return reply.code(404).send({ error: "Board note not found" });
      if (result.status === "locked")
        return reply.code(423).send({ error: "This note is being edited by another player" });
      await notifyBookClub(params.data.id);
      return { ...result.node, tags: parsedTags(result.node.tags), baseTag: baseTagForKind(result.node.kind) };
    },
  );

  fastify.delete(
    "/book-clubs/:id/mysteries/:mysteryId/theorize/nodes/:nodeId/lock",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = theoryNodeParams.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: "Invalid board note" });
      if (!(await membership(params.data.id, request.userId!)))
        return reply.code(403).send({ error: "You are not in this book club" });
      if (!(await theoryMystery(params.data.id, params.data.mysteryId)))
        return reply.code(404).send({ error: "Mystery not found" });
      await db
        .update(schema.bookClubTheoryNodes)
        .set({ editingByUserId: null, editLockExpiresAt: null })
        .where(
          and(
            eq(schema.bookClubTheoryNodes.id, params.data.nodeId),
            eq(schema.bookClubTheoryNodes.mysteryId, params.data.mysteryId),
            eq(schema.bookClubTheoryNodes.editingByUserId, request.userId!),
          ),
        );
      await notifyBookClub(params.data.id);
      return { success: true };
    },
  );

  fastify.put(
    "/book-clubs/:id/mysteries/:mysteryId/theorize/nodes/:nodeId",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = theoryNodeParams.safeParse(request.params);
      const parsed = theoryNodeUpdateInput.safeParse(request.body);
      const changed = parsed.success
        ? ["title", "description", "tags", "x", "y"].some((key) => Object.hasOwn(parsed.data, key))
        : false;
      if (!params.success || !parsed.success || !changed)
        return reply.code(400).send({ error: "Invalid board note update" });
      if (!(await membership(params.data.id, request.userId!)))
        return reply.code(403).send({ error: "You are not in this book club" });
      if (!(await theoryMystery(params.data.id, params.data.mysteryId)))
        return reply.code(404).send({ error: "Mystery not found" });
      const contentChanged = ["title", "description", "tags"].some((key) =>
        Object.hasOwn(parsed.data, key),
      );
      const result = db.transaction((tx) => {
        const node = tx
          .select()
          .from(schema.bookClubTheoryNodes)
          .where(
            and(
              eq(schema.bookClubTheoryNodes.id, params.data.nodeId),
              eq(schema.bookClubTheoryNodes.mysteryId, params.data.mysteryId),
            ),
          )
          .get();
        if (!node) return { status: "missing" as const };
        if (node.version !== parsed.data.version) return { status: "conflict" as const };
        if (node.sourceClueId && parsed.data.title !== undefined)
          return { status: "sourceClue" as const };
        if (contentChanged && (!node.editingByUserId || node.editingByUserId !== request.userId! || !node.editLockExpiresAt || node.editLockExpiresAt.getTime() <= Date.now()))
          return { status: "unlocked" as const };
        const update = {
          ...parsed.data,
          tags: parsed.data.tags ? JSON.stringify(normalizedTags(parsed.data.tags)) : undefined,
          version: node.version + 1,
          updatedAt: new Date(),
        };
        const updated = tx
          .update(schema.bookClubTheoryNodes)
          .set(update)
          .where(eq(schema.bookClubTheoryNodes.id, node.id))
          .returning()
          .get();
        return { status: "ok" as const, node: updated };
      });
      if (result.status === "missing") return reply.code(404).send({ error: "Board note not found" });
      if (result.status === "conflict")
        return reply.code(409).send({ error: "This note changed elsewhere. The board has been refreshed." });
      if (result.status === "sourceClue")
        return reply.code(422).send({ error: "Edit linked clues from the mystery clue list" });
      if (result.status === "unlocked")
        return reply.code(423).send({ error: "Reopen this note to edit it" });
      await notifyBookClub(params.data.id);
      return { ...result.node, tags: parsedTags(result.node.tags), baseTag: baseTagForKind(result.node.kind) };
    },
  );

  fastify.delete(
    "/book-clubs/:id/mysteries/:mysteryId/theorize/nodes/:nodeId",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = theoryNodeParams.safeParse(request.params);
      const parsed = theoryVersionInput.safeParse(request.body);
      if (!params.success || !parsed.success)
        return reply.code(400).send({ error: "Invalid board note" });
      if (!(await membership(params.data.id, request.userId!)))
        return reply.code(403).send({ error: "You are not in this book club" });
      if (!(await theoryMystery(params.data.id, params.data.mysteryId)))
        return reply.code(404).send({ error: "Mystery not found" });
      const node = await db
        .select()
        .from(schema.bookClubTheoryNodes)
        .where(
          and(
            eq(schema.bookClubTheoryNodes.id, params.data.nodeId),
            eq(schema.bookClubTheoryNodes.mysteryId, params.data.mysteryId),
          ),
        )
        .get();
      if (!node) return reply.code(404).send({ error: "Board note not found" });
      if (node.sourceClueId)
        return reply.code(422).send({ error: "Linked clues stay on the board with their mystery" });
      if (node.version !== parsed.data.version)
        return reply.code(409).send({ error: "This note changed elsewhere. The board has been refreshed." });
      if (isLockedByAnotherUser(node, request.userId!))
        return reply.code(423).send({ error: "This note is being edited by another player" });
      if (
        node.editingByUserId !== request.userId! ||
        !node.editLockExpiresAt ||
        node.editLockExpiresAt.getTime() <= Date.now()
      )
        return reply.code(423).send({ error: "Reopen this note to edit it" });
      await db.delete(schema.bookClubTheoryNodes).where(eq(schema.bookClubTheoryNodes.id, node.id));
      await notifyBookClub(params.data.id);
      return { success: true };
    },
  );

  fastify.post(
    "/book-clubs/:id/mysteries/:mysteryId/theorize/edges",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = theoryParams.safeParse(request.params);
      const parsed = theoryEdgeInput.safeParse(request.body);
      if (!params.success || !parsed.success)
        return reply.code(400).send({ error: "Invalid connection" });
      if (!(await membership(params.data.id, request.userId!)))
        return reply.code(403).send({ error: "You are not in this book club" });
      if (!(await theoryMystery(params.data.id, params.data.mysteryId)))
        return reply.code(404).send({ error: "Mystery not found" });
      const [source, target] = await Promise.all(
        [parsed.data.sourceNodeId, parsed.data.targetNodeId].map((nodeId) =>
          db
            .select()
            .from(schema.bookClubTheoryNodes)
            .where(
              and(
                eq(schema.bookClubTheoryNodes.id, nodeId),
                eq(schema.bookClubTheoryNodes.mysteryId, params.data.mysteryId),
              ),
            )
            .get(),
        ),
      );
      if (!source || !target) return reply.code(404).send({ error: "Board note not found" });
      const firstSource =
        source.kind === "clue" && target.kind === "suspect"
          ? await db
              .select({ id: schema.bookClubTheoryEdges.id })
              .from(schema.bookClubTheoryEdges)
              .where(
                and(
                  eq(schema.bookClubTheoryEdges.mysteryId, params.data.mysteryId),
                  eq(schema.bookClubTheoryEdges.sourceNodeId, source.id),
                  eq(schema.bookClubTheoryEdges.targetNodeId, target.id),
                ),
              )
              .get()
          : null;
      const [edge] = await db
        .insert(schema.bookClubTheoryEdges)
        .values({
          id: nanoid(),
          mysteryId: params.data.mysteryId,
          ...parsed.data,
          label: parsed.data.label || (firstSource === undefined ? "source" : ""),
        })
        .returning();
      await notifyBookClub(params.data.id);
      return edge;
    },
  );

  fastify.put(
    "/book-clubs/:id/mysteries/:mysteryId/theorize/edges/:edgeId",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = theoryEdgeParams.safeParse(request.params);
      const parsed = theoryEdgeUpdateInput.safeParse(request.body);
      if (!params.success || !parsed.success)
        return reply.code(400).send({ error: "Invalid connection label" });
      if (!(await membership(params.data.id, request.userId!)))
        return reply.code(403).send({ error: "You are not in this book club" });
      if (!(await theoryMystery(params.data.id, params.data.mysteryId)))
        return reply.code(404).send({ error: "Mystery not found" });
      const [edge] = await db
        .update(schema.bookClubTheoryEdges)
        .set({ label: parsed.data.label, version: sql`${schema.bookClubTheoryEdges.version} + 1`, updatedAt: new Date() })
        .where(
          and(
            eq(schema.bookClubTheoryEdges.id, params.data.edgeId),
            eq(schema.bookClubTheoryEdges.mysteryId, params.data.mysteryId),
            eq(schema.bookClubTheoryEdges.version, parsed.data.version),
          ),
        )
        .returning();
      if (!edge)
        return reply.code(409).send({ error: "This connection changed elsewhere. The board has been refreshed." });
      await notifyBookClub(params.data.id);
      return edge;
    },
  );

  fastify.delete(
    "/book-clubs/:id/mysteries/:mysteryId/theorize/edges/:edgeId",
    { preHandler: authenticateUser },
    async (request, reply) => {
      const params = theoryEdgeParams.safeParse(request.params);
      const parsed = theoryVersionInput.safeParse(request.body);
      if (!params.success || !parsed.success)
        return reply.code(400).send({ error: "Invalid connection" });
      if (!(await membership(params.data.id, request.userId!)))
        return reply.code(403).send({ error: "You are not in this book club" });
      if (!(await theoryMystery(params.data.id, params.data.mysteryId)))
        return reply.code(404).send({ error: "Mystery not found" });
      const deleted = await db
        .delete(schema.bookClubTheoryEdges)
        .where(
          and(
            eq(schema.bookClubTheoryEdges.id, params.data.edgeId),
            eq(schema.bookClubTheoryEdges.mysteryId, params.data.mysteryId),
            eq(schema.bookClubTheoryEdges.version, parsed.data.version),
          ),
        )
        .returning();
      if (!deleted.length)
        return reply.code(409).send({ error: "This connection changed elsewhere. The board has been refreshed." });
      await notifyBookClub(params.data.id);
      return { success: true };
    },
  );
}
