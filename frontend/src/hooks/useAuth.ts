import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import posthog from "posthog-js";
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
      if (data.token) {
        tokenStorage.set(data.token);
      }
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

    try {
      posthog.identify(data.user.id, {
        email: data.user.email,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
      });
    } catch (error) {
      console.warn("PostHog identify failed:", error);
    }
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
      try {
        posthog.identify(user.id, {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        });
      } catch (error) {
        console.warn("PostHog identify failed:", error);
      }
    }
  }, [user]);

  const refreshAuth = async () => {
    if (accountScope.current().signingOut) return;
    queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    return refetch();
  };

  const logoutMutation = useMutation({
    mutationFn: (generation: number) => api.logout().then((data) => ({ ...data, generation })),
    onSuccess: (data) => {
      if (data.generation !== accountScope.current().generation) return;
      tokenStorage.remove();
      queryClient.setQueryData(["auth", "me"], null);

      try {
        posthog.reset();
      } catch (error) {
        console.warn("PostHog reset failed:", error);
      }

      if (data.logoutUrl) {
        window.location.href = data.logoutUrl;
      } else {
        window.location.href = "/";
      }
    },
    onError: (_error, generation) => {
      if (generation !== accountScope.current().generation) return;
      tokenStorage.remove();
      queryClient.setQueryData(["auth", "me"], null);

      try {
        posthog.reset();
      } catch (error) {
        console.warn("PostHog reset failed:", error);
      }

      window.location.href = "/";
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
    logoutMutation.mutate(accountScope.current().generation);
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
