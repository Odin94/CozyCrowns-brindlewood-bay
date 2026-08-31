import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { api, type Mystery, type MysteryData, type MysteryVersion } from "@/utils/api";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  ArchiveRestore,
  ChevronLeft,
  BookOpen,
  Feather,
  Library,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const draftKey = "cozycrowns-mystery-draft";
const defaultMystery = (): MysteryData => ({
  schemaVersion: 1,
  title: t`Untitled Mystery`,
  intro: "",
  establishingQuestions: [],
  complexity: 4,
  locations: [],
  suspects: [],
  clues: [],
  voidClues: [],
  moments: [],
});

const blankLocation = () => ({ title: "", description: "", prompt: "" });
const blankSuspect = () => ({ name: "", title: "", description: "", quote: "" });
const blankClue = () => ({ title: "", description: "" });
const blankMoment = () => ({ description: "" });
const contentSnapshot = (mystery: Pick<Mystery, "title" | "data">) =>
  JSON.stringify({ title: mystery.title, data: mystery.data });
const hasEnteredInformation = (entry: object) =>
  Object.entries(entry).some(
    ([key, value]) => key !== "id" && typeof value === "string" && value.trim().length > 0,
  );

const SignInRequired = () => {
  const { signIn } = useAuth();
  return (
    <main className="mystery-desk min-h-screen grid place-items-center p-5">
      <a href="/" className="mystery-sheet-link">
        <ChevronLeft className="size-5" aria-hidden="true" />
        <span className="sr-only">
          <Trans>Back to sheet</Trans>
        </span>
      </a>
      <section className="mystery-parchment max-w-lg text-center">
        <Feather className="mx-auto mb-3 size-10" />
        <h1>
          <Trans>The Keeper's Desk</Trans>
        </h1>
        <p>
          <Trans>Sign in to write, preserve, and share your mysteries.</Trans>
        </p>
        <Button onClick={signIn} variant="dark" className="mt-4">
          <Trans>Sign in to continue</Trans>
        </Button>
      </section>
    </main>
  );
};

const Field = ({
  label,
  value,
  onChange,
  multi = false,
  placeholder = "",
}: {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  multi?: boolean;
  placeholder?: string;
}) => (
  <label className="mystery-field">
    <span>{label}</span>
    {multi ? (
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    ) : (
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    )}
  </label>
);

