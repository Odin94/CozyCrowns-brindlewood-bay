import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { api, type PublishedMystery } from "@/utils/api";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Check, ChevronLeft, Feather, Library, ScrollText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const copyMystery = async (mystery: PublishedMystery) => {
  await api.copyLibraryMystery(mystery.id);
};

const LibraryPage = () => {
  const { isAuthenticated, loading, signIn, user } = useAuth();
  const [mysteries, setMysteries] = useState<PublishedMystery[]>([]);
  const [pending, setPending] = useState<PublishedMystery[]>([]);

  const refresh = useCallback(async () => {
    try {
      const library = await api.getLibrary();
      setMysteries(library.mysteries);
      if (user?.isSuperadmin) {
        const moderation = await api.getPendingPublishedMysteries();
        setPending(moderation.mysteries);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not load library`);
    }
  }, [user?.isSuperadmin]);

  useEffect(() => {
    if (isAuthenticated) void refresh();
  }, [isAuthenticated, refresh]);

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
      <a href="/mysteries" className="mystery-sheet-link" aria-label={t`My mysteries`}>
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
              <Trans>Approved cases, copied as snapshots into your own casebook.</Trans>
            </p>
          </div>
        </header>
        <section className="library-shelf">
          <h2>
            <Trans>Available to copy</Trans>
          </h2>
          <div className="library-grid">
            {mysteries.map((mystery) => (
              <article key={mystery.id} className="library-book">
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
            ))}
            {!mysteries.length && (
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
              {pending.map((mystery) => (
                <article key={mystery.id} className="library-book">
                  <h3>{mystery.title}</h3>
                  <p>{mystery.data.intro || <Trans>No introduction has been written.</Trans>}</p>
                  <Button variant="dark" onClick={() => void approve(mystery)}>
                    <Check className="size-4" />
                    <Trans>Approve publication</Trans>
                  </Button>
                </article>
              ))}
              {!pending.length && (
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
