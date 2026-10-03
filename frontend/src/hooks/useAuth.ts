import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAnalytics } from "@/lib/analytics";
import { identifyAnalyticsUser, resetAnalyticsAndNavigate } from "@/lib/analytics_session";
import { useEffect, useSyncExternalStore } from "react";
import { accountScope } from "@/lib/account_scope";
import { consumeAuthReturnTo } from "@/lib/auth_return_to";
import { api, API_URL, tokenStorage } from "../utils/api";

const startWorkosSignIn = () => {
  window.location.href = `${API_URL}/auth/login`;
};

const isLocalBrowser = () =>
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "::1";

export const useAuth = () => {
  const queryClient = useQueryClient();
  const session = useSyncExternalStore(accountScope.subscribe, accountScope.current);

  const {
    data: userData,
    isLoading: queryLoading,
    refetch,
  } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const generation = accountScope.current().generation;
      if (accountScope.current().signingOut) throw new Error("Session changed");
      const data = await api.getCurrentUser();
      if (accountScope.current().generation !== generation) throw new Error("Session changed");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...user } = data;
      accountScope.set(user.id);
      return user;
    },
    retry: (failureCount, error) => {
      if (
        accountScope.current().signingOut ||
        (error instanceof Error && error.message === "Session changed")
      )
        return false;
      const status = (error as Error & { status?: number })?.status;
      if (status !== undefined && status >= 400 && status < 500) {
        if (
          status === 401 &&
          (error as Error & { sessionGeneration?: number }).sessionGeneration ===
            accountScope.current().generation
        ) {
          tokenStorage.remove();
        }
        return false;
      }
      if (failureCount < 2) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    staleTime: 5 * 60 * 1000,
    enabled: !!tokenStorage.get() && !session.signingOut,
  });

  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== tokenStorage.key && event.key !== null) return;
      if (!tokenStorage.get()) {
        void queryClient.cancelQueries({ queryKey: ["auth", "me"] });
        queryClient.setQueryData(["auth", "me"], null);
      } else if (!accountScope.current().signingOut) {
        void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [queryClient]);

  const user = tokenStorage.get() && !session.signingOut ? userData || null : null;
  const accountChanged =
    !session.revalidating && !!session.accountId && !!user && session.accountId !== user.id;
  const loading = queryLoading || accountChanged;

  const finishSignIn = (data: { token: string; user: NonNullable<typeof userData> }) => {
    accountScope.set(data.user.id);
    tokenStorage.set(data.token);
    queryClient.setQueryData(["auth", "me"], data.user);
    queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  };

  const localLoginMutation = useMutation({
    mutationFn: () => api.loginLocally(),
    onSuccess: finishSignIn,
  });

  const signIn = startWorkosSignIn;

  const signInLocally = () => {
    localLoginMutation.mutate();
  };

  useEffect(() => {
    if (user) {
      return identifyAnalyticsUser(getAnalytics, user, (error) =>
        console.warn("PostHog identify failed:", error),
      );
    }
  }, [user]);

  const refreshAuth = async () => {
    if (accountScope.current().signingOut) return;
    queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    return refetch();
  };

  const logoutMutation = useMutation({
    mutationFn: (epoch: string) => api.logout(epoch),
    onSuccess: async (data) => {
      if (tokenStorage.sessionKey() !== data.sessionEpoch) return;
      queryClient.setQueryData(["auth", "me"], null);

      await resetAnalyticsAndNavigate(
        getAnalytics,
        () => {
          window.location.href = data.logoutUrl || "/";
        },
        (error) => console.warn("PostHog reset failed:", error),
        () => tokenStorage.sessionKey() === data.sessionEpoch,
      );
    },
    onError: async (_error, epoch) => {
      if (tokenStorage.sessionKey() !== epoch) return;
      tokenStorage.remove();
      const completedEpoch = tokenStorage.sessionKey();
      queryClient.setQueryData(["auth", "me"], null);

      await resetAnalyticsAndNavigate(
        getAnalytics,
        () => {
          window.location.href = "/";
        },
        (error) => console.warn("PostHog reset failed:", error),
        () => tokenStorage.sessionKey() === completedEpoch,
      );
    },
  });

  const handleCallbackMutation = useMutation({
    mutationFn: ({ code, state }: { code: string; state?: string }) =>
      api.handleAuthCallback(code, state),
    onSuccess: (data) => {
      finishSignIn(data);

      window.location.href = consumeAuthReturnTo();
    },
  });

  const signOut = () => {
    if (accountScope.current().accountId !== user?.id) return;
    accountScope.beginSignOut();
    void queryClient.cancelQueries({ queryKey: ["auth", "me"] });
    logoutMutation.mutate(tokenStorage.sessionKey());
  };

  const updateProfileMutation = useMutation({
    mutationFn: (data: { nickname?: string | null }) => api.updateUserProfile(data),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data);
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });

  return {
    user: accountChanged ? null : user,
    loading,
    isAuthenticated: !!user && !accountChanged,
    signIn,
    signInLocally,
    canSignInLocally: isLocalBrowser(),
    isSigningInLocally: localLoginMutation.isPending,
    signOut,
    refreshAuth,
    handleCallback: handleCallbackMutation.mutate,
    isHandlingCallback: handleCallbackMutation.isPending,
    callbackError: handleCallbackMutation.error,
    updateProfile: updateProfileMutation.mutate,
    isUpdatingProfile: updateProfileMutation.isPending,
    updateProfileError: updateProfileMutation.error,
  };
};
