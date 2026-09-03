import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  createDefaultCharacter,
  normalizeCharacter,
  type Ability,
  type CharacterData,
  type CozyItem,
} from "@/lib/character_document";

export type { Ability, CharacterData, CozyItem } from "@/lib/character_document";

export type CharacterRecord = CharacterData & {
  /** Stable local identity. A record keeps this when the server assigns an id. */
  localId: string;
  id?: string;
  version?: number;
};

export type BackendCharacterData = Omit<CharacterData, "schemaVersion">;

export type BackendCharacter = {
  id: string;
  version: number;
  data: BackendCharacterData;
};

export const getDefaultAbilities = (): Ability[] => createDefaultCharacter().abilities;

const newLocalId = () => crypto.randomUUID();
const newRecord = (): CharacterRecord => ({ localId: newLocalId(), ...createDefaultCharacter() });
const recordFrom = (input: unknown, metadata: Pick<CharacterRecord, "localId" | "id" | "version">) => ({
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
  updateRemoteVersion: (localId: string, id: string, version: number) => void;
  updateSelectedRemoteVersion: (id: string, version: number) => void;
  clearSelectedRemoteMetadata: () => void;
  mergeRemote: (backendCharacters: BackendCharacter[]) => void;

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
              ? { ...character, ...normalizeCharacter({ ...character, ...change }) }
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
        updateRemoteVersion: (localId, id, version) => {
          set((state) => ({
            characters: state.characters.map((character) =>
              character.localId === localId ? { ...character, id, version } : character,
            ),
          }));
        },
        updateSelectedRemoteVersion: (id, version) => {
          get().updateRemoteVersion(selectedRecord(get()).localId, id, version);
        },
        clearSelectedRemoteMetadata: () => {
          const current = selectedRecord(get());
          set((state) => ({
            characters: state.characters.map((character) => {
              if (character.localId !== current.localId) return character;
              const localCharacter = { ...character };
              delete localCharacter.id;
              delete localCharacter.version;
              return localCharacter;
            }),
          }));
        },
        mergeRemote: (backendCharacters) => {
          const state = get();
          const characters = [...state.characters];
          for (const remote of backendCharacters) {
            const index = characters.findIndex((character) => character.id === remote.id);
            if (index === -1) {
              characters.push(
                recordFrom(remote.data, { localId: newLocalId(), id: remote.id, version: remote.version }),
              );
            } else if (remote.version > (characters[index].version ?? 0)) {
              characters[index] = recordFrom(remote.data, {
                localId: characters[index].localId,
                id: remote.id,
                version: remote.version,
              });
            }
          }
          set({ characters });
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
