/**
 * The editable character document contract. This module deliberately has no
 * React, store, or translation dependency so import, persistence, and UI
 * editing all share the same normalization rules.
 */
export type Ability = { name: string; value: number };

export type CozyItem = { checked: boolean; text: string };

export type CharacterData = {
  schemaVersion: number;
  name: string;
  style: string;
  activity: string;
  abilities: Ability[];
  xp: number;
  conditions: string;
  endOfSessionChecks: boolean[];
  advancementChecks: boolean[];
  mavenMoves: string;
  crownChecks: boolean[];
  voidChecks: boolean[];
  cozyItems: CozyItem[];
};

export type PersistedCharacter = Omit<CharacterData, "schemaVersion">;

const DEFAULT_ABILITIES: Ability[] = [
  { name: "Vitality", value: 0 },
  { name: "Composure", value: 1 },
  { name: "Reason", value: 1 },
  { name: "Presence", value: 0 },
  { name: "Sensitivity", value: -1 },
];

const DEFAULT_LENGTHS = {
  endOfSessionChecks: 7,
  advancementChecks: 5,
  crownChecks: 7,
  voidChecks: 5,
  cozyItems: 12,
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const booleanArray = (value: unknown, length: number): boolean[] => {
  const values = Array.isArray(value) ? value : [];
  return Array.from({ length }, (_, index) => values[index] === true);
};

const cozyItems = (value: unknown): CozyItem[] => {
  const values = Array.isArray(value) ? value : [];
  return Array.from({ length: DEFAULT_LENGTHS.cozyItems }, (_, index) => {
    const item = values[index];
    return isRecord(item)
      ? { checked: item.checked === true, text: typeof item.text === "string" ? item.text : "" }
      : { checked: false, text: "" };
  });
};

const abilities = (value: unknown): Ability[] => {
  if (!Array.isArray(value) || value.length === 0)
    return DEFAULT_ABILITIES.map((ability) => ({ name: ability.name, value: ability.value }));

  return value.flatMap((ability) =>
    isRecord(ability) && typeof ability.name === "string" && typeof ability.value === "number"
      ? [{ name: ability.name, value: ability.value }]
      : [],
  );
};

/** Creates a new, fully-populated editable character document. */
export const createDefaultCharacter = (): CharacterData => normalizeCharacter({});

/**
 * Converts a partial or legacy document into the current editable shape.
 * Unknown fields are intentionally discarded so they cannot leak into saves.
 */
export const normalizeCharacter = (input: unknown): CharacterData => {
  const value = isRecord(input) ? input : {};
  return {
    schemaVersion: typeof value.schemaVersion === "number" ? value.schemaVersion : 1,
    name: typeof value.name === "string" ? value.name : "",
    style: typeof value.style === "string" ? value.style : "",
    activity: typeof value.activity === "string" ? value.activity : "",
    abilities: abilities(value.abilities),
    xp: typeof value.xp === "number" ? value.xp : 0,
    conditions: typeof value.conditions === "string" ? value.conditions : "",
    endOfSessionChecks: booleanArray(value.endOfSessionChecks, DEFAULT_LENGTHS.endOfSessionChecks),
    advancementChecks: booleanArray(value.advancementChecks, DEFAULT_LENGTHS.advancementChecks),
    mavenMoves: typeof value.mavenMoves === "string" ? value.mavenMoves : "",
    crownChecks: booleanArray(value.crownChecks, DEFAULT_LENGTHS.crownChecks),
    voidChecks: booleanArray(value.voidChecks, DEFAULT_LENGTHS.voidChecks),
    cozyItems: cozyItems(value.cozyItems),
  };
};

/** Normalize only supplied fields, preserving references for untouched sections. */
export const applyCharacterChange = (
  current: CharacterData,
  change: Partial<CharacterData>,
): CharacterData => {
  const normalized = normalizeCharacter(change);
  const next = { ...current };
  for (const key of Object.keys(normalized) as Array<keyof CharacterData>) {
    if (Object.hasOwn(change, key)) Object.assign(next, { [key]: normalized[key] });
  }
  return next;
};

/** Validates import structure before applying the shared normalization rules. */
export const parseImportedCharacter = (input: unknown): CharacterData => normalizeCharacter(input);

/** Removes local-only format metadata before sending a character to the server. */
export const toPersistedCharacter = (character: CharacterData): PersistedCharacter => ({
  name: character.name,
  style: character.style,
  activity: character.activity,
  abilities: character.abilities.map((ability) => ({ ...ability })),
  xp: character.xp,
  conditions: character.conditions,
  endOfSessionChecks: [...character.endOfSessionChecks],
  advancementChecks: [...character.advancementChecks],
  mavenMoves: character.mavenMoves,
  crownChecks: [...character.crownChecks],
  voidChecks: [...character.voidChecks],
  cozyItems: character.cozyItems.map((item) => ({ ...item })),
});
