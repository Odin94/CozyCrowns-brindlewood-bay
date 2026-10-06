import { useEffect, useMemo, useRef, useState } from "react";
import {
  hasDarkConspiracyContent,
  conspiracyContent,
  useDarkConspiracyStore,
  type BackendDarkConspiracy,
  type DarkConspiracyData,
} from "@/lib/dark_conspiracy_store";
import { api } from "@/utils/api";
import { t } from "@lingui/core/macro";
import { toast } from "sonner";
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
  version: data.version ?? 1,
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
  const conflictRef = useRef(new Set<string>());
  const saveSignature = useMemo(() => conspiracyContent(current), [current]);
  const inFlight = useRef(false);
  const [saveTick, setSaveTick] = useState(0);

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
    if (
      !isAuthenticated ||
      !userId ||
      !isReadyToSave ||
      conflictRef.current.has(current.localId ?? current.id ?? "local") ||
      inFlight.current ||
      saveSignature === current.remoteContent ||
      (!current.id && !hasDarkConspiracyContent(current))
    ) {
      return;
    }

    const saveTimeout = window.setTimeout(async () => {
      inFlight.current = true;
      let succeeded = false;
      try {
        const payload = toBackendPayload(current);
        const result = current.id
          ? await api.updateDarkConspiracy(current.id, payload)
          : await api.createDarkConspiracy(payload);
        updateCurrentDarkConspiracyIdAndVersion(
          result.id,
          result.version,
          current.localId,
          saveSignature,
        );
        succeeded = true;
      } catch (error) {
        console.error("Failed to save dark conspiracy:", error);
        if ((error as Error & { status?: number }).status === 409) {
          conflictRef.current.add(current.localId ?? current.id ?? "local");
          toast.error(t`This conspiracy changed elsewhere. Your edits are still here.`, {
            action: {
              label: t`Reload`,
              onClick: () => window.location.reload(),
            },
          });
        } else {
          toast.error(t`Could not save the conspiracy. Your edits are still here.`, {
            action: { label: t`Retry`, onClick: () => setSaveTick((tick) => tick + 1) },
          });
        }
      } finally {
        inFlight.current = false;
        if (
          succeeded ||
          conspiracyContent(useDarkConspiracyStore.getState().current) !== saveSignature
        )
          setSaveTick((tick) => tick + 1);
      }
    }, 900);

    return () => window.clearTimeout(saveTimeout);
    // saveSignature is the stable deep-change trigger for the persisted store object.
  }, [
    current,
    isAuthenticated,
    isReadyToSave,
    saveSignature,
    saveTick,
    updateCurrentDarkConspiracyIdAndVersion,
    userId,
  ]);
};
