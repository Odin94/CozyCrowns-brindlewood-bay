import {
  loadMysteryDrafts,
  persistMysteryDraft,
  storedMysteryDraft,
  recoverMysteryDraft,
  completeMysteryRecovery,
  forgetMysteryDraft,
  isDirtyMysteryDraft,
  type MysteryDraft,
} from "@/lib/mystery_drafts";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { api, type Mystery, type MysteryData, type MysteryVersion } from "@/utils/api";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import {
  ArchiveRestore,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Feather,
  Library,
  Plus,
  Save,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import type React from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const defaultMystery = (): MysteryData => ({
  schemaVersion: 1,
  title: t`Untitled Mystery`,
  intro: "",
  establishingQuestions: [],
  complexity: 6,
  locations: [],
  suspects: [],
  clues: [],
  voidClues: [],
  moments: [],
});

const newEntryId = () => crypto.randomUUID();
const blankLocation = () => ({ id: newEntryId(), title: "", description: "", prompt: "" });
const blankSuspect = () => ({ id: newEntryId(), name: "", title: "", description: "", quote: "" });
const blankClue = () => ({ id: newEntryId(), title: "", description: "" });
const blankMoment = () => ({ id: newEntryId(), description: "" });
const autoSaveDelay = 2_500;
const contentSnapshot = (mystery: Pick<Mystery, "title" | "data">) =>
  JSON.stringify({ title: mystery.title, data: mystery.data });
const hasEnteredInformation = (entry: object) =>
  Object.entries(entry).some(
    ([key, value]) => key !== "id" && typeof value === "string" && value.trim().length > 0,
  );

const patchEntry = <T extends object>(entry: T, changes: Partial<T>): T => ({
  ...entry,
  ...changes,
});

const clueLabels = (clues: MysteryData["clues"]) =>
  clues
    .map((clue) => [clue.title.trim(), clue.description.trim()].filter(Boolean).join(" — "))
    .filter(Boolean);

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
  autoFocus = false,
  type = "text",
  min,
  step,
}: {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  multi?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  type?: React.HTMLInputTypeAttribute;
  min?: number;
  step?: number | "any";
}) => (
  <label className="mystery-field">
    <span>{label}</span>
    {multi ? (
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
    ) : type === "number" ? (
      <div className="mystery-number-input">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          type={type}
          min={min}
          step={step}
        />
        <div className="mystery-number-input__controls">
          <Button
            type="button"
            variant="dark"
            size="sm"
            aria-label={t`Increase complexity`}
            title={t`Increase complexity`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChange(String((Number(value) || 0) + 1))}
          >
            <ChevronUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="dark"
            size="sm"
            aria-label={t`Decrease complexity`}
            title={t`Decrease complexity`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChange(String(Math.max(min ?? 0, (Number(value) || 0) - 1)))}
          >
            <ChevronDown aria-hidden="true" />
          </Button>
        </div>
      </div>
    ) : (
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        type={type}
        min={min}
        step={step}
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

const RemoveCard = ({ onClick }: { onClick: () => void }) => {
  useLingui();
  return (
    <Button
      size="sm"
      variant="dark"
      className="ml-auto flex h-7 w-7 p-0"
      onClick={onClick}
      aria-label={t`Remove entry`}
      title={t`Remove entry`}
    >
      <Trash2 className="size-3.5" aria-hidden="true" />
    </Button>
  );
};

const MysteriesPage = () => {
  const { isAuthenticated, loading, user } = useAuth();
  const ownerId = user?.id;
  const accountRef = useRef(ownerId);
  accountRef.current = ownerId;
  const loadSequence = useRef(0);
  const selectedOwner = useRef<string | undefined>(undefined);
  const [pendingDrafts, setPendingDrafts] = useState<MysteryDraft[]>([]);
  const [recoveringDrafts, setRecoveringDrafts] = useState<Set<string>>(new Set());
  const bookClubId = new URLSearchParams(window.location.search).get("bookClubId");
  const bookClubPath = bookClubId ? `/book-clubs/${encodeURIComponent(bookClubId)}` : null;
  const [mysteries, setMysteries] = useState<Mystery[]>([]);
  const [selected, setSelected] = useState<Mystery | null>(null);
  const [versions, setVersions] = useState<MysteryVersion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [bringingToBookClub, setBringingToBookClub] = useState(false);
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(null);
  const [complexityInput, setComplexityInput] = useState("");
  const [confirmation, setConfirmation] = useState<
    | { kind: "delete"; title: string }
    | { kind: "publish" }
    | { kind: "restore"; version: MysteryVersion }
    | { kind: "remove-entry"; title?: string; onConfirm: () => void }
    | null
  >(null);
  const lastSavedById = useRef(new Map<string, string>());
  const latestVersionById = useRef(new Map<string, number>());
  const selectedRef = useRef<Mystery | null>(null);
  const saveQueue = useRef<Promise<boolean>>(Promise.resolve(true));

  const choose = useCallback(
    (mystery: Mystery, confirmed = true) => {
      const isAlreadySelected = selectedRef.current?.id === mystery.id;
      let chosen = mystery;
      if (confirmed) {
        lastSavedById.current.set(mystery.id, contentSnapshot(mystery));
        const stored = ownerId ? storedMysteryDraft(localStorage, ownerId, mystery.id) : undefined;
        if (stored && isDirtyMysteryDraft(stored) && stored.mystery.version === mystery.version)
          chosen = stored.mystery;
      }
      latestVersionById.current.set(mystery.id, mystery.version);
      selectedOwner.current = ownerId;
      selectedRef.current = chosen;
      setFocusedEntryId(null);
      setComplexityInput(String(chosen.data.complexity));
      if (!isAlreadySelected) setVersions([]);
      setSelected(chosen);
    },
    [ownerId],
  );

  const retryRecovery = useCallback(
    async (draft: MysteryDraft, sequence = loadSequence.current) => {
      if (!ownerId || draft.ownerId !== ownerId || accountRef.current !== ownerId) return;
      const initialSelection = selectedRef.current?.id;
      const initialContent = selectedRef.current ? contentSnapshot(selectedRef.current) : undefined;
      setRecoveringDrafts((current) => new Set([...current, draft.mystery.id]));
      try {
        const recoveredName = draft.mystery.title.slice(0, 220);
        const title = t`${recoveredName} (Recovered draft)`;
        const recovered = await recoverMysteryDraft(
          localStorage,
          ownerId,
          draft,
          title,
          api.createMystery,
        );
        const completed = completeMysteryRecovery(localStorage, ownerId, draft, recovered);
        if (accountRef.current !== ownerId || sequence !== loadSequence.current) return;
        setPendingDrafts((current) => {
          const remaining = current.filter((entry) => entry.mystery.id !== draft.mystery.id);
          const latest = storedMysteryDraft(localStorage, ownerId, draft.mystery.id);
          return !completed && latest ? [...remaining, latest] : remaining;
        });
        setMysteries((current) => [
          recovered,
          ...current.filter((entry) => entry.id !== recovered.id),
        ]);
        if (
          completed &&
          selectedRef.current?.id === initialSelection &&
          (!selectedRef.current || contentSnapshot(selectedRef.current) === initialContent)
        )
          choose(recovered);
        toast.success(t`Recovered your local mystery as a separate copy.`);
      } catch (error) {
        if (accountRef.current === ownerId && sequence === loadSequence.current)
          toast.error(
            t`Your local mystery draft is preserved. Retry recovery when the connection returns.`,
          );
        console.error("Could not recover mystery draft", error);
      } finally {
        if (accountRef.current === ownerId && sequence === loadSequence.current)
          setRecoveringDrafts((current) => {
            const next = new Set(current);
            next.delete(draft.mystery.id);
            return next;
          });
      }
    },
    [choose, ownerId],
  );

  const refreshVersions = useCallback(async (id: string) => {
    try {
      const result = await api.getMysteryVersions(id);
      if (selectedRef.current?.id === id) setVersions(result.versions);
    } catch {
      if (selectedRef.current?.id === id) setVersions([]);
    }
  }, []);

  const load = useCallback(async () => {
    if (!ownerId) return;
    const sequence = ++loadSequence.current;
    try {
      const result = await api.getMysteries();
      if (accountRef.current !== ownerId || sequence !== loadSequence.current) return;
      setMysteries(result.mysteries);
      const stored = loadMysteryDrafts(
        localStorage,
        ownerId,
        new Set(result.mysteries.map((mystery) => mystery.id)),
      );
      const pending = stored.drafts.filter((draft) => {
        const canonical = result.mysteries.find((mystery) => mystery.id === draft.mystery.id);
        return (
          isDirtyMysteryDraft(draft) &&
          (!canonical || contentSnapshot(draft.mystery) !== contentSnapshot(canonical)) &&
          (!canonical || canonical.version !== draft.mystery.version)
        );
      });
      setPendingDrafts(pending);
      const preferred = stored.selected;
      const canonical = result.mysteries.find((mystery) => mystery.id === preferred?.mystery.id);
      if (canonical) {
        choose(canonical);
        if (
          preferred &&
          isDirtyMysteryDraft(preferred) &&
          preferred.mystery.version === canonical.version
        )
          choose(preferred.mystery, false);
      } else if (result.mysteries[0]) choose(result.mysteries[0]);
      const retry = pending.find((draft) => draft.mystery.id === preferred?.mystery.id);
      if (retry) await retryRecovery(retry, sequence);
    } catch (error) {
      if (accountRef.current === ownerId && sequence === loadSequence.current)
        toast.error(error instanceof Error ? error.message : t`Could not load mysteries`);
    } finally {
      if (accountRef.current === ownerId && sequence === loadSequence.current) setLoaded(true);
    }
  }, [choose, ownerId, retryRecovery]);

  useEffect(() => {
    selectedOwner.current = undefined;
    selectedRef.current = null;
    lastSavedById.current.clear();
    latestVersionById.current.clear();
    setSelected(null);
    setMysteries([]);
    setPendingDrafts([]);
    setRecoveringDrafts(new Set());
    setLoaded(false);
    if (isAuthenticated && ownerId) void load();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- This is a request generation counter, not a DOM ref.
      loadSequence.current++;
    };
  }, [isAuthenticated, ownerId, load]);
  useEffect(() => {
    if (selected && ownerId && selectedOwner.current === ownerId) {
      persistMysteryDraft(localStorage, {
        ownerId,
        mystery: selected,
        baseContent: lastSavedById.current.get(selected.id),
        baseVersion: latestVersionById.current.get(selected.id),
      });
      selectedRef.current = selected;
    }
  }, [ownerId, selected]);
  useEffect(() => {
    if (selected?.id) void refreshVersions(selected.id);
  }, [refreshVersions, selected?.id]);

  const updateSelected = useCallback((updates: Partial<MysteryData> & { title?: string }) => {
    setSelected((current) =>
      current
        ? {
            ...current,
            title: updates.title ?? current.title,
            data: { ...current.data, ...updates, title: updates.title ?? current.data.title },
          }
        : current,
    );
  }, []);

  const removeEntry = useCallback((entry: object, remove: () => void) => {
    if (!hasEnteredInformation(entry)) {
      remove();
      return;
    }
    const title =
      "title" in entry && typeof entry.title === "string" ? entry.title.trim() : undefined;
    setConfirmation({ kind: "remove-entry", title: title || undefined, onConfirm: remove });
  }, []);

  const save = useCallback(
    (kind: "auto" | "manual"): Promise<boolean> => {
      const submitted = selectedRef.current;
      if (!submitted || !ownerId || selectedOwner.current !== ownerId)
        return Promise.resolve(false);
      const submittedContent = contentSnapshot(submitted);
      if (kind === "auto" && lastSavedById.current.get(submitted.id) === submittedContent) {
        return Promise.resolve(true);
      }

      const task = async (): Promise<boolean> => {
        if (accountRef.current !== ownerId) return false;
        try {
          const saved = await api.updateMystery(submitted.id, {
            title: submitted.title || t`Untitled Mystery`,
            data: submitted.data,
            version: latestVersionById.current.get(submitted.id) ?? submitted.version,
            saveKind: kind,
          });
          if (accountRef.current !== ownerId) return false;
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
    [ownerId, refreshVersions],
  );

  const saveSignature = useMemo(() => (selected ? contentSnapshot(selected) : ""), [selected]);
  useEffect(() => {
    if (!selected || saveSignature === lastSavedById.current.get(selected.id)) return;
    const timer = window.setTimeout(() => void save("auto"), autoSaveDelay);
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
    const deletedMystery = selectedRef.current;
    if (!deletedMystery) return;
    try {
      await api.deleteMystery(deletedMystery.id);
      const remaining = mysteries.filter((mystery) => mystery.id !== deletedMystery.id);
      selectedRef.current = remaining[0] ?? null;
      setMysteries(remaining);
      setSelected(remaining[0] ?? null);
      setVersions([]);
      lastSavedById.current.delete(deletedMystery.id);
      latestVersionById.current.delete(deletedMystery.id);
      if (ownerId) forgetMysteryDraft(localStorage, ownerId, deletedMystery.id);
      setConfirmation(null);
      toast.success(t`Mystery deleted.`, {
        action: {
          label: t`Undo`,
          onClick: () =>
            void api
              .restoreMystery(deletedMystery.id)
              .then((restored) => {
                setMysteries((current) => [
                  restored,
                  ...current.filter((mystery) => mystery.id !== restored.id),
                ]);
                choose(restored);
                toast.success(t`Mystery restored.`);
              })
              .catch((error) =>
                toast.error(error instanceof Error ? error.message : t`Could not restore mystery`),
              ),
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not remove mystery`);
    }
  };

  const restoreVersion = async (version: MysteryVersion) => {
    const previous = selectedRef.current;
    if (!previous) return;
    const restored = { ...previous, title: version.title, data: version.data };
    selectedRef.current = restored;
    setSelected(restored);
    setComplexityInput(String(version.data.complexity));
    if (!(await save("auto"))) {
      selectedRef.current = previous;
      setSelected(previous);
      setComplexityInput(String(previous.data.complexity));
      return;
    }
    toast.success(t`Version restored.`, {
      action: {
        label: t`Undo`,
        onClick: () => {
          selectedRef.current = previous;
          setSelected(previous);
          setComplexityInput(String(previous.data.complexity));
          void save("auto");
        },
      },
    });
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

  const bringToBookClub = async () => {
    const mystery = selectedRef.current;
    if (!bookClubId || !bookClubPath || !mystery || bringingToBookClub) return;
    setBringingToBookClub(true);
    if (!(await save("manual"))) {
      setBringingToBookClub(false);
      return;
    }
    try {
      await api.createBookClubMystery(
        bookClubId,
        mystery.id,
        mystery.title || t`Untitled Mystery`,
        clueLabels(mystery.data.clues),
        clueLabels(mystery.data.voidClues),
      );
      window.location.assign(bookClubPath);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t`Could not bring mystery to the Book Club`,
      );
      setBringingToBookClub(false);
    }
  };

  if (loading) return null;
  if (!isAuthenticated) return <SignInRequired />;

  return (
    <main className="mystery-desk min-h-screen p-3 pt-12 sm:p-6 sm:pt-14">
      <a href={bookClubPath ?? "/"} className="mystery-sheet-link">
        <ChevronLeft className="size-5" aria-hidden="true" />
        <span className="sr-only">
          {bookClubPath ? <Trans>Back to Book Club</Trans> : <Trans>Back to sheet</Trans>}
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
          {pendingDrafts.length > 0 && (
            <section
              className="rounded-lg border border-amber-500/50 bg-gray-900 p-4 text-gray-100"
              aria-label={t`Pending local drafts`}
            >
              <p>
                <Trans>Your unsaved local mystery drafts are preserved separately.</Trans>
              </p>
              {pendingDrafts.map((draft) => (
                <div key={draft.mystery.id} className="mt-3 flex flex-wrap items-center gap-3">
                  <span>{draft.mystery.title}</span>
                  <Button
                    variant="dark"
                    disabled={recoveringDrafts.has(draft.mystery.id)}
                    onClick={() => void retryRecovery(draft)}
                  >
                    <Trans>Retry recovery</Trans>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(draft.mystery, null, 2)], {
                          type: "application/json",
                        }),
                      );
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = "mystery-draft.json";
                      link.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Trans>Download draft</Trans>
                  </Button>
                </div>
              ))}
            </section>
          )}
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
                <Button onClick={() => setConfirmation({ kind: "publish" })} variant="secondary">
                  <Send className="size-4" />
                  <Trans>Publish</Trans>
                </Button>
                {bookClubPath && (
                  <Button
                    onClick={() => void bringToBookClub()}
                    variant="secondary"
                    disabled={bringingToBookClub}
                  >
                    <Users className="size-4" />
                    <Trans>Bring to Book Club</Trans>
                  </Button>
                )}
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
                value={complexityInput}
                onChange={(value) => {
                  setComplexityInput(value);
                  const complexity = Number(value);
                  updateSelected({
                    complexity: Number.isFinite(complexity) && complexity >= 0 ? complexity : 0,
                  });
                }}
                type="number"
                min={0}
                step="any"
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
            <LocationsSection
              locations={selected.data.locations}
              focusedEntryId={focusedEntryId}
              setFocusedEntryId={setFocusedEntryId}
              updateSelected={updateSelected}
              removeEntry={removeEntry}
            />
            <SuspectsSection
              suspects={selected.data.suspects}
              focusedEntryId={focusedEntryId}
              setFocusedEntryId={setFocusedEntryId}
              updateSelected={updateSelected}
              removeEntry={removeEntry}
            />
            <CluesSections
              clues={selected.data.clues}
              voidClues={selected.data.voidClues}
              focusedEntryId={focusedEntryId}
              setFocusedEntryId={setFocusedEntryId}
              updateSelected={updateSelected}
              removeEntry={removeEntry}
            />
            <MomentsSection
              moments={selected.data.moments}
              focusedEntryId={focusedEntryId}
              setFocusedEntryId={setFocusedEntryId}
              updateSelected={updateSelected}
              removeEntry={removeEntry}
            />
            <footer className="mystery-footer">
              <Button
                variant="dark"
                onClick={() => setConfirmation({ kind: "delete", title: selected.title.trim() })}
              >
                <Trash2 className="size-4" />
                <Trans>Delete</Trans>
              </Button>
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
            <Trans>Last 10 versions preserved.</Trans>
            <br />
            <Trans>Latest version is updated with auto-save.</Trans>
          </p>
          {versions
            .filter((version) => version.kind === "manual")
            .map((version) => (
              <Button
                key={version.id}
                variant="bare"
                onClick={() => {
                  if (selected) setConfirmation({ kind: "restore", version });
                }}
              >
                <strong>
                  <Trans>Manual save</Trans>
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
            ) : confirmation.kind === "publish" ? (
              <Trans>Publish mystery</Trans>
            ) : confirmation.kind === "remove-entry" ? (
              <Trans>Remove entry</Trans>
            ) : (
              <Trans>Restore this version</Trans>
            )
          }
          description={
            confirmation.kind === "delete" ? (
              confirmation.title ? (
                <Trans>Remove "{confirmation.title}" from your private library?</Trans>
              ) : (
                <Trans>Remove this mystery from your private library?</Trans>
              )
            ) : confirmation.kind === "publish" ? (
              <Trans>
                An admin must check and approve this mystery before it appears in the public
                library. Review can take up to a week.
              </Trans>
            ) : confirmation.kind === "remove-entry" ? (
              confirmation.title ? (
                <Trans>
                  Remove "{confirmation.title}"? Any information entered here will be lost.
                </Trans>
              ) : (
                <Trans>Remove this entry? Any information entered here will be lost.</Trans>
              )
            ) : (
              <Trans>
                Restore this saved version? Your current unsaved changes will be replaced.
              </Trans>
            )
          }
          confirmLabel={
            confirmation.kind === "delete" ? (
              <Trans>Delete</Trans>
            ) : confirmation.kind === "publish" ? (
              <Trans>Submit for approval</Trans>
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
            if (confirmation.kind === "publish") {
              setConfirmation(null);
              void publish();
              return;
            }
            if (confirmation.kind === "remove-entry") {
              confirmation.onConfirm();
              setConfirmation(null);
              return;
            }
            void restoreVersion(confirmation.version);
            setConfirmation(null);
          }}
          onCancel={() => setConfirmation(null)}
          tone={
            confirmation.kind === "restore" || confirmation.kind === "publish" ? "warning" : "dark"
          }
        />
      ) : null}
    </main>
  );
};

export default MysteriesPage;

const LocationsSection = memo(function LocationsSection({
  locations,
  focusedEntryId,
  setFocusedEntryId,
  updateSelected,
  removeEntry,
}: {
  locations: MysteryData["locations"];
  focusedEntryId: string | null;
  setFocusedEntryId: (id: string | null) => void;
  updateSelected: (updates: Partial<MysteryData> & { title?: string }) => void;
  removeEntry: (entry: object, remove: () => void) => void;
}) {
  return (
    <Section
      title={<Trans>Locations</Trans>}
      action={
        <Button
          size="sm"
          onClick={() => {
            const location = blankLocation();
            setFocusedEntryId(location.id);
            updateSelected({ locations: [...locations, location] });
          }}
        >
          <Plus className="size-4" />
        </Button>
      }
    >
      {locations.map((location, index) => (
        <div key={location.id ?? index} className="mystery-card">
          <RemoveCard
            onClick={() =>
              removeEntry(location, () =>
                updateSelected({
                  locations: locations.filter((_, i) => i !== index),
                }),
              )
            }
          />
          <Field
            label={<Trans>Title</Trans>}
            value={location.title}
            autoFocus={focusedEntryId === location.id}
            onChange={(title) =>
              updateSelected({
                locations: locations.map((item, i) =>
                  i === index ? patchEntry(item, { title }) : item,
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
                locations: locations.map((item, i) =>
                  i === index ? patchEntry(item, { description }) : item,
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
                locations: locations.map((item, i) => (i === index ? { ...item, prompt } : item)),
              })
            }
          />
        </div>
      ))}
    </Section>
  );
});
const SuspectsSection = memo(function SuspectsSection({
  suspects,
  focusedEntryId,
  setFocusedEntryId,
  updateSelected,
  removeEntry,
}: {
  suspects: MysteryData["suspects"];
  focusedEntryId: string | null;
  setFocusedEntryId: (id: string | null) => void;
  updateSelected: (updates: Partial<MysteryData> & { title?: string }) => void;
  removeEntry: (entry: object, remove: () => void) => void;
}) {
  return (
    <Section
      title={<Trans>Suspects</Trans>}
      action={
        <Button
          size="sm"
          onClick={() => {
            const suspect = blankSuspect();
            setFocusedEntryId(suspect.id);
            updateSelected({ suspects: [...suspects, suspect] });
          }}
        >
          <Plus className="size-4" />
        </Button>
      }
    >
      {suspects.map((suspect, index) => (
        <div key={suspect.id ?? index} className="mystery-card">
          <RemoveCard
            onClick={() =>
              removeEntry(suspect, () =>
                updateSelected({
                  suspects: suspects.filter((_, i) => i !== index),
                }),
              )
            }
          />
          <Field
            label={<Trans>Name</Trans>}
            value={suspect.name}
            autoFocus={focusedEntryId === suspect.id}
            onChange={(name) =>
              updateSelected({
                suspects: suspects.map((item, i) => (i === index ? { ...item, name } : item)),
              })
            }
          />
          <Field
            label={<Trans>Title</Trans>}
            value={suspect.title}
            onChange={(title) =>
              updateSelected({
                suspects: suspects.map((item, i) =>
                  i === index ? patchEntry(item, { title }) : item,
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
                suspects: suspects.map((item, i) =>
                  i === index ? patchEntry(item, { description }) : item,
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
                suspects: suspects.map((item, i) => (i === index ? { ...item, quote } : item)),
              })
            }
          />
        </div>
      ))}
    </Section>
  );
});
const MomentsSection = memo(function MomentsSection({
  moments,
  focusedEntryId,
  setFocusedEntryId,
  updateSelected,
  removeEntry,
}: {
  moments: MysteryData["moments"];
  focusedEntryId: string | null;
  setFocusedEntryId: (id: string | null) => void;
  updateSelected: (updates: Partial<MysteryData> & { title?: string }) => void;
  removeEntry: (entry: object, remove: () => void) => void;
}) {
  return (
    <Section
      title={<Trans>Moments</Trans>}
      action={
        <Button
          size="sm"
          onClick={() => {
            const moment = blankMoment();
            setFocusedEntryId(moment.id);
            updateSelected({ moments: [...moments, moment] });
          }}
        >
          <Plus className="size-4" />
        </Button>
      }
    >
      {moments.map((moment, index) => (
        <div key={moment.id ?? index} className="mystery-card">
          <RemoveCard
            onClick={() =>
              removeEntry(moment, () =>
                updateSelected({
                  moments: moments.filter((_, i) => i !== index),
                }),
              )
            }
          />
          <Field
            label={<Trans>Description</Trans>}
            value={moment.description}
            autoFocus={focusedEntryId === moment.id}
            multi
            onChange={(description) =>
              updateSelected({
                moments: moments.map((item, i) =>
                  i === index ? patchEntry(item, { description }) : item,
                ),
              })
            }
          />
        </div>
      ))}
    </Section>
  );
});
const CluesSections = memo(function CluesSections({
  clues,
  voidClues,
  focusedEntryId,
  setFocusedEntryId,
  updateSelected,
  removeEntry,
}: {
  clues: MysteryData["clues"];
  voidClues: MysteryData["voidClues"];
  focusedEntryId: string | null;
  setFocusedEntryId: (id: string | null) => void;
  updateSelected: (updates: Partial<MysteryData> & { title?: string }) => void;
  removeEntry: (entry: object, remove: () => void) => void;
}) {
  return (
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
          onClick={() => {
            const clue = blankClue();
            setFocusedEntryId(clue.id);
            updateSelected({ [key]: [...(key === "clues" ? clues : voidClues), clue] });
          }}
        >
          <Plus className="size-4" />
        </Button>
      }
    >
      {(key === "clues" ? clues : voidClues).map((clue, index) => (
        <div key={clue.id ?? index} className="mystery-card">
          <RemoveCard
            onClick={() =>
              removeEntry(clue, () =>
                updateSelected({
                  [key]: (key === "clues" ? clues : voidClues).filter((_, i) => i !== index),
                }),
              )
            }
          />
          <Field
            label={<Trans>Title</Trans>}
            value={clue.title}
            autoFocus={focusedEntryId === clue.id}
            onChange={(title) =>
              updateSelected({
                [key]: (key === "clues" ? clues : voidClues).map((item, i) =>
                  i === index ? patchEntry(item, { title }) : item,
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
                [key]: (key === "clues" ? clues : voidClues).map((item, i) =>
                  i === index ? patchEntry(item, { description }) : item,
                ),
              })
            }
          />
        </div>
      ))}
    </Section>
  ));
});
