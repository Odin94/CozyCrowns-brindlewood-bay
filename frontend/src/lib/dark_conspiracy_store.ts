import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MysteryRecord = {
  name: string;
  resolution: string;
};

export type DarkConspiracyData = {
  localId?: string;
  remoteContent?: string;
  id?: string;
  version?: number;
  schemaVersion?: number;
  title: string;
  firstVoidClue: string;
  childOfPersephone: string;
  connectedCharactersLayerOne: string;
  layerTwoChecks: boolean[];
  returningCharacter: string;
  childRevisionLayerTwo: string;
  connectedCharactersLayerTwo: string;
  layerThreeChecks: boolean[];
  leaderOfTheMidwives: string;
  midwivesGoalRevision: string;
  connectedCharactersLayerThree: string;
  servitors: string;
  finalChildRevision: string;
  mysteries: MysteryRecord[];
};

export type BackendDarkConspiracy = {
  id: string;
  version: number;
  data: BackendDarkConspiracyData;
};

export type BackendDarkConspiracyData = Omit<
  DarkConspiracyData,
  "id" | "version" | "localId" | "remoteContent"
>;
export const conspiracyContent = (data: DarkConspiracyData) => {
  const content = { ...data };
  delete content.id;
  delete content.version;
  delete content.localId;
  delete content.remoteContent;
  return JSON.stringify(content);
};

const blankMysteries = (): MysteryRecord[] =>
  Array(6)
    .fill(null)
    .map(() => ({ name: "", resolution: "" }));

export const getDefaultDarkConspiracyData = (): DarkConspiracyData => ({
  schemaVersion: 1,
  title: "The Dark Conspiracy",
  firstVoidClue: "",
  childOfPersephone: "",
  connectedCharactersLayerOne: "",
  layerTwoChecks: Array(5).fill(false),
  returningCharacter: "",
  childRevisionLayerTwo: "",
  connectedCharactersLayerTwo: "",
  layerThreeChecks: Array(4).fill(false),
  leaderOfTheMidwives: "",
  midwivesGoalRevision: "",
  connectedCharactersLayerThree: "",
  servitors: "",
  finalChildRevision: "",
  mysteries: blankMysteries(),
});

const normalizeDarkConspiracy = (data: Partial<DarkConspiracyData>): DarkConspiracyData => ({
  ...getDefaultDarkConspiracyData(),
  ...data,
  localId: data.localId ?? crypto.randomUUID(),
  layerTwoChecks: data.layerTwoChecks?.length ? data.layerTwoChecks : Array(5).fill(false),
  layerThreeChecks: data.layerThreeChecks?.length ? data.layerThreeChecks : Array(4).fill(false),
  mysteries: data.mysteries?.length ? data.mysteries : blankMysteries(),
});

export const hasDarkConspiracyContent = (data: DarkConspiracyData): boolean => {
  const textFields = [
    data.firstVoidClue,
    data.childOfPersephone,
    data.connectedCharactersLayerOne,
    data.returningCharacter,
    data.childRevisionLayerTwo,
    data.connectedCharactersLayerTwo,
    data.leaderOfTheMidwives,
    data.midwivesGoalRevision,
    data.connectedCharactersLayerThree,
    data.servitors,
    data.finalChildRevision,
    ...data.mysteries.flatMap((mystery) => [mystery.name, mystery.resolution]),
  ];

  return (
    (data.title.trim() !== "" && data.title !== "The Dark Conspiracy") ||
    textFields.some((field) => field.trim().length > 0) ||
    data.layerTwoChecks.some(Boolean) ||
    data.layerThreeChecks.some(Boolean)
  );
};

export type DarkConspiracyState = {
  darkConspiracies: DarkConspiracyData[];
  currentDarkConspiracyIndex: number;
  current: DarkConspiracyData;
  updateCurrentDarkConspiracy: (updates: Partial<DarkConspiracyData>) => void;
  setCurrentDarkConspiracy: (index: number) => void;
  getDarkConspiracyData: () => DarkConspiracyData;
  replaceCurrentDarkConspiracy: (data: DarkConspiracyData) => void;
  updateCurrentDarkConspiracyIdAndVersion: (
    id: string,
    version: number,
    localId?: string,
    savedContent?: string,
  ) => void;
  syncDarkConspiraciesFromBackend: (backendConspiracies: BackendDarkConspiracy[]) => void;
};

