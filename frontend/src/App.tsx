import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useCallback, useEffect, useState } from "react";
import CharacterSheet from "./pages/CharacterSheet";
import { AuthCallback } from "./pages/AuthCallback";
import { CookieConsent } from "./components/cookie-consent";
import MysteriesPage from "./pages/MysteriesPage";
import LibraryPage from "./pages/LibraryPage";
import BookClubOverview from "./pages/BookClubOverview";

const queryClient = new QueryClient();

function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const bookClubMatch = pathname.match(/^\/book-clubs(?:\/([^/]+))?\/?$/);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (window.location.pathname === to) return;
    window.history.pushState({}, "", to);
    setPathname(to);
  }, []);

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <I18nProvider i18n={i18n}>
          {pathname === "/auth/callback" ? (
            <AuthCallback />
          ) : pathname === "/mysteries" ? (
            <MysteriesPage />
          ) : pathname === "/library" ? (
            <LibraryPage />
          ) : bookClubMatch ? (
            <BookClubOverview
              clubId={bookClubMatch[1] ? decodeURIComponent(bookClubMatch[1]) : null}
              onClose={() => navigate("/")}
              onClubChange={(clubId) => navigate(`/book-clubs/${encodeURIComponent(clubId)}`)}
            />
          ) : (
            <CharacterSheet onBookClubsClick={() => navigate("/book-clubs")} />
          )}
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
        </I18nProvider>
      </QueryClientProvider>
    </>
  );
}

export default App;
