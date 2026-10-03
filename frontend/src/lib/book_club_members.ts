import type { BookClub } from "@/utils/api";

/** Keep unchanged sheet/member identities across fresh overview JSON responses. */
export const preserveBookClubMembers = (previous: BookClub[], incoming: BookClub[]): BookClub[] => {
  const previousById = new Map(previous.map((club) => [club.id, club]));
  return incoming.map((club) => {
    const before = previousById.get(club.id);
    if (!before) return club;
    const membersById = new Map(before.members.map((member) => [member.id, member]));
    const members = club.members.map((member) => {
      const old = membersById.get(member.id);
      if (!old) return member;
      const charactersById = new Map(old.characters.map((character) => [character.id, character]));
      const characters = member.characters.map((character) => {
        const prior = charactersById.get(character.id);
        return prior &&
          prior.version === character.version &&
          prior.updatedAt === character.updatedAt &&
          prior.name === character.name
          ? prior
          : character;
      });
      const sameCharacters =
        characters.length === old.characters.length &&
        characters.every((character, index) => character === old.characters[index]);
      return sameCharacters &&
        member.nickname === old.nickname &&
        member.joinedAt === old.joinedAt &&
        member.isGameMaster === old.isGameMaster
        ? old
        : { ...member, characters };
    });
    const sameMembers =
      members.length === before.members.length &&
      members.every((member, index) => member === before.members[index]);
    return { ...club, members: sameMembers ? before.members : members };
  });
};
