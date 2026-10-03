import { reconcileMavenRecords } from "./maven_persistence";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  createDefaultCharacter,
  applyCharacterChange,
  normalizeCharacter,
  type Ability,
  type CharacterData,
  type CozyItem,
} from "@/lib/character_document";
import { t } from "@lingui/core/macro";

export type { Ability, CharacterData, CozyItem } from "@/lib/character_document";

export type CharacterRecord = CharacterData & {
  /** Stable local identity. A record keeps this when the server assigns an id. */
  localId: string;
  id?: string;
  version?: number;
  ownerId?: string;
  syncedContent?: string;
};

export type BackendCharacterData = Omit<CharacterData, "schemaVersion">;

export type BackendCharacter = {
  id: string;
  version: number;
  data: BackendCharacterData;
};

export const getDefaultAbilities = (): Ability[] => [
  { name: t`Vitality`, value: 0 },
  { name: t`Composure`, value: 1 },
  { name: t`Reason`, value: 1 },
  { name: t`Presence`, value: 0 },
  { name: t`Sensitivity`, value: -1 },
];

const newLocalId = () => crypto.randomUUID();
const newRecord = (): CharacterRecord => ({
  localId: newLocalId(),
  ...createDefaultCharacter(),
  abilities: getDefaultAbilities(),
});
const recordFrom = (
  input: unknown,
  metadata: Pick<CharacterRecord, "localId" | "id" | "version" | "ownerId" | "syncedContent">,
) => ({
  ...normalizeCharacter(input),
  ...metadata,
});

export type CharacterState = {
  characters: CharacterRecord[];
  selectedCharacterId: string;

  select: (localId: string) => void;
  create: () => string;
  remove: (localId: string) => void;
  updateSelected: (change: Partial<CharacterData>) => void;
  selected: () => CharacterRecord;
  record: (localId: string) => CharacterRecord | undefined;
  claimOwner: (localId: string, ownerId: string) => void;
  updateRemoteVersion: (
    localId: string,
    id: string,
    version: number,
    ownerId?: string,
    syncedContent?: string,
  ) => void;
  updateSelectedRemoteVersion: (id: string, version: number) => void;
  clearSelectedRemoteMetadata: () => void;
  mergeRemote: (
    backendCharacters: BackendCharacter[],
    ownerId?: string,
    canReplace?: (record: CharacterRecord) => boolean,
  ) => void;

  // Compatibility helpers keep existing UI modules small while all document
  // state remains in `characters` instead of mirrored top-level fields.
  setName: (name: string) => void;
  setStyle: (style: string) => void;
  setActivity: (activity: string) => void;
  setAbilities: (abilities: Ability[]) => void;
  setXp: (xp: number) => void;
  setConditions: (conditions: string) => void;
  setEndOfSessionChecks: (checks: boolean[]) => void;
  setAdvancementChecks: (checks: boolean[]) => void;
  setMavenMoves: (moves: string) => void;
  setCrownChecks: (checks: boolean[]) => void;
  setVoidChecks: (checks: boolean[]) => void;
  setCozyItems: (items: CozyItem[]) => void;
  getCharacterData: () => CharacterRecord;
  addCharacter: () => void;
  removeCharacter: (index: number) => void;
  setCurrentCharacter: (index: number) => void;
  updateCharacterIdAndVersion: (index: number, id: string, version: number) => void;
  clearCurrentCharacterIdAndVersion: () => void;
  syncCharactersFromBackend: (backendCharacters: BackendCharacter[]) => void;
};