const Section = ({
  title,
  action,
  children,
}: {
  title: React.ReactNode;
  action: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="mystery-section">
    <header>
      <h2>{title}</h2>
      {action}
    </header>
    <div className="mystery-cards">{children}</div>
  </section>
);

const RemoveCard = ({ onClick }: { onClick: () => void }) => (
  <Button size="sm" variant="ghost" className="ml-auto flex h-7" onClick={onClick}>
    <X className="size-3" />
    <Trans>Remove</Trans>
  </Button>
);

const MysteriesPage = () => {
  const { isAuthenticated, loading } = useAuth();
  const [mysteries, setMysteries] = useState<Mystery[]>([]);
  const [selected, setSelected] = useState<Mystery | null>(null);
  const [versions, setVersions] = useState<MysteryVersion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirmation, setConfirmation] = useState<
    | { kind: "delete" }
    | { kind: "restore"; version: MysteryVersion }
    | { kind: "remove-entry"; onConfirm: () => void }
    | null
  >(null);
  const lastSavedById = useRef(new Map<string, string>());
  const latestVersionById = useRef(new Map<string, number>());
  const selectedRef = useRef<Mystery | null>(null);
  const saveQueue = useRef<Promise<boolean>>(Promise.resolve(true));

  const choose = useCallback((mystery: Mystery) => {
    lastSavedById.current.set(mystery.id, contentSnapshot(mystery));
    latestVersionById.current.set(mystery.id, mystery.version);
    selectedRef.current = mystery;
    setVersions([]);
    setSelected(mystery);
  }, []);

  const refreshVersions = useCallback(async (id: string) => {
    try {
      const result = await api.getMysteryVersions(id);
      if (selectedRef.current?.id === id) setVersions(result.versions);
    } catch {
      if (selectedRef.current?.id === id) setVersions([]);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const result = await api.getMysteries();
      setMysteries(result.mysteries);
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft) as Mystery;
          const canonical = result.mysteries.find((mystery) => mystery.id === draft.id);
          if (
            canonical &&
            new Date(draft.updatedAt).getTime() >= new Date(canonical.updatedAt).getTime()
          )
            choose(draft);
          else if (canonical) choose(canonical);
        } catch {
          localStorage.removeItem(draftKey);
        }
      }
      if (result.mysteries[0]) {
        setSelected((current) => {
          if (current) return current;
          lastSavedById.current.set(result.mysteries[0].id, contentSnapshot(result.mysteries[0]));
          latestVersionById.current.set(result.mysteries[0].id, result.mysteries[0].version);
          selectedRef.current = result.mysteries[0];
          return result.mysteries[0];
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not load mysteries`);
    } finally {
      setLoaded(true);
    }
  }, [choose]);

  useEffect(() => {
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);
  useEffect(() => {
    if (selected) localStorage.setItem(draftKey, JSON.stringify(selected));
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    if (selected?.id) void refreshVersions(selected.id);
  }, [refreshVersions, selected?.id]);

  const updateSelected = (updates: Partial<MysteryData> & { title?: string }) => {
    setSelected((current) =>
      current
        ? {
            ...current,
            title: updates.title ?? current.title,
            data: { ...current.data, ...updates, title: updates.title ?? current.data.title },
          }
        : current,
    );
  };

  const removeEntry = (entry: object, remove: () => void) => {
    if (!hasEnteredInformation(entry)) {
      remove();
      return;
    }
    setConfirmation({ kind: "remove-entry", onConfirm: remove });
  };

  const save = useCallback(
    (kind: "auto" | "manual"): Promise<boolean> => {
      const submitted = selectedRef.current;
      if (!submitted) return Promise.resolve(false);
      const submittedContent = contentSnapshot(submitted);
      if (kind === "auto" && lastSavedById.current.get(submitted.id) === submittedContent) {
        return Promise.resolve(true);
      }

      const task = async (): Promise<boolean> => {
        try {
          const saved = await api.updateMystery(submitted.id, {
            title: submitted.title || t`Untitled Mystery`,
            data: submitted.data,
            version: latestVersionById.current.get(submitted.id) ?? submitted.version,
            saveKind: kind,
          });
          latestVersionById.current.set(saved.id, saved.version);
          lastSavedById.current.set(saved.id, contentSnapshot(saved));
          setMysteries((current) =>
            current.map((mystery) => (mystery.id === saved.id ? saved : mystery)),
          );
          setSelected((current) => {
            if (!current || current.id !== saved.id) return current;
            return contentSnapshot(current) === submittedContent
              ? saved
              : { ...current, version: saved.version };
          });
          void refreshVersions(saved.id);
          if (kind === "manual") toast.success(t`Manual version saved.`);
          return true;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : t`Could not save mystery`);
          return false;
        }
      };
      saveQueue.current = saveQueue.current.catch(() => false).then(task);
      return saveQueue.current;
    },
    [refreshVersions],
  );

  const saveSignature = useMemo(() => (selected ? contentSnapshot(selected) : ""), [selected]);
  useEffect(() => {
    if (!selected || saveSignature === lastSavedById.current.get(selected.id)) return;
    const timer = window.setTimeout(() => void save("auto"), 900);
    return () => window.clearTimeout(timer);
  }, [save, saveSignature, selected]);

  const createMystery = async () => {
    try {
      const data = defaultMystery();
      const created = await api.createMystery({ title: data.title, data });
      setMysteries((current) => [created, ...current]);
      choose(created);
      toast.success(t`A fresh parchment awaits.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not create mystery`);
    }
  };

  const deleteMystery = async () => {
    if (!selected) return;
    try {
      await api.deleteMystery(selected.id);
      const remaining = mysteries.filter((mystery) => mystery.id !== selected.id);
      selectedRef.current = remaining[0] ?? null;
      setMysteries(remaining);
      setSelected(remaining[0] ?? null);
      setVersions([]);
      lastSavedById.current.delete(selected.id);
      latestVersionById.current.delete(selected.id);
      localStorage.removeItem(draftKey);
      setConfirmation(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not remove mystery`);
    }
  };

  const publish = async () => {
    if (!selected) return;
    if (!(await save("manual"))) return;
    const savedMystery = selectedRef.current;
    if (!savedMystery) return;
    try {
      await api.publishMystery(savedMystery.id);
      toast.success(t`Submitted for superadmin approval.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not submit mystery`);
    }
  };

  if (loading) return null;
  if (!isAuthenticated) return <SignInRequired />;

  return (
    <main className="mystery-desk min-h-screen p-3 pt-12 sm:p-6 sm:pt-14">
      <a href="/" className="mystery-sheet-link">
        <ChevronLeft className="size-5" aria-hidden="true" />
        <span className="sr-only">
          <Trans>Back to sheet</Trans>
        </span>
      </a>
      <div className="mystery-workspace">
        <aside className="mystery-sidebar">
          <div className="flex items-center justify-between gap-2">
            <h1 className="flex items-center gap-2">
              <Feather className="mystery-quill size-7" aria-hidden="true" />
              <Trans>Mysteries</Trans>
            </h1>
            <Button size="sm" variant="dark" onClick={createMystery}>
              <Plus className="size-4" />
            </Button>
          </div>
          <a href="/library" className="mystery-library-link">
            <Library className="size-4" />
            <Trans>Public Library</Trans>
          </a>
          <div className="mystery-list">
            {mysteries.map((mystery) => (
              <Button
                key={mystery.id}
                variant="bare"
                onClick={() => choose(mystery)}
                className={selected?.id === mystery.id ? "active" : ""}
              >
                {mystery.title || <Trans>Untitled Mystery</Trans>}
              </Button>
            ))}
            {loaded && !mysteries.length && (
              <p>
                <Trans>No mysteries yet. Start with a fresh sheet.</Trans>
              </p>
            )}
          </div>
        </aside>
        {selected ? (
          <article className="mystery-parchment mystery-editor">
            <header className="mystery-editor-header">
              <div>
                <p className="mystery-kicker">
                  <Trans>Keeper's private casebook</Trans>
                </p>
                <Field
                  label={<Trans>Mystery title</Trans>}
                  value={selected.title}
                  onChange={(title) => updateSelected({ title })}
                />
              </div>
              <div className="mystery-actions">
                <Button variant="dark" onClick={() => void save("manual")}>
                  <Save className="size-4" />
                  <Trans>Save version</Trans>
                </Button>
                <Button onClick={() => void publish()} variant="secondary">
                  <Send className="size-4" />
                  <Trans>Publish</Trans>
                </Button>
              </div>
            </header>
            <Field
              label={<Trans>Introduction</Trans>}
              value={selected.data.intro}
              onChange={(intro) => updateSelected({ intro })}
              multi
              placeholder={t`Set the scene, the victim, and the peculiar trouble...`}
            />
            <div className="mystery-meta-grid">
              <Field
                label={<Trans>Complexity</Trans>}
                value={String(selected.data.complexity)}
                onChange={(value) =>
                  updateSelected({ complexity: Math.max(1, Math.min(12, Number(value) || 1)) })
                }
              />
              <Field
                label={<Trans>Establishing questions (one per line)</Trans>}
                value={selected.data.establishingQuestions.join("\n")}
                onChange={(value) =>
                  updateSelected({ establishingQuestions: value.split("\n").filter(Boolean) })
                }
                multi
              />
            </div>
            <Section
              title={<Trans>Locations</Trans>}
              action={
                <Button
                  size="sm"
                  onClick={() =>
                    updateSelected({ locations: [...selected.data.locations, blankLocation()] })
                  }
                >
                  <Plus className="size-4" />
                </Button>
              }
            >
              {selected.data.locations.map((location, index) => (
                <div key={location.id ?? `${location.title}-${index}`} className="mystery-card">
                  <RemoveCard
                    onClick={() =>
                      removeEntry(location, () =>
                        updateSelected({
                          locations: selected.data.locations.filter((_, i) => i !== index),
                        }),
                      )
                    }
                  />
                  <Field
                    label={<Trans>Title</Trans>}
                    value={location.title}
                    onChange={(title) =>
                      updateSelected({
                        locations: selected.data.locations.map((item, i) =>
                          i === index ? { ...item, title } : item,
                        ),
                      })
                    }
                  />
                  <Field
                    label={<Trans>Description</Trans>}
                    value={location.description}
                    multi
                    onChange={(description) =>
                      updateSelected({
                        locations: selected.data.locations.map((item, i) =>
                          i === index ? { ...item, description } : item,
                        ),
                      })
                    }
                  />
                  <Field
                    label={<Trans>Prompt</Trans>}
                    value={location.prompt}
                    multi
                    onChange={(prompt) =>
                      updateSelected({
                        locations: selected.data.locations.map((item, i) =>
                          i === index ? { ...item, prompt } : item,
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </Section>
            <Section
              title={<Trans>Suspects</Trans>}
              action={
                <Button
                  size="sm"
                  onClick={() =>
                    updateSelected({ suspects: [...selected.data.suspects, blankSuspect()] })
                  }
                >
                  <Plus className="size-4" />
                </Button>
              }
            >
              {selected.data.suspects.map((suspect, index) => (
                <div key={suspect.id ?? `${suspect.name}-${index}`} className="mystery-card">
                  <RemoveCard
                    onClick={() =>
                      removeEntry(suspect, () =>
                        updateSelected({
                          suspects: selected.data.suspects.filter((_, i) => i !== index),
                        }),
                      )
                    }
                  />
                  <Field
                    label={<Trans>Name</Trans>}
                    value={suspect.name}
                    onChange={(name) =>
                      updateSelected({
                        suspects: selected.data.suspects.map((item, i) =>
                          i === index ? { ...item, name } : item,
                        ),
                      })
                    }
                  />
                  <Field
                    label={<Trans>Title</Trans>}
                    value={suspect.title}
                    onChange={(title) =>
                      updateSelected({
                        suspects: selected.data.suspects.map((item, i) =>
                          i === index ? { ...item, title } : item,
                        ),
                      })
                    }
                  />
                  <Field
                    label={<Trans>Description</Trans>}
                    value={suspect.description}
                    multi
                    onChange={(description) =>
                      updateSelected({
                        suspects: selected.data.suspects.map((item, i) =>
                          i === index ? { ...item, description } : item,
                        ),
                      })
                    }
                  />
                  <Field
                    label={<Trans>Quote</Trans>}
                    value={suspect.quote}
                    multi
                    onChange={(quote) =>
                      updateSelected({
                        suspects: selected.data.suspects.map((item, i) =>
                          i === index ? { ...item, quote } : item,
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </Section>
            {(
              [
                ["Clues", "clues"],
                ["Void Clues", "voidClues"],
              ] as const
            ).map(([label, key]) => (
              <Section
                key={key}
                title={<Trans>{label}</Trans>}
                action={
                  <Button
                    size="sm"
                    onClick={() => updateSelected({ [key]: [...selected.data[key], blankClue()] })}
                  >
                    <Plus className="size-4" />
                  </Button>
                }
              >
                {selected.data[key].map((clue, index) => (
                  <div key={clue.id ?? `${clue.title}-${index}`} className="mystery-card">
                    <RemoveCard
                      onClick={() =>
                        removeEntry(clue, () =>
                          updateSelected({
                            [key]: selected.data[key].filter((_, i) => i !== index),
                          }),
                        )
                      }
                    />
                    <Field
                      label={<Trans>Title</Trans>}
                      value={clue.title}
                      onChange={(title) =>
                        updateSelected({
                          [key]: selected.data[key].map((item, i) =>
                            i === index ? { ...item, title } : item,
                          ),
                        })
                      }
                    />
                    <Field
                      label={<Trans>Description</Trans>}
                      value={clue.description}
                      multi
                      onChange={(description) =>
                        updateSelected({
                          [key]: selected.data[key].map((item, i) =>
                            i === index ? { ...item, description } : item,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </Section>
            ))}
            <Section
              title={<Trans>Moments</Trans>}
              action={
                <Button
                  size="sm"
                  onClick={() =>
                    updateSelected({ moments: [...selected.data.moments, blankMoment()] })
                  }
                >
                  <Plus className="size-4" />
                </Button>
              }
            >
              {selected.data.moments.map((moment, index) => (
                <div key={moment.id ?? `${moment.description}-${index}`} className="mystery-card">
                  <RemoveCard
                    onClick={() =>
                      removeEntry(moment, () =>
                        updateSelected({
                          moments: selected.data.moments.filter((_, i) => i !== index),
                        }),
                      )
                    }
                  />
                  <Field
                    label={<Trans>Description</Trans>}
                    value={moment.description}
                    multi
                    onChange={(description) =>
                      updateSelected({
                        moments: selected.data.moments.map((item, i) =>
                          i === index ? { ...item, description } : item,
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </Section>
            <footer className="mystery-footer">
              <Button variant="destructive" onClick={() => setConfirmation({ kind: "delete" })}>
                <Trash2 className="size-4" />
                <Trans>Delete</Trans>
              </Button>
              <p>
                <Trans>Autosaves are kept separately from your manual versions.</Trans>
              </p>
            </footer>
          </article>
        ) : (
          <article className="mystery-parchment grid place-items-center">
            <div className="text-center">
              <BookOpen className="mx-auto mb-3" />
              <p>
                <Trans>Choose a mystery or create a new one.</Trans>
              </p>
            </div>
          </article>
        )}
        <aside className="mystery-versions">
          <h2>
            <ArchiveRestore className="size-4" />
            <Trans>Version drawer</Trans>
          </h2>
          <p>
            <Trans>Last 10 auto-saves and 10 manual saves are preserved.</Trans>
          </p>
          {versions.map((version) => (
            <Button
              key={version.id}
              variant="bare"
              onClick={() => {
                if (selected) setConfirmation({ kind: "restore", version });
              }}
            >
              <strong>
                {version.kind === "manual" ? <Trans>Manual save</Trans> : <Trans>Autosave</Trans>}
              </strong>
              <span>{new Date(version.savedAt).toLocaleString()}</span>
              <small>
                <Trans>Restore this version</Trans>
              </small>
            </Button>
          ))}
        </aside>
      </div>
      {confirmation ? (
        <ConfirmationDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmation(null);
          }}
          title={
            confirmation.kind === "delete" ? (
              <Trans>Delete</Trans>
            ) : confirmation.kind === "remove-entry" ? (
              <Trans>Remove entry</Trans>
            ) : (
              <Trans>Restore this version</Trans>
            )
          }
          description={
            confirmation.kind === "delete" ? (
              <Trans>Remove this mystery from your private library?</Trans>
            ) : confirmation.kind === "remove-entry" ? (
              <Trans>Remove this entry? Any information entered here will be lost.</Trans>
            ) : (
              <Trans>
                Restore this saved version? Your current unsaved changes will be replaced.
              </Trans>
            )
          }
          confirmLabel={
            confirmation.kind === "delete" ? (
              <Trans>Delete</Trans>
            ) : confirmation.kind === "remove-entry" ? (
              <Trans>Remove</Trans>
            ) : (
              <Trans>Restore this version</Trans>
            )
          }
          cancelLabel={<Trans>Cancel</Trans>}
          onConfirm={() => {
            if (confirmation.kind === "delete") {
              void deleteMystery();
              return;
            }
            if (confirmation.kind === "remove-entry") {
              confirmation.onConfirm();
              setConfirmation(null);
              return;
            }
            if (selected) {
              setSelected({
                ...selected,
                title: confirmation.version.title,
                data: confirmation.version.data,
              });
            }
            setConfirmation(null);
          }}
          onCancel={() => setConfirmation(null)}
          tone={confirmation.kind === "restore" ? "warning" : "danger"}
        />
      ) : null}
    </main>
  );
};

export default MysteriesPage;
