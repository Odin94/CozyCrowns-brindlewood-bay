import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Fragment, lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { PageNavigator } from "./components/PageNavigator";
const CharacterSheet = lazy(() => import("./pages/CharacterSheet"));
import { CookieConsent } from "./components/cookie-consent";
import { clearAuthReturnTo, isSafeAuthReturnTo } from "./lib/auth_return_to";

const queryClient = new QueryClient();
const AuthCallback = lazy(() =>
  import("./pages/AuthCallback").then(({ AuthCallback: AuthCallbackPage }) => ({
    default: AuthCallbackPage,
  })),
);
const MysteriesPage = lazy(() => import("./pages/MysteriesPage"));
const LibraryPage = lazy(() => import("./pages/LibraryPage"));
const BookClubMaven = lazy(() => import("./pages/BookClubMaven"));
const BookClubOverview = lazy(() => import("./pages/BookClubOverview"));
const TheorizeBoard = lazy(() => import("./pages/TheorizeBoard"));
const SignInPage = lazy(() => import("./pages/SignInPage"));

const currentLocation = () =>
  window.location.pathname + window.location.search + window.location.hash;
const bookClubPanels = ["mystery", "rolls", "characters", "settings", "notes", "clues"] as const;

const ProtectedRoute = ({
  children,
  returnTo,
  onRequireSignIn,
}: {
  children: React.ReactNode;
  returnTo: string;
  onRequireSignIn: (returnTo: string) => void;
}) => {
  const { isAuthenticated, loading, user } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) onRequireSignIn(returnTo);
  }, [isAuthenticated, loading, onRequireSignIn, returnTo]);

  if (loading || !isAuthenticated) return null;
  return <Fragment key={user?.id}>{children}</Fragment>;
};

function AppRoutes() {
  const [location, setLocation] = useState(currentLocation);
  const pathname = new URL(location, window.location.origin).pathname;
  const searchParams = new URLSearchParams(new URL(location, window.location.origin).search);
  const bookClubMatch = pathname.match(/^\/book-clubs(?:\/([^/]+))?\/?$/);
  const mavenMatch = pathname.match(/^\/book-clubs\/([^/]+)\/mavens\/([^/]+)\/?$/);
  const theorizeMatch = pathname.match(/^\/book-clubs\/([^/]+)\/mysteries\/([^/]+)\/theorize\/?$/);
  const requestedBookClubPanel = searchParams.get("panel");
  const bookClubPanel = bookClubPanels.find((panel) => panel === requestedBookClubPanel) ?? null;
  const isDarkConspiracyRoute = pathname === "/dark-conspiracy";

  useEffect(() => {
    const handlePopState = () => setLocation(currentLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((to: string, { replace = false }: { replace?: boolean } = {}) => {
    if (currentLocation() === to) return;
    window.history[replace ? "replaceState" : "pushState"]({}, "", to);
    setLocation(currentLocation());
  }, []);

  const requireSignIn = useCallback(
    (returnTo: string) => {
      navigate(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    },
    [navigate],
  );
  const onClubChange = useCallback(
    (clubId: string | null) => {
      navigate(clubId ? `/book-clubs/${encodeURIComponent(clubId)}` : "/book-clubs");
    },
    [navigate],
  );
  const onOpenMaven = useCallback(
    (clubId: string, characterId: string) => {
      navigate(
        `/book-clubs/${encodeURIComponent(clubId)}/mavens/${encodeURIComponent(characterId)}`,
      );
    },
    [navigate],
  );
  const signInReturnTo = new URLSearchParams(new URL(location, window.location.origin).search).get(
    "returnTo",
  );

  return (
    <>
      <Suspense fallback={null}>
        {pathname === "/auth/callback" ? (
          <AuthCallback />
        ) : pathname === "/sign-in" ? (
          <SignInPage
            returnTo={isSafeAuthReturnTo(signInReturnTo) ? signInReturnTo : "/"}
            onContinue={(to) => navigate(to, { replace: true })}
            onGoToSheet={() => {
              clearAuthReturnTo();
              navigate("/", { replace: true });
            }}
          />
        ) : pathname === "/mysteries" ? (
          <ProtectedRoute returnTo={location} onRequireSignIn={requireSignIn}>
            <MysteriesPage />
          </ProtectedRoute>
        ) : pathname === "/library" ? (
          <ProtectedRoute returnTo={location} onRequireSignIn={requireSignIn}>
            <LibraryPage />
          </ProtectedRoute>
        ) : isDarkConspiracyRoute ? (
          <CharacterSheet
            onBookClubsClick={() => navigate("/book-clubs")}
            activeView="darkConspiracy"
            onSwitchToCharacter={() => navigate("/")}
          />
        ) : mavenMatch ? (
          <ProtectedRoute returnTo={location} onRequireSignIn={requireSignIn}>
            <BookClubMaven
              key={pathname}
              clubId={decodeURIComponent(mavenMatch[1])}
              characterId={decodeURIComponent(mavenMatch[2])}
              onBack={() => navigate(`/book-clubs/${mavenMatch[1]}`)}
              onGoToSheet={() => navigate("/")}
              onGoToDarkConspiracy={() => navigate("/dark-conspiracy")}
            />
          </ProtectedRoute>
        ) : theorizeMatch ? (
          <ProtectedRoute returnTo={location} onRequireSignIn={requireSignIn}>
            <TheorizeBoard
              bookClubId={decodeURIComponent(theorizeMatch[1])}
              mysteryId={decodeURIComponent(theorizeMatch[2])}
              onClose={() =>
                navigate(
                  `/book-clubs/${encodeURIComponent(decodeURIComponent(theorizeMatch[1]))}?panel=clues`,
                )
              }
            />
          </ProtectedRoute>
        ) : bookClubMatch ? (
          <ProtectedRoute returnTo={location} onRequireSignIn={requireSignIn}>
            <BookClubOverview
              clubId={bookClubMatch[1] ? decodeURIComponent(bookClubMatch[1]) : null}
              panel={bookClubPanel}
              onOpenMaven={onOpenMaven}
              onClose={() => navigate("/")}
              onClubChange={onClubChange}
              onPanelChange={(panel) => {
                const path = bookClubMatch[1]
                  ? `/book-clubs/${encodeURIComponent(decodeURIComponent(bookClubMatch[1]))}`
                  : "/book-clubs";
                navigate(panel ? `${path}?panel=${panel}` : path);
              }}
              onTheorize={(bookClubId, mysteryId) =>
                navigate(
                  `/book-clubs/${encodeURIComponent(bookClubId)}/mysteries/${encodeURIComponent(mysteryId)}/theorize`,
                )
              }
            />
          </ProtectedRoute>
        ) : (
          <CharacterSheet
            onBookClubsClick={() => navigate("/book-clubs")}
            onSwitchToCharacter={() => navigate("/")}
            onSwitchToDarkConspiracy={() => navigate("/dark-conspiracy")}
          />
        )}
      </Suspense>
      <PageNavigator onNavigate={navigate} />
      <CookieConsent variant="small" />
      <Toaster
        theme="light"
        className="toaster"
        toastOptions={{
          style: {
            background: "hsl(280 15% 75%)",
            color: "hsl(280 30% 25%)",
            border: "1px solid hsl(280 25% 60%)",
          },
        }}
      />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <AppRoutes />
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
