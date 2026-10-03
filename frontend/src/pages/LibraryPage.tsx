import { ContextActions } from "@/components/ContextActions";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { accountScope } from "@/lib/account_scope";
import { ownedMysteryLibrary } from "@/lib/library_mysteries";
import { api, type Mystery, type PublishedMystery } from "@/utils/api";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Check, ChevronLeft, Feather, Library, Plus, ScrollText } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

const copyMystery = async (mystery: PublishedMystery) => {
  await api.copyLibraryMystery(mystery.id);
};

const LibraryPage = () => {
  const { isAuthenticated, loading, signIn, user } = useAuth();
  const session = useSyncExternalStore(accountScope.subscribe, accountScope.current);
  const bookClubId = new URLSearchParams(window.location.search).get("bookClubId");
  const clubQuery = bookClubId ? `?bookClubId=${encodeURIComponent(bookClubId)}` : "";
  const editorPath = `/mysteries${clubQuery}`;
  const backPath = bookClubId
    ? `/book-clubs/${encodeURIComponent(bookClubId)}?panel=mystery`
    : "/mysteries";
  const [owned, setOwned] = useState<Mystery[]>([]);
  const [ownedAccountId, setOwnedAccountId] = useState<string | null>(null);
  const [ownedFetching, setOwnedFetching] = useState(true);
  const [ownedLoadError, setOwnedLoadError] = useState("");
  const ownedRequest = useRef(0);
  const [mysteries, setMysteries] = useState<PublishedMystery[]>([]);
  const [pending, setPending] = useState<PublishedMystery[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState("");
  const request = useRef(0);
  const [libraryAccountId, setLibraryAccountId] = useState<string | null>(null);

  const refreshOwned = useCallback(async () => {
    const scope = accountScope.current();
    if (!user?.id || scope.accountId !== user.id || scope.revalidating || scope.signingOut) return;
    const generation = ++ownedRequest.current;
    const current = () =>
      ownedRequest.current === generation &&
      accountScope.current().accountId === scope.accountId &&
      accountScope.current().generation === scope.generation;
    setOwnedFetching(true);
    setOwnedLoadError("");
    try {
      const result = await api.getMysteries();
      if (!current()) return;
      setOwned(ownedMysteryLibrary(result.mysteries, user.id, localStorage));
      setOwnedAccountId(user.id);
    } catch (error) {
      if (current())
        setOwnedLoadError(
          error instanceof Error ? error.message : t`Could not load your mysteries`,
        );
    } finally {
      if (current()) setOwnedFetching(false);
    }
  }, [user?.id]);

  const refresh = useCallback(async () => {
    const scope = accountScope.current();
    if (!user?.id || scope.accountId !== user.id || scope.revalidating || scope.signingOut) return;
    const generation = ++request.current;
    const current = () =>
      request.current === generation &&
      accountScope.current().accountId === scope.accountId &&
      accountScope.current().generation === scope.generation;
    setFetching(true);
    setLoadError("");
    try {
      const library = await api.getLibrary();
      if (!current()) return;
      setMysteries(library.mysteries);
      setLibraryAccountId(user.id);
      if (user?.isSuperadmin) {
        const moderation = await api.getPendingPublishedMysteries();
        if (!current()) return;
        setPending(moderation.mysteries);
      }
    } catch (error) {
      if (current())
        setLoadError(error instanceof Error ? error.message : t`Could not load library`);
    } finally {
      if (current()) setFetching(false);
    }
  }, [user?.id, user?.isSuperadmin]);

  useEffect(() => {
    const requestOwner = request;
    setMysteries([]);
    setPending([]);
    setLibraryAccountId(null);
    setLoadError("");
    setFetching(true);
    if (isAuthenticated) void refresh();
    return () => {
      requestOwner.current++;
    };
  }, [isAuthenticated, refresh, session.accountId, session.generation, session.revalidating]);

  useEffect(() => {
    const requestOwner = ownedRequest;
    setOwned([]);
    setOwnedAccountId(null);
    setOwnedLoadError("");
    setOwnedFetching(true);
    if (isAuthenticated) void refreshOwned();
    return () => {
      requestOwner.current++;
    };
  }, [isAuthenticated, refreshOwned, session.accountId, session.generation, session.revalidating]);

  if (loading) return null;
  if (!isAuthenticated)
    return (
      <main className="mystery-desk min-h-screen grid place-items-center p-5">
        <section className="mystery-parchment text-center">
          <Library className="mx-auto mb-3" />
          <h1>
            <Trans>The Mystery Library</Trans>
          </h1>
          <p>
            <Trans>Sign in to explore approved mysteries.</Trans>
          </p>
          <Button onClick={signIn} variant="dark" className="mt-4">
            <Trans>Sign in</Trans>
          </Button>
        </section>
      </main>
    );

  const copy = async (mystery: PublishedMystery) => {
    try {
      await copyMystery(mystery);
      toast.success(t`Copied to your private mystery library.`);
      await refreshOwned();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not copy mystery`);
    }
  };
  const approve = async (mystery: PublishedMystery) => {
    try {
      await api.approvePublishedMystery(mystery.id);
      toast.success(t`Mystery approved.`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not approve mystery`);
    }
  };

  return (
    <main className="mystery-desk min-h-screen p-4 pt-12 sm:p-8 sm:pt-14">
      <a
        href={backPath}
        className="mystery-sheet-link"
        aria-label={bookClubId ? t`Back to Book Club` : t`My mysteries`}
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </a>
      <div className="library-page">
        <header className="library-header">
          <div>
            <div className="mb-2 flex justify-center gap-3">
              <Library className="size-9" />
              <Feather className="mystery-quill size-8" aria-hidden="true" />
            </div>
            <h1>
              <Trans>The Mystery Library</Trans>
            </h1>
            <p>
              <Trans>Your private casebook and approved mysteries from the community.</Trans>
            </p>
          </div>
        </header>
        <section className="library-shelf">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="mb-0">
              <Trans>My mysteries</Trans>
            </h2>
            <Button asChild variant="dark">
              <a href={editorPath}>
                <Plus className="size-4" />
                <Trans>Write a mystery</Trans>
              </a>
            </Button>
          </div>
          {ownedLoadError && (
            <div className="cozy-load-error" role="alert">
              <p>{ownedLoadError}</p>
              <Button variant="dark" onClick={() => void refreshOwned()}>
                <Trans>Try again</Trans>
              </Button>
            </div>
          )}
          {ownedFetching && (
            <p role="status">
              <Trans>Opening your casebook…</Trans>
            </p>
          )}
          <div className="library-grid">
            {ownedAccountId === user?.id &&
              session.accountId === user?.id &&
              owned.map((mystery) => {
                const href = `${editorPath}${clubQuery ? "&" : "?"}mysteryId=${encodeURIComponent(mystery.id)}`;
                return (
                  <ContextActions
                    key={mystery.id}
                    actions={[{ label: t`Open mystery`, run: () => window.location.assign(href) }]}
                  >
                    <article className="library-book">
                      <ScrollText className="size-7" aria-hidden="true" />
                      <h3>{mystery.title || <Trans>Untitled Mystery</Trans>}</h3>
                      <p>{mystery.data.intro || <Trans>A carefully guarded case file.</Trans>}</p>
                      <dl>
                        <div>
                          <dt>
                            <Trans>Complexity</Trans>
                          </dt>
                          <dd>{mystery.data.complexity}</dd>
                        </div>
                        <div>
                          <dt>
                            <Trans>Locations</Trans>
                          </dt>
                          <dd>{mystery.data.locations.length}</dd>
                        </div>
                        <div>
                          <dt>
                            <Trans>Suspects</Trans>
                          </dt>
                          <dd>{mystery.data.suspects.length}</dd>
                        </div>
                      </dl>
                      <Button asChild>
                        <a href={href}>
                          <Trans>Open mystery</Trans>
                        </a>
                      </Button>
                    </article>
                  </ContextActions>
                );
              })}
            {!owned.length && !ownedFetching && !ownedLoadError && (
              <p>
                <Trans>No mysteries yet. Start with a fresh sheet.</Trans>
              </p>
            )}
          </div>
        </section>
        {loadError && (
          <section className="cozy-load-error" role="alert">
            <p>{loadError}</p>
            <Button variant="dark" onClick={() => void refresh()}>
              <Trans>Try again</Trans>
            </Button>
          </section>
        )}
        {fetching && (
          <p role="status">
            <Trans>Opening the library…</Trans>
          </p>
        )}
        <section className="library-shelf">
          <h2>
            <Trans>Available to copy</Trans>
          </h2>
          <div className="library-grid">
            {(libraryAccountId === user?.id ? mysteries : []).map((mystery) => (
              <ContextActions
                key={mystery.id}
                actions={[{ label: t`Copy to my library`, run: () => void copy(mystery) }]}
              >
                <article className="library-book">
                  <ScrollText className="size-7" />
                  <h3>{mystery.title}</h3>
                  <p>{mystery.data.intro || <Trans>A carefully guarded case file.</Trans>}</p>
                  <dl>
                    <div>
                      <dt>
                        <Trans>Complexity</Trans>
                      </dt>
                      <dd>{mystery.data.complexity}</dd>
                    </div>
                    <div>
                      <dt>
                        <Trans>Locations</Trans>
                      </dt>
                      <dd>{mystery.data.locations.length}</dd>
                    </div>
                    <div>
                      <dt>
                        <Trans>Suspects</Trans>
                      </dt>
                      <dd>{mystery.data.suspects.length}</dd>
                    </div>
                  </dl>
                  <Button onClick={() => void copy(mystery)}>
                    <Trans>Copy to my library</Trans>
                  </Button>
                </article>
              </ContextActions>
            ))}
            {!mysteries.length && !fetching && !loadError && (
              <p>
                <Trans>No approved mysteries have reached the shelves yet.</Trans>
              </p>
            )}
          </div>
        </section>
        {user?.isSuperadmin && (
          <section className="library-shelf moderation">
            <h2>
              <Trans>Awaiting your approval</Trans>
            </h2>
            <div className="library-grid">
              {(libraryAccountId === user?.id ? pending : []).map((mystery) => (
                <article key={mystery.id} className="library-book">
                  <h3>{mystery.title}</h3>
                  <p>{mystery.data.intro || <Trans>No introduction has been written.</Trans>}</p>
                  <Button variant="dark" onClick={() => void approve(mystery)}>
                    <Check className="size-4" />
                    <Trans>Approve publication</Trans>
                  </Button>
                </article>
              ))}
              {!pending.length && !fetching && !loadError && (
                <p>
                  <Trans>No mysteries await approval.</Trans>
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
};

export default LibraryPage;
