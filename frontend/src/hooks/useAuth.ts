import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAnalytics } from "@/lib/analytics";
import { identifyAnalyticsUser, resetAnalyticsAndNavigate } from "@/lib/analytics_session";
import { useEffect } from "react";
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

  const {
    data: userData,
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const data = await api.getCurrentUser();
      if (data.token) {
        tokenStorage.set(data.token);
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...user } = data;
      return user;
    },
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number })?.status;
      if (status !== undefined && status >= 400 && status < 500) {
        if (status === 401) {
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
    enabled: !!tokenStorage.get(),
  });

  const user = userData || null;

  const finishSignIn = (data: { token: string; user: NonNullable<typeof userData> }) => {
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
    queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    return refetch();
  };

  const logoutMutation = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: async (data) => {
      tokenStorage.remove();
      queryClient.setQueryData(["auth", "me"], null);

      await resetAnalyticsAndNavigate(
        getAnalytics,
        () => {
          window.location.href = data.logoutUrl || "/";
        },
        (error) => console.warn("PostHog reset failed:", error),
      );
    },
    onError: async () => {
      tokenStorage.remove();
      queryClient.setQueryData(["auth", "me"], null);

      await resetAnalyticsAndNavigate(
        getAnalytics,
        () => {
          window.location.href = "/";
        },
        (error) => console.warn("PostHog reset failed:", error),
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
    logoutMutation.mutate();
  };

  const updateProfileMutation = useMutation({
    mutationFn: (data: { nickname?: string | null }) => api.updateUserProfile(data),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data);
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });

  return {
    user: user || null,
    loading,
    isAuthenticated: !!user,
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
