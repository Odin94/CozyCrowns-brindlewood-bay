import { ContextActions } from "@/components/ContextActions";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMysteryPreservation } from "@/hooks/useMysteryPreservation";
import { useAuth } from "@/hooks/useAuth";
import { api, type MysteryData, type MysteryVersion } from "@/utils/api";
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
import { memo, useCallback, useEffect, useRef, useState } from "react";
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
  const searchParams = new URLSearchParams(window.location.search);
  const bookClubId = searchParams.get("bookClubId");
  const requestedMysteryId = searchParams.get("mysteryId");
  const bookClubPath = bookClubId
    ? `/book-clubs/${encodeURIComponent(bookClubId)}?panel=mystery`
    : null;
  const libraryPath = bookClubId
    ? `/library?bookClubId=${encodeURIComponent(bookClubId)}`
    : "/library";
  const { mysteries, selected, versions, loaded, owner, recoveryDrafts } = useMysteryPreservation(
    user?.id,
  );
  const requestedSelection = useRef<{ owner: typeof owner; id: string } | null>(null);
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
  const choose = (mystery: (typeof mysteries)[number]) => {
    owner.choose(mystery);
    setFocusedEntryId(null);
  };
  const selectedId = selected?.id;
  const selectedComplexity = selected?.data.complexity;
  useEffect(() => {
    if (
      !isAuthenticated ||
      !loaded ||
      !requestedMysteryId ||
      (requestedSelection.current?.owner === owner &&
        requestedSelection.current.id === requestedMysteryId)
    )
      return;
    // Resolve query ids only against the current account's owned mysteries.
    const mystery = mysteries.find((entry) => entry.id === requestedMysteryId);
    if (!mystery) return;
    requestedSelection.current = { owner, id: requestedMysteryId };
    owner.choose(mystery);
    setFocusedEntryId(null);
  }, [isAuthenticated, loaded, mysteries, owner, requestedMysteryId]);
  useEffect(() => {
    setComplexityInput(selectedId ? String(selectedComplexity) : "");
  }, [selectedId, selectedComplexity]);
  const updateSelected = useCallback(
    (updates: Partial<MysteryData> & { title?: string }) => owner.edit(updates),
    [owner],
  );
  const save = async (kind: "auto" | "manual") => {
    const saved = await owner.save(kind);
    if (saved && kind === "manual") toast.success(t`Manual version saved.`);
    return saved;
  };

  const removeEntry = useCallback((entry: object, remove: () => void) => {
    if (!hasEnteredInformation(entry)) {
      remove();
      return;
    }
    const title =
      "title" in entry && typeof entry.title === "string" ? entry.title.trim() : undefined;
    setConfirmation({ kind: "remove-entry", title: title || undefined, onConfirm: remove });
  }, []);

  const createMystery = async () => {
    if (await owner.create(defaultMystery())) {
      setFocusedEntryId(null);
      toast.success(t`A fresh parchment awaits.`);
    }
  };
  const deleteMystery = async () => {
    const deleted = await owner.delete();
    if (!deleted) return;
    setConfirmation(null);
    toast.success(t`Mystery deleted.`, {
      action: {
        label: t`Undo`,
        onClick: () =>
          void owner.undelete(deleted.id).then((restored) => {
            if (restored) toast.success(t`Mystery restored.`);
          }),
      },
    });
  };
  const restoreVersion = async (version: MysteryVersion) => {
    const undo = await owner.restore(version);
    if (undo)
      toast.success(t`Version restored.`, {
        action: { label: t`Undo`, onClick: () => void undo() },
      });
  };
  const publish = async () => {
    if (await owner.publish()) toast.success(t`Submitted for superadmin approval.`);
  };
  const bringToBookClub = async () => {
    if (!bookClubId || !bookClubPath || !selected || bringingToBookClub) return;
    setBringingToBookClub(true);
    const brought = await owner.preserve(async (saved) => {
      await api.createBookClubMystery(
        bookClubId,
        saved.id,
        saved.title || t`Untitled Mystery`,
        clueLabels(saved.data.clues),
        clueLabels(saved.data.voidClues),
      );
      return true;
    });
    if (brought) window.location.assign(bookClubPath);
    else setBringingToBookClub(false);
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
            <Button size="sm" variant="dark" onClick={createMystery} aria-label={t`Create mystery`}>
              <Plus className="size-4" />
            </Button>
          </div>
          <a href={libraryPath} className="mystery-library-link">
            <Library className="size-4" />
            <Trans>Public Library</Trans>
          </a>
          <div className="mystery-list">
            {mysteries.map((mystery) => (
              <ContextActions
                key={mystery.id}
                actions={[
                  { label: t`Open mystery`, run: () => choose(mystery) },
                  {
                    label: t`Delete mystery`,
                    destructive: true,
                    run: () => {
                      choose(mystery);
                      setConfirmation({ kind: "delete", title: mystery.title });
                    },
                  },
                ]}
              >
                <Button
                  variant="bare"
                  onClick={() => choose(mystery)}
                  className={selected?.id === mystery.id ? "active" : ""}
                >
                  {mystery.title || <Trans>Untitled Mystery</Trans>}
                </Button>
              </ContextActions>
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
            {recoveryDrafts?.map((draft) => (
              <div
                key={draft.mystery.id}
                role="status"
                className="m-4 rounded border border-current p-3"
              >
                <p>{draft.mystery.title}</p>
                <Button onClick={() => void owner.retryRecovery(draft)}>
                  <Trans>Retry draft recovery</Trans>
                </Button>
              </div>
            ))}
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
          aria-label={t`Add location`}
          title={t`Add location`}
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
          aria-label={t`Add suspect`}
          title={t`Add suspect`}
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
          aria-label={t`Add moment`}
          title={t`Add moment`}
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
          aria-label={key === "clues" ? t`Add clue` : t`Add void clue`}
          title={key === "clues" ? t`Add clue` : t`Add void clue`}
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
