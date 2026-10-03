import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "./useAuth";
import { mavenPersistence } from "@/lib/maven_runtime";
import { accountScope } from "@/lib/account_scope";

export const useBackendCharactersSync = () => {
  const { isAuthenticated, user } = useAuth();
  const userId = user?.id;
  const session = useSyncExternalStore(accountScope.subscribe, accountScope.current);
  useEffect(() => {
    if (isAuthenticated && userId && !session.revalidating && !session.signingOut)
      void mavenPersistence
        .sync()
        .catch((error) => console.error("Failed to sync characters from backend:", error));
  }, [isAuthenticated, userId, session]);
};
