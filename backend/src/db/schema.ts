import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  nickname: text("nickname").unique(),
  isSuperadmin: integer("is_superadmin", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const characters = sqliteTable(
  "characters",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    data: text("data").notNull(),
    version: integer("version").notNull().default(1),
    characterVersion: integer("character_version").notNull().default(0),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("characters_user_id_idx").on(table.userId),
  }),
);

export const darkConspiracies = sqliteTable(
  "dark_conspiracies",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    data: text("data").notNull(),
    version: integer("version").notNull().default(1),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("dark_conspiracies_user_id_idx").on(table.userId),
  }),
);

export const mysteries = sqliteTable(
  "mysteries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    data: text("data").notNull(),
    version: integer("version").notNull().default(1),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({ userIdIdx: index("mysteries_user_id_idx").on(table.userId) }),
);

export const mysteryVersions = sqliteTable(
  "mystery_versions",
  {
    id: text("id").primaryKey(),
    mysteryId: text("mystery_id")
      .notNull()
      .references(() => mysteries.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    data: text("data").notNull(),
    sourceVersion: integer("source_version").notNull(),
    kind: text("kind", { enum: ["auto", "manual", "publication"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    mysteryCreatedIdx: index("mystery_versions_mystery_created_idx").on(
      table.mysteryId,
      table.kind,
      table.createdAt,
    ),
  }),
);

export const publishedMysteries = sqliteTable(
  "published_mysteries",
  {
    id: text("id").primaryKey(),
    mysteryId: text("mystery_id")
      .notNull()
      .references(() => mysteries.id, { onDelete: "cascade" })
      .unique(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    data: text("data").notNull(),
    sourceVersion: integer("source_version").notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),
    submittedAt: integer("submitted_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    approvedByUserId: text("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    statusIdx: index("published_mysteries_status_idx").on(table.status, table.submittedAt),
    ownerIdx: index("published_mysteries_owner_idx").on(table.ownerId),
  }),
);

export const characterShares = sqliteTable(
  "character_shares",
  {
    id: text("id").primaryKey(),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    sharedWithUserId: text("shared_with_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sharedById: text("shared_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    characterIdIdx: index("character_shares_character_id_idx").on(table.characterId),
    sharedWithUserIdIdx: index("character_shares_shared_with_user_id_idx").on(
      table.sharedWithUserId,
    ),
    uniqueShare: index("character_shares_unique_idx").on(table.characterId, table.sharedWithUserId),
  }),
);

export const bookClubs = sqliteTable(
  "book_clubs",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({ ownerIdx: index("book_clubs_owner_idx").on(table.ownerId) }),
);

export const bookClubMembers = sqliteTable(
  "book_club_members",
  {
    bookClubId: text("book_club_id")
      .notNull()
      .references(() => bookClubs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: integer("joined_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    isGameMaster: integer("is_game_master", { mode: "boolean" }).notNull().default(false),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bookClubId, table.userId] }),
    userIdx: index("book_club_members_user_idx").on(table.userId),
    oneGameMaster: uniqueIndex("book_club_members_one_gm_idx")
      .on(table.bookClubId)
      .where(sql`${table.isGameMaster} = 1`),
  }),
);

export const bookClubInvitations = sqliteTable(
  "book_club_invitations",
  {
    bookClubId: text("book_club_id")
      .notNull()
      .references(() => bookClubs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bookClubId, table.userId] }),
    userIdx: index("book_club_invitations_user_idx").on(table.userId),
  }),
);

export const bookClubCharacterAssignments = sqliteTable(
  "book_club_character_assignments",
  {
    bookClubId: text("book_club_id")
      .notNull()
      .references(() => bookClubs.id, { onDelete: "cascade" }),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    assignedAt: integer("assigned_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bookClubId, table.characterId] }),
    characterIdx: index("book_club_character_assignments_character_idx").on(table.characterId),
  }),
);

export const bookClubRollEvents = sqliteTable(
  "book_club_roll_events",
  {
    id: text("id").primaryKey(),
    bookClubId: text("book_club_id")
      .notNull()
      .references(() => bookClubs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    characterId: text("character_id").references(() => characters.id, { onDelete: "set null" }),
    characterName: text("character_name").notNull(),
    label: text("label").notNull(),
    dice: text("dice").notNull(),
    result: text("result").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    bookClubCreatedIdx: index("book_club_roll_events_book_club_created_idx").on(
      table.bookClubId,
      table.createdAt,
    ),
  }),
);

export const bookClubMysteries = sqliteTable(
  "book_club_mysteries",
  {
    id: text("id").primaryKey(),
    bookClubId: text("book_club_id")
      .notNull()
      .references(() => bookClubs.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({ bookClubIdx: index("book_club_mysteries_book_club_idx").on(table.bookClubId) }),
);

export const bookClubClues = sqliteTable(
  "book_club_clues",
  {
    id: text("id").primaryKey(),
    mysteryId: text("mystery_id")
      .notNull()
      .references(() => bookClubMysteries.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isVoid: integer("is_void", { mode: "boolean" }).notNull().default(false),
    checked: integer("checked", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({ mysteryIdx: index("book_club_clues_mystery_idx").on(table.mysteryId) }),
);

export const bookClubTheoryNodes = sqliteTable(
  "book_club_theory_nodes",
  {
    id: text("id").primaryKey(),
    mysteryId: text("mystery_id")
      .notNull()
      .references(() => bookClubMysteries.id, { onDelete: "cascade" }),
    // A linked clue is managed by the regular clue list and cannot be removed from the board.
    sourceClueId: text("source_clue_id").references(() => bookClubClues.id, {
      onDelete: "cascade",
    }),
    kind: text("kind", { enum: ["clue", "voidClue", "suspect", "other"] }).notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    tags: text("tags").notNull().default("[]"),
    x: integer("x").notNull().default(160),
    y: integer("y").notNull().default(160),
    version: integer("version").notNull().default(1),
    editingByUserId: text("editing_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    editLockExpiresAt: integer("edit_lock_expires_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    mysteryIdx: index("book_club_theory_nodes_mystery_idx").on(table.mysteryId),
    sourceClueIdx: uniqueIndex("book_club_theory_nodes_source_clue_idx").on(table.sourceClueId),
  }),
);

export const bookClubTheoryEdges = sqliteTable(
  "book_club_theory_edges",
  {
    id: text("id").primaryKey(),
    mysteryId: text("mystery_id")
      .notNull()
      .references(() => bookClubMysteries.id, { onDelete: "cascade" }),
    sourceNodeId: text("source_node_id")
      .notNull()
      .references(() => bookClubTheoryNodes.id, { onDelete: "cascade" }),
    targetNodeId: text("target_node_id")
      .notNull()
      .references(() => bookClubTheoryNodes.id, { onDelete: "cascade" }),
    label: text("label").notNull().default(""),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    mysteryIdx: index("book_club_theory_edges_mystery_idx").on(table.mysteryId),
    sourceIdx: index("book_club_theory_edges_source_idx").on(table.sourceNodeId),
    targetIdx: index("book_club_theory_edges_target_idx").on(table.targetNodeId),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  characters: many(characters),
  darkConspiracies: many(darkConspiracies),
  sharedCharacters: many(characterShares, { relationName: "sharedWith" }),
  sharedBy: many(characterShares, { relationName: "sharedBy" }),
}));

export const charactersRelations = relations(characters, ({ one, many }) => ({
  user: one(users, {
    fields: [characters.userId],
    references: [users.id],
  }),
  shares: many(characterShares),
}));

export const darkConspiraciesRelations = relations(darkConspiracies, ({ one }) => ({
  user: one(users, {
    fields: [darkConspiracies.userId],
    references: [users.id],
  }),
}));

export const characterSharesRelations = relations(characterShares, ({ one }) => ({
  character: one(characters, {
    fields: [characterShares.characterId],
    references: [characters.id],
  }),
  sharedWith: one(users, {
    fields: [characterShares.sharedWithUserId],
    references: [users.id],
    relationName: "sharedWith",
  }),
  sharedBy: one(users, {
    fields: [characterShares.sharedById],
    references: [users.id],
    relationName: "sharedBy",
  }),
}));
