import { useEffect, useMemo, useRef, useState } from "react";
import {
  hasDarkConspiracyContent,
  useDarkConspiracyStore,
  type BackendDarkConspiracy,
  type DarkConspiracyData,
} from "@/lib/dark_conspiracy_store";
import { api } from "@/utils/api";
import { useAuth } from "./useAuth";

const toBackendPayload = (data: DarkConspiracyData) => ({
  title: data.title || "The Dark Conspiracy",
  data: {
    schemaVersion: data.schemaVersion ?? 1,
    title: data.title || "The Dark Conspiracy",
    firstVoidClue: data.firstVoidClue,
    childOfPersephone: data.childOfPersephone,
    connectedCharactersLayerOne: data.connectedCharactersLayerOne,
    layerTwoChecks: data.layerTwoChecks,
    returningCharacter: data.returningCharacter,
    childRevisionLayerTwo: data.childRevisionLayerTwo,
    connectedCharactersLayerTwo: data.connectedCharactersLayerTwo,
    layerThreeChecks: data.layerThreeChecks,
    leaderOfTheMidwives: data.leaderOfTheMidwives,
    midwivesGoalRevision: data.midwivesGoalRevision,
    connectedCharactersLayerThree: data.connectedCharactersLayerThree,
    servitors: data.servitors,
    finalChildRevision: data.finalChildRevision,
    mysteries: data.mysteries,
  },
  version: data.version,
});

export const useBackendDarkConspiraciesSync = () => {
  const { isAuthenticated, user } = useAuth();
  const userId = user?.id;
  const current = useDarkConspiracyStore((state) => state.current);
  const syncDarkConspiraciesFromBackend = useDarkConspiracyStore(
    (state) => state.syncDarkConspiraciesFromBackend,
  );
  const updateCurrentDarkConspiracyIdAndVersion = useDarkConspiracyStore(
    (state) => state.updateCurrentDarkConspiracyIdAndVersion,
  );
  const [isReadyToSave, setIsReadyToSave] = useState(false);
  const syncedUserIdRef = useRef<string | null>(null);
  const saveSignature = useMemo(() => JSON.stringify(current), [current]);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      syncedUserIdRef.current = null;
      setIsReadyToSave(false);
      return;
    }

    if (syncedUserIdRef.current === userId) {
      setIsReadyToSave(true);
      return;
    }

    const syncDarkConspiracies = async () => {
      try {
        const response = await api.getDarkConspiracies();
        const backendConspiracies: BackendDarkConspiracy[] = response.darkConspiracies.map(
          (conspiracy) => ({
            id: conspiracy.id,
            version: conspiracy.version,
            data: conspiracy.data,
          }),
        );

        if (backendConspiracies.length > 0) {
          syncDarkConspiraciesFromBackend(backendConspiracies);
        }

        syncedUserIdRef.current = userId;
        setIsReadyToSave(true);
      } catch (error) {
        console.error("Failed to sync dark conspiracies from backend:", error);
      }
    };

    void syncDarkConspiracies();
  }, [isAuthenticated, syncDarkConspiraciesFromBackend, userId]);

  useEffect(() => {
    if (!isAuthenticated || !userId || !isReadyToSave || !hasDarkConspiracyContent(current)) {
      return;
    }

    const saveTimeout = window.setTimeout(async () => {
      try {
        const payload = toBackendPayload(current);
        const result = current.id
          ? await api.updateDarkConspiracy(current.id, payload)
          : await api.createDarkConspiracy(payload);
        updateCurrentDarkConspiracyIdAndVersion(result.id, result.version);
      } catch (error) {
        console.error("Failed to save dark conspiracy:", error);
      }
    }, 900);

    return () => window.clearTimeout(saveTimeout);
    // saveSignature is the stable deep-change trigger for the persisted store object.
  }, [
    current,
    isAuthenticated,
    isReadyToSave,
    saveSignature,
    updateCurrentDarkConspiracyIdAndVersion,
    userId,
  ]);
};
