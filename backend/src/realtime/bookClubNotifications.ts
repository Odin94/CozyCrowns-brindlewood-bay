import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { notifyBookClubUsers } from "./bookClubUpdates.js";

export const notifyBookClub = async (bookClubId: string) => {
  const members = await db
    .select({ userId: schema.bookClubMembers.userId })
    .from(schema.bookClubMembers)
    .where(eq(schema.bookClubMembers.bookClubId, bookClubId));
  notifyBookClubUsers(members.map((member) => member.userId));
};

export const notifyCharacterBookClubs = async (characterId: string) => {
  const assignments = await db
    .select({ bookClubId: schema.bookClubCharacterAssignments.bookClubId })
    .from(schema.bookClubCharacterAssignments)
    .where(eq(schema.bookClubCharacterAssignments.characterId, characterId));
  await Promise.all(assignments.map((assignment) => notifyBookClub(assignment.bookClubId)));
};
