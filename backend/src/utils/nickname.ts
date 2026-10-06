import { adjectives, animals, uniqueNamesGenerator } from "unique-names-generator";

/** Produces a friendly, URL-safe profile nickname such as "joyful-whale". */
export const generateNickname = () =>
  uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    separator: "-",
    style: "lowerCase",
  });
