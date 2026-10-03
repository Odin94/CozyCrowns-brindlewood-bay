import assert from "node:assert/strict";
import test from "node:test";
import { preserveBookClubMembers } from "../../frontend/src/lib/book_club_members.ts";
import type { BookClub } from "../../frontend/src/utils/api.ts";

const fixture = (): BookClub => ({
  id: "club",
  name: "Club",
  ownerId: "owner",
  sharedNotes: "old",
  sharedNotesVersion: 1,
  createdAt: "2026-10-03",
  rolls: [],
  mysteries: [],
  activeMystery: null,
  members: [
    {
      id: "owner",
      nickname: "Keeper",
      joinedAt: "2026-10-03",
      isGameMaster: true,
      characters: [
        {
          id: "sheet",
          name: "Maven",
          version: 1,
          updatedAt: "2026-10-03",
          data: { name: "Maven" },
        } as BookClub["members"][number]["characters"][number],
      ],
    },
  ],
});
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test("fresh JSON preserves unchanged members while keeping club metadata current", () => {
  const old = fixture(),
    next = clone(old);
  next.sharedNotes = "new";
  next.sharedNotesVersion = 2;
  next.ownerId = "new-owner";
  const result = preserveBookClubMembers([old], [next])[0];
  assert.equal(result.members, old.members);
  assert.equal(result.sharedNotes, "new");
  assert.equal(result.sharedNotesVersion, 2);
  assert.equal(result.ownerId, "new-owner");
});

test("sheet revisions and fresh member metadata invalidate only their affected references", () => {
  const old = fixture(),
    next = clone(old);
  next.members[0].nickname = "Renamed";
  next.members[0].isGameMaster = false;
  const member = preserveBookClubMembers([old], [next])[0].members[0];
  assert.notEqual(member, old.members[0]);
  assert.equal(member.characters[0], old.members[0].characters[0]);
  assert.equal(member.nickname, "Renamed");
  assert.equal(member.isGameMaster, false);
  const revised = clone(old);
  revised.members[0].characters[0].version++;
  revised.members[0].characters[0].data = { abilities: "Changed while timestamp remains equal" };
  assert.equal(
    preserveBookClubMembers([old], [revised])[0].members[0].characters[0],
    revised.members[0].characters[0],
  );
});

test("removed, reordered and reassigned sheets or members keep the incoming collection shape", () => {
  const old = fixture();
  old.members.push({ ...clone(old.members[0]), id: "other", characters: [] });
  const removed = clone(old);
  removed.members[0].characters = [];
  assert.equal(preserveBookClubMembers([old], [removed])[0].members[0].characters.length, 0);
  const reordered = clone(old);
  reordered.members.reverse();
  assert.deepEqual(
    preserveBookClubMembers([old], [reordered])[0].members.map((m) => m.id),
    ["other", "owner"],
  );
  const reassigned = clone(old);
  reassigned.members[1].characters = reassigned.members[0].characters;
  reassigned.members[0].characters = [];
  const result = preserveBookClubMembers([old], [reassigned])[0];
  assert.equal(result.members[1].characters[0], reassigned.members[1].characters[0]);
  const anotherClub = clone(old);
  anotherClub.id = "other-club";
  assert.equal(preserveBookClubMembers([old], [anotherClub])[0], anotherClub);
});