const selectedRecord = (state: Pick<CharacterState, "characters" | "selectedCharacterId">) =>
  state.characters.find((character) => character.localId === state.selectedCharacterId) ??
  state.characters[0] ??
  newRecord();

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set, get) => {
      const updateSelected = (change: Partial<CharacterData>) => {
        const state = get();
        const current = selectedRecord(state);
        set({
          characters: state.characters.map((character) =>
            character.localId === current.localId
              ? Object.assign({}, character, applyCharacterChange(character, change))
              : character,
          ),
        });
      };
      const indexFor = (index: number) => get().characters[index]?.localId;

      const initial = newRecord();
      return {
        characters: [initial],
        selectedCharacterId: initial.localId,
        select: (localId) => {
          if (get().characters.some((character) => character.localId === localId)) {
            set({ selectedCharacterId: localId });
          }
        },
        create: () => {
          const character = newRecord();
          set((state) => ({
            characters: [...state.characters, character],
            selectedCharacterId: character.localId,
          }));
          return character.localId;
        },
        remove: (localId) => {
          const state = get();
          const index = state.characters.findIndex((character) => character.localId === localId);
          if (index < 0) return;
          const characters = state.characters.filter((character) => character.localId !== localId);
          const next = characters[Math.min(index, characters.length - 1)] ?? newRecord();
          set({
            characters: characters.length > 0 ? characters : [next],
            selectedCharacterId: next.localId,
          });
        },
        updateSelected,
        selected: () => selectedRecord(get()),
        record: (localId) => get().characters.find((character) => character.localId === localId),
        claimOwner: (localId, ownerId) =>
          set((state) => ({
            characters: state.characters.map((character) =>
              character.localId === localId ? { ...character, ownerId } : character,
            ),
          })),
        updateRemoteVersion: (localId, id, version, ownerId, syncedContent) => {
          set((state) => ({
            characters: state.characters.map((character) =>
              character.localId === localId
                ? {
                    ...character,
                    id,
                    version,
                    ownerId: ownerId ?? character.ownerId,
                    syncedContent: syncedContent ?? character.syncedContent,
                  }
                : character,
            ),
          }));
        },
        updateSelectedRemoteVersion: (id, version) => {
          get().updateRemoteVersion(selectedRecord(get()).localId, id, version);
        },
        clearSelectedRemoteMetadata: () => {
          const current = selectedRecord(get());
          const localId = newLocalId();
          set((state) => ({
            selectedCharacterId: localId,
            characters: state.characters.map((character) => {
              if (character.localId !== current.localId) return character;
              const localCharacter = { ...character };
              delete localCharacter.id;
              delete localCharacter.version;
              delete localCharacter.ownerId;
              delete localCharacter.syncedContent;
              localCharacter.localId = localId;
              return localCharacter;
            }),
          }));
        },
        mergeRemote: (backendCharacters, ownerId, canReplace = () => true) => {
          set({
            characters: reconcileMavenRecords(
              get().characters,
              backendCharacters,
              ownerId,
              canReplace,
              newLocalId,
            ),
          });
        },
        setName: (name) => updateSelected({ name }),
        setStyle: (style) => updateSelected({ style }),
        setActivity: (activity) => updateSelected({ activity }),
        setAbilities: (abilities) => updateSelected({ abilities }),
        setXp: (xp) => updateSelected({ xp }),
        setConditions: (conditions) => updateSelected({ conditions }),
        setEndOfSessionChecks: (endOfSessionChecks) => updateSelected({ endOfSessionChecks }),
        setAdvancementChecks: (advancementChecks) => updateSelected({ advancementChecks }),
        setMavenMoves: (mavenMoves) => updateSelected({ mavenMoves }),
        setCrownChecks: (crownChecks) => updateSelected({ crownChecks }),
        setVoidChecks: (voidChecks) => updateSelected({ voidChecks }),
        setCozyItems: (cozyItems) => updateSelected({ cozyItems }),
        getCharacterData: () => selectedRecord(get()),
        addCharacter: () => {
          get().create();
        },
        removeCharacter: (index) => {
          const localId = indexFor(index);
          if (localId) get().remove(localId);
        },
        setCurrentCharacter: (index) => {
          const localId = indexFor(index);
          if (localId) get().select(localId);
        },
        updateCharacterIdAndVersion: (index, id, version) => {
          const localId = indexFor(index);
          if (localId) get().select(localId);
          get().updateSelectedRemoteVersion(id, version);
        },
        clearCurrentCharacterIdAndVersion: () => get().clearSelectedRemoteMetadata(),
        syncCharactersFromBackend: (backendCharacters) => get().mergeRemote(backendCharacters),
      };
    },
    {
      name: "cozycrowns-character-storage",
      version: 2,
      migrate: (persisted) => {
        const oldState = persisted as Partial<CharacterState> & {
          currentCharacterIndex?: number;
          characters?: Array<Record<string, unknown>>;
        };
        const migratedCharacters =
          oldState.characters?.map((character) =>
            recordFrom(character, {
              localId: typeof character.localId === "string" ? character.localId : newLocalId(),
              id: typeof character.id === "string" ? character.id : undefined,
              version: typeof character.version === "number" ? character.version : undefined,
            }),
          ) ?? [];
        const characters = migratedCharacters.length > 0 ? migratedCharacters : [newRecord()];
        const selected = characters[oldState.currentCharacterIndex ?? 0] ?? characters[0];
        return { characters, selectedCharacterId: selected.localId } as CharacterState;
      },
      merge: (persisted, current) => {
        const state = persisted as Partial<CharacterState>;
        const characters = state.characters?.length
          ? state.characters.map((character) =>
              recordFrom(character, {
                localId: character.localId || newLocalId(),
                id: character.id,
                version: character.version,
                ownerId: character.ownerId,
                syncedContent: character.syncedContent,
              }),
            )
          : current.characters;
        const selectedCharacterId = characters.some(
          (character) => character.localId === state.selectedCharacterId,
        )
          ? state.selectedCharacterId!
          : characters[0].localId;
        return { ...current, characters, selectedCharacterId };
      },
    },
  ),
);
