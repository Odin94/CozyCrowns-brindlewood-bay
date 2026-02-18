import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { relations } from "drizzle-orm"
import { sql } from "drizzle-orm"

export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    nickname: text("nickname").unique(),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
})

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
)

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
        sharedWithUserIdIdx: index("character_shares_shared_with_user_id_idx").on(table.sharedWithUserId),
        uniqueShare: index("character_shares_unique_idx").on(table.characterId, table.sharedWithUserId),
    }),
)

export const usersRelations = relations(users, ({ many }) => ({
    characters: many(characters),
    sharedCharacters: many(characterShares, { relationName: "sharedWith" }),
    sharedBy: many(characterShares, { relationName: "sharedBy" }),
}))

export const charactersRelations = relations(characters, ({ one, many }) => ({
    user: one(users, {
        fields: [characters.userId],
        references: [users.id],
    }),
    shares: many(characterShares),
}))

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
}))