export const useDarkConspiracyStore = create<DarkConspiracyState>()(
  persist(
    (set, get) => {
      const getCurrent = () =>
        get().darkConspiracies[get().currentDarkConspiracyIndex] || getDefaultDarkConspiracyData();

      const setCurrentData = (data: DarkConspiracyData) => {
        const state = get();
        const darkConspiracies = [...state.darkConspiracies];
        darkConspiracies[state.currentDarkConspiracyIndex] = normalizeDarkConspiracy(data);
        set({ darkConspiracies, current: darkConspiracies[state.currentDarkConspiracyIndex] });
      };

      return {
        darkConspiracies: [normalizeDarkConspiracy(getDefaultDarkConspiracyData())],
        currentDarkConspiracyIndex: 0,
        current: getDefaultDarkConspiracyData(),
        updateCurrentDarkConspiracy: (updates) => setCurrentData({ ...getCurrent(), ...updates }),
        setCurrentDarkConspiracy: (index) => {
          const state = get();
          if (index < 0 || index >= state.darkConspiracies.length) return;
          set({
            currentDarkConspiracyIndex: index,
            current: normalizeDarkConspiracy(state.darkConspiracies[index]),
          });
        },
        getDarkConspiracyData: () => getCurrent(),
        replaceCurrentDarkConspiracy: (data) => setCurrentData(normalizeDarkConspiracy(data)),
        updateCurrentDarkConspiracyIdAndVersion: (id, version, localId, savedContent) => {
          const state = get();
          const target = localId ?? getCurrent().localId;
          const darkConspiracies = state.darkConspiracies.map((record) =>
            record.localId === target
              ? { ...record, id, version, remoteContent: savedContent ?? conspiracyContent(record) }
              : record,
          );
          set({ darkConspiracies, current: darkConspiracies[state.currentDarkConspiracyIndex] });
        },
        syncDarkConspiraciesFromBackend: (backendConspiracies) => {
          const state = get();
          const darkConspiracies = [...state.darkConspiracies];
          let selectedIndex = state.currentDarkConspiracyIndex;

          backendConspiracies.forEach((backendConspiracy) => {
            const existingIndex = darkConspiracies.findIndex(
              (conspiracy) => conspiracy.id === backendConspiracy.id,
            );
            const normalized = normalizeDarkConspiracy({
              ...backendConspiracy.data,
              id: backendConspiracy.id,
              version: backendConspiracy.version,
            });

            if (existingIndex === -1) {
              normalized.remoteContent = conspiracyContent(normalized);
              darkConspiracies.push(normalized);
              return;
            }

            const existingVersion = darkConspiracies[existingIndex].version ?? 0;
            if (backendConspiracy.version > existingVersion) {
              const local = darkConspiracies[existingIndex];
              const content = conspiracyContent(local);
              if (
                content !== conspiracyContent(normalized) &&
                (!local.remoteContent || content !== local.remoteContent)
              ) {
                const recovered = { ...local, localId: crypto.randomUUID() };
                delete recovered.id;
                delete recovered.version;
                delete recovered.remoteContent;
                darkConspiracies.push(recovered);
                if (selectedIndex === existingIndex) selectedIndex = darkConspiracies.length - 1;
              }
              normalized.localId = local.localId;
              normalized.remoteContent = conspiracyContent(normalized);
              darkConspiracies[existingIndex] = normalized;
            }
          });

          const currentDarkConspiracyIndex = Math.min(selectedIndex, darkConspiracies.length - 1);
          set({
            darkConspiracies,
            currentDarkConspiracyIndex,
            current: normalizeDarkConspiracy(
              darkConspiracies[currentDarkConspiracyIndex] || getDefaultDarkConspiracyData(),
            ),
          });
        },
      };
    },
    {
      name: "cozycrowns-dark-conspiracy-storage",
      merge: (persisted, current) => {
        const state = persisted as Partial<DarkConspiracyState>;
        const darkConspiracies = state.darkConspiracies?.length
          ? state.darkConspiracies.map(normalizeDarkConspiracy)
          : current.darkConspiracies;
        const index = Math.max(
          0,
          Math.min(state.currentDarkConspiracyIndex ?? 0, darkConspiracies.length - 1),
        );
        return {
          ...current,
          darkConspiracies,
          currentDarkConspiracyIndex: index,
          current: darkConspiracies[index],
        };
      },
    },
  ),
);
