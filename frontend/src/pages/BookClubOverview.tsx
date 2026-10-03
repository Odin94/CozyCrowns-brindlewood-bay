import { Die, DICE_ROLL_DURATION_MS } from "@/components/character/DiceRoller";
import { SceneryArtwork } from "@/components/book-club/SceneryArtwork";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PressTooltip } from "@/components/ui/tooltip";
import { getCrownOfTheVoid } from "@/game_data";
import { useAuth } from "@/hooks/useAuth";
import { useLiveBookClub } from "@/hooks/useLiveBookClub";
import { reconcileClubSelection } from "@/lib/live_book_club";
import { accountScope } from "@/lib/account_scope";
import { useBookClubStore } from "@/lib/book_club_store";
import { useCharacterStore } from "@/lib/character_store";
import {
  api,
  type BookClub,
  type BookClubCharacter,
  type BookClubInvitation,
  type BookClubNoteCursor,
} from "@/utils/api";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Dices,
  Eye,
  EyeOff,
  Lightbulb,
  Lock,
  NotebookPen,
  Palette,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import {
  type ComponentType,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import "./book-club.css";

type CharacterWithOwner = BookClubCharacter & { ownerId: string; nickname: string | null };
export type DrawerPage = "mystery" | "rolls" | "characters" | "settings" | "notes" | "clues";
type Scenery = "harbor" | "teaGarden" | "midnightMeeting" | "moonlitPier";
type Ornament = "tentacles" | "yarn" | "tea" | "biscuits";

const sceneryOptions: Array<{ id: Scenery; label: string }> = [
  { id: "harbor", label: t`Harbor sunset` },
  { id: "teaGarden", label: t`Tea garden` },
  { id: "midnightMeeting", label: t`Midnight meeting` },
  { id: "moonlitPier", label: t`Moonlit pier` },
];
const ornamentOptions: Array<{ id: Ornament; label: string }> = [
  { id: "tentacles", label: t`Curling tentacles` },
  { id: "yarn", label: t`Yarn and needles` },
  { id: "tea", label: t`Tea leaves` },
  { id: "biscuits", label: t`Little biscuits` },
];

const drawerPages: Array<{
  id: DrawerPage;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}> = [
  { id: "mystery", label: t`Mystery`, description: t`Choose tonight's mystery`, icon: BookOpen },
  { id: "rolls", label: t`Rolls`, description: t`Roll dice and see the table`, icon: Dices },
  {
    id: "characters",
    label: t`Characters`,
    description: t`Bring Mavens to the table`,
    icon: Users,
  },
  { id: "notes", label: t`Notes`, description: t`Shared and private notes`, icon: NotebookPen },
  { id: "clues", label: t`Clues`, description: t`Review every clue`, icon: Lightbulb },
  { id: "settings", label: t`Settings`, description: t`Manage this Book Club`, icon: Settings },
];

const characterName = (character: Pick<BookClubCharacter, "name">) =>
  character.name || t`Unnamed Maven`;
const relativeTime = (date: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 10) return t`just now`;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
};

const reconcilePendingNote = (server: string, sent: string, current: string) => {
  if (current === sent) return server;
  if (server === sent || current.includes(server)) return current;
  if (server.includes(current)) return server;
  if (server.endsWith(sent)) return `${server.slice(0, -sent.length)}${current}`;
  if (server.startsWith(sent)) return `${current}${server.slice(sent.length)}`;
  return `${server}\n\n${current}`;
};

type BookClubOverviewProps = {
  clubId: string | null;
  panel: DrawerPage | null;
  onClose: () => void;
  onClubChange: (clubId: string | null) => void;
  onPanelChange: (panel: DrawerPage | null) => void;
  onOpenMaven: (clubId: string, characterId: string) => void;
  onTheorize: (bookClubId: string, mysteryId: string) => void;
};

const BookClubOverview = ({
  clubId,
  panel,
  onClose,
  onClubChange,
  onPanelChange,
  onTheorize,
  onOpenMaven,
}: BookClubOverviewProps) => {
  const [retainedPanel, setRetainedPanel] = useState(panel);
  useEffect(() => {
    if (panel) {
      setRetainedPanel(panel);
      return;
    }
    const timer = window.setTimeout(() => setRetainedPanel(null), 240);
    return () => window.clearTimeout(timer);
  }, [panel]);
  const displayedPanel = panel ?? retainedPanel;
  const { user } = useAuth();
  const {
    data,
    loading,
    error: loadError,
    cursors: noteCursors,
    live,
  } = useLiveBookClub(
    "overview",
    { clubs: [] as BookClub[], invitations: [] as BookClubInvitation[] },
    api.getBookClubs,
    (error) => toast.error(error instanceof Error ? error.message : t`Could not load Book Clubs`),
    user?.id,
  );
  const { clubs, invitations } = data;
  const setClubs = (update: BookClub[] | ((current: BookClub[]) => BookClub[])) =>
    live.edit((current) => ({
      ...current,
      clubs: typeof update === "function" ? update(current.clubs) : update,
    }));
  const setInvitations = (update: (current: BookClubInvitation[]) => BookClubInvitation[]) =>
    live.edit((current) => ({ ...current, invitations: update(current.invitations) }));
  const [selectedClubId, setSelectedClubId] = useState<string | null>(clubId);
  const selectedClubIdRef = useRef<string | null>(clubId);
  const [newClubName, setNewClubName] = useState("");
  const [inviteNickname, setInviteNickname] = useState("");
  const [quickNavOpen, setQuickNavOpen] = useState(false);
  const [quickNavQuery, setQuickNavQuery] = useState("");
  const [scenery, setScenery] = useState<Scenery>(() =>
    readPreference("book-club-scenery", sceneryOptions, "harbor"),
  );
  const [ornament, setOrnament] = useState<Ornament>(() =>
    readPreference("book-club-ornament", ornamentOptions, "tentacles"),
  );
  const { characters: localCharacters } = useCharacterStore();
  const setActiveBookClub = useBookClubStore((state) => state.setActiveBookClub);
  const setShareRolls = useBookClubStore((state) => state.setShareRolls);

  useEffect(() => {
    if (clubId) {
      selectedClubIdRef.current = clubId;
      setSelectedClubId(clubId);
    }
  }, [clubId]);

  const selectClub = useCallback(
    (nextClubId: string) => {
      selectedClubIdRef.current = nextClubId;
      setSelectedClubId(nextClubId);
      onClubChange(nextClubId);
    },
    [onClubChange],
  );

  const refresh = useCallback((showError = true) => live.refresh(!showError), [live]);
  useEffect(() => {
    if (loading || loadError != null) return;
    const next = reconcileClubSelection(
      clubs.map((entry) => entry.id),
      clubId,
      selectedClubIdRef.current,
    );
    selectedClubIdRef.current = next;
    setSelectedClubId(next);
    if (next !== clubId) onClubChange(next);
  }, [clubs, loading, loadError, clubId, onClubChange]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuickNavOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => window.localStorage.setItem("book-club-scenery", scenery), [scenery]);
  useEffect(() => window.localStorage.setItem("book-club-ornament", ornament), [ornament]);

  const club = clubs.find((entry) => entry.id === selectedClubId) ?? null;
  const ownMember = club?.members.find((member) => member.id === user?.id);
  const assignedCharacterIds = useMemo(
    () => new Set(ownMember?.characters.map((character) => character.id) ?? []),
    [ownMember],
  );
  const isGameMaster = ownMember?.isGameMaster ?? false;
  const isOwner = club?.ownerId === user?.id;

  useEffect(() => {
    setActiveBookClub(
      club && ownMember
        ? { id: club.id, name: club.name, characterIds: [...assignedCharacterIds] }
        : null,
    );
  }, [assignedCharacterIds, club, ownMember, setActiveBookClub]);
  useEffect(() => setShareRolls(false), [club?.id, setShareRolls]);

  const updateClub = (updated: BookClub) =>
    setClubs((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
  const createClub = async () => {
    try {
      const created = await api.createBookClub(newClubName);
      setClubs((current) => [...current, created]);
      setNewClubName("");
      selectClub(created.id);
      toast.success(t`Book Club created`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not create Book Club`);
    }
  };
  const invite = async () => {
    if (!club) return;
    try {
      await api.inviteToBookClub(club.id, inviteNickname);
      setInviteNickname("");
      toast.success(t`Invitation sent`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not send invitation`);
    }
  };
  const copyInviteLink = async () => {
    if (!club) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/book-clubs/${encodeURIComponent(club.id)}`,
      );
      toast.success(t`Invite link copied`);
    } catch {
      toast.error(t`Could not copy the invite link`);
    }
  };
  const respondToInvitation = async (invitation: BookClubInvitation, accept: boolean) => {
    try {
      const result = await api.respondToBookClubInvitation(invitation.club.id, accept);
      if (accept && "members" in result) {
        setClubs((current) => [...current.filter((entry) => entry.id !== result.id), result]);
        selectClub(result.id);
      }
      setInvitations((current) => current.filter((entry) => entry.club.id !== invitation.club.id));
      toast.success(accept ? t`Joined Book Club` : t`Invitation declined`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not update invitation`);
    }
  };
  const assignCharacter = async (id: string) => {
    if (!club) return;
    try {
      updateClub(await api.assignBookClubCharacter(club.id, id));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t`Could not bring that Maven to the club`,
      );
    }
  };
  const removeCharacter = async (id: string) => {
    if (!club) return;
    try {
      await api.removeBookClubCharacter(club.id, id);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not remove that Maven`);
    }
  };
  const makeGameMaster = async (id: string) => {
    if (!club) return;
    try {
      updateClub(await api.setBookClubGameMaster(club.id, id, true));
      toast.success(t`Game Master updated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not update the GM`);
    }
  };
  const activateMystery = async (id: string) => {
    if (!club) return;
    try {
      updateClub(await api.activateBookClubMystery(club.id, id));
      toast.success(t`Mystery is now active`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not activate the mystery`);
    }
  };
  const deleteClub = async () => {
    if (!club) return;
    const deletedClub = club;
    try {
      await api.deleteBookClub(deletedClub.id);
      const remaining = clubs.filter((entry) => entry.id !== deletedClub.id);
      setClubs(remaining);
      onPanelChange(null);
      if (remaining[0]) selectClub(remaining[0].id);
      else {
        selectedClubIdRef.current = null;
        setSelectedClubId(null);
        onClubChange(null);
      }
      toast.success(t`Book Club deleted`, {
        duration: 8_000,
        action: {
          label: t`Undo`,
          onClick: () =>
            void api
              .restoreBookClub(deletedClub.id)
              .then((restored) => {
                setClubs((current) => [
                  restored,
                  ...current.filter((entry) => entry.id !== restored.id),
                ]);
                selectClub(restored.id);
              })
              .catch((error) =>
                toast.error(error instanceof Error ? error.message : t`Could not load Book Clubs`),
              ),
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not delete the Book Club`);
    }
  };

  const characters: CharacterWithOwner[] =
    club?.members.flatMap((member) =>
      member.characters.map((character) => ({
        ...character,
        ownerId: member.id,
        nickname: member.nickname,
      })),
    ) ?? [];
  const activeScenery = sceneryOptions.find(({ id }) => id === scenery)!;
  const activeOrnament = ornamentOptions.find(({ id }) => id === ornament)!;

  return (
    <div className={`book-club-shell book-club-shell--${scenery} ${panel ? "has-drawer" : ""}`}>
      <SceneryArtwork scenery={scenery} />
      <div className="book-club-haze" aria-hidden="true" />
      <div className="book-club-club-picker">
        <Button variant="bare" size="icon" onClick={onClose} aria-label={t`Back to sheet`}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        {clubs.length > 0 && (
          <Select value={club?.id ?? ""} onValueChange={selectClub}>
            <SelectTrigger className="book-club-picker-field" aria-label={t`Choose a Book Club`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="book-club-picker-options">
              {clubs.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {club && (
        <InviteStation
          inviteNickname={inviteNickname}
          onInviteNicknameChange={setInviteNickname}
          onInvite={() => void invite()}
          onCopy={() => void copyInviteLink()}
        />
      )}
      <div className="book-club-style-switchers">
        <Button
          variant="bare"
          onClick={() =>
            setScenery((current) =>
              cycleOption(
                current,
                sceneryOptions.map(({ id }) => id),
              ),
            )
          }
          title={t`Cycle background`}
        >
          <Palette aria-hidden="true" />
          <span>{activeScenery.label}</span>
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button
          variant="bare"
          onClick={() =>
            setOrnament((current) =>
              cycleOption(
                current,
                ornamentOptions.map(({ id }) => id),
              ),
            )
          }
          title={t`Cycle card corners`}
        >
          <Sparkles aria-hidden="true" />
          <span>{activeOrnament.label}</span>
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      {invitations.length > 0 && (
        <InvitationTray invitations={invitations} onRespond={respondToInvitation} />
      )}
      <main className="book-club-stage">
        {loadError != null && (
          <section className="cozy-load-error" role="alert">
            <p>{loadError instanceof Error ? loadError.message : t`Could not load Book Clubs`}</p>
            <Button variant="dark" onClick={() => void live.refresh(false)}>
              <Trans>Try again</Trans>
            </Button>
          </section>
        )}
        {loading ? (
          <div className="book-club-loading">
            <Sparkles aria-hidden="true" />
          </div>
        ) : club ? (
          <>
            <header className="book-club-title">
              <p>
                <Trans>Book Club</Trans>
              </p>
              <h1>{club.name}</h1>
              <span>
                {club.members.length} {club.members.length === 1 ? t`player` : t`players`}
                {club.activeMystery ? ` · ${club.activeMystery.title}` : ""}
              </span>
            </header>
            <section className="book-club-characters" aria-label={t`Active characters`}>
              {characters.map((character) => (
                <MavenCard
                  key={character.id}
                  character={character}
                  own={character.ownerId === user?.id}
                  ornament={ornament}
                  href={`/book-clubs/${encodeURIComponent(club.id)}/mavens/${encodeURIComponent(character.id)}`}
                  onOpen={() => onOpenMaven(club.id, character.id)}
                />
              ))}
              {characters.length === 0 && (
                <div className="book-club-no-characters">
                  <Users aria-hidden="true" />
                  <h2>
                    <Trans>The table is waiting</Trans>
                  </h2>
                  <p>
                    <Trans>
                      Add a Maven from the Characters drawer to bring her into the scene.
                    </Trans>
                  </p>
                  <Button variant="dark" onClick={() => onPanelChange("characters")}>
                    <Plus aria-hidden="true" /> <Trans>Add a Maven</Trans>
                  </Button>
                </div>
              )}
            </section>
          </>
        ) : loadError == null ? (
          <EmptyClubState
            name={newClubName}
            onNameChange={setNewClubName}
            onCreate={() => void createClub()}
          />
        ) : null}
      </main>
      {club && (
        <>
          <div className={`book-club-drawer-track ${panel ? "is-open" : ""}`}>
            <DrawerRail
              className="book-club-drawer-rail--desktop"
              activePage={panel}
              onSelect={(page) => onPanelChange(panel === page ? null : page)}
            />
            {displayedPanel && (
              <ClubDrawer
                closing={!panel}
                title={drawerPages.find(({ id }) => id === displayedPanel)!.label}
                onClose={() => onPanelChange(null)}
                headerAction={
                  displayedPanel === "clues" && club.activeMystery ? (
                    <Button
                      variant="bare"
                      size="bare"
                      className="book-club-canvas-link"
                      onClick={() => onTheorize(club.id, club.activeMystery!.id)}
                    >
                      <Lightbulb aria-hidden="true" /> <Trans>Clue canvas</Trans>{" "}
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  ) : undefined
                }
              >
                {displayedPanel === "mystery" && (
                  <MysteryPanel
                    club={club}
                    isGameMaster={isGameMaster}
                    onActivate={activateMystery}
                  />
                )}
                {displayedPanel === "rolls" && (
                  <RollsPanel club={club} onRefresh={() => void refresh(false)} />
                )}
                {displayedPanel === "characters" && (
                  <CharactersPanel
                    localCharacters={localCharacters}
                    assignedIds={assignedCharacterIds}
                    onAssign={assignCharacter}
                    onRemove={removeCharacter}
                  />
                )}
                {displayedPanel === "settings" && (
                  <SettingsPanel
                    club={club}
                    isOwner={isOwner}
                    onUpdate={updateClub}
                    onMakeGameMaster={makeGameMaster}
                    onDelete={deleteClub}
                  />
                )}
                {displayedPanel === "notes" && (
                  <NotesPanel
                    key={club.id}
                    club={club}
                    socket={live.socket}
                    cursors={noteCursors.filter(
                      (cursor) =>
                        cursor.bookClubId === club.id && Date.now() - cursor.seenAt < 8_000,
                    )}
                  />
                )}
                {displayedPanel === "clues" && (
                  <CluesPanel
                    key={`${club.id}:${club.activeMystery?.id ?? "none"}`}
                    club={club}
                    isGameMaster={isGameMaster}
                    onUpdate={updateClub}
                  />
                )}
              </ClubDrawer>
            )}
          </div>
          <DrawerRail
            className="book-club-drawer-rail--mobile"
            activePage={panel}
            onSelect={(page) => onPanelChange(panel === page ? null : page)}
          />
        </>
      )}
      <QuickNavigator
        open={quickNavOpen}
        query={quickNavQuery}
        onQueryChange={setQuickNavQuery}
        onOpenChange={setQuickNavOpen}
        onSelect={(page) => {
          onPanelChange(page);
          setQuickNavOpen(false);
          setQuickNavQuery("");
        }}
      />
    </div>
  );
};

function readPreference<T extends string>(key: string, options: Array<{ id: T }>, fallback: T): T {
  const value = typeof window === "undefined" ? null : window.localStorage.getItem(key);
  return options.some(({ id }) => id === value) ? (value as T) : fallback;
}
function cycleOption<T>(current: T, values: T[]) {
  return values[(values.indexOf(current) + 1) % values.length];
}

function InviteStation({
  inviteNickname,
  onInviteNicknameChange,
  onInvite,
  onCopy,
}: {
  inviteNickname: string;
  onInviteNicknameChange: (value: string) => void;
  onInvite: () => void;
  onCopy: () => void;
}) {
  return (
    <aside className="book-club-invite-station" aria-label={t`Invite players`}>
      <Button variant="bare" onClick={onCopy}>
        <Copy aria-hidden="true" /> <Trans>Copy invite link</Trans>
      </Button>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (inviteNickname.trim()) onInvite();
        }}
      >
        <Input
          value={inviteNickname}
          onChange={(event) => onInviteNicknameChange(event.target.value)}
          placeholder={t`Invite with nickname`}
          aria-label={t`Nickname`}
        />
        <Button type="submit" variant="bare" disabled={!inviteNickname.trim()}>
          <ChevronRight aria-hidden="true" />
          <span className="sr-only">
            <Trans>Invite</Trans>
          </span>
        </Button>
      </form>
    </aside>
  );
}

function InvitationTray({
  invitations,
  onRespond,
}: {
  invitations: BookClubInvitation[];
  onRespond: (invitation: BookClubInvitation, accept: boolean) => void;
}) {
  return (
    <aside className="book-club-invitations">
      {invitations.map((invitation) => (
        <div key={invitation.club.id}>
          <p>
            <strong>{invitation.invitedByNickname ?? t`A player`}</strong>{" "}
            <Trans>invited you to</Trans> <strong>{invitation.club.name}</strong>
          </p>
          <span>
            <Button size="sm" onClick={() => void onRespond(invitation, true)}>
              <Trans>Accept</Trans>
            </Button>
            <Button size="sm" variant="bare" onClick={() => void onRespond(invitation, false)}>
              <Trans>Decline</Trans>
            </Button>
          </span>
        </div>
      ))}
    </aside>
  );
}

function DrawerRail({
  className,
  activePage,
  onSelect,
}: {
  className: string;
  activePage: DrawerPage | null;
  onSelect: (page: DrawerPage) => void;
}) {
  return (
    <nav className={`book-club-drawer-rail ${className}`} aria-label={t`Book Club tools`}>
      {drawerPages.map(({ id, label, icon: Icon }) => (
        <Button
          key={id}
          variant="bare"
          className={activePage === id ? "is-active" : ""}
          onClick={() => onSelect(id)}
          aria-label={label}
          aria-pressed={activePage === id}
          title={label}
        >
          <Icon aria-hidden={true} />
          <span>{label}</span>
        </Button>
      ))}
    </nav>
  );
}

function ClubDrawer({
  closing,
  title,
  onClose,
  children,
  headerAction,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  closing: boolean;
}) {
  return (
    <aside
      className={`book-club-drawer ${closing ? "is-closing" : ""}`}
      inert={closing}
      aria-label={title}
    >
      <header>
        <div>
          <span>
            <Trans>Book Club</Trans>
          </span>
          <h2>{title}</h2>
        </div>
        {headerAction}
        <Button variant="bare" size="icon" onClick={onClose} aria-label={t`Close drawer`}>
          <span aria-hidden="true" className="book-club-close-glyph">
            «
          </span>
        </Button>
      </header>
      <div className="book-club-drawer-scroll">{children}</div>
    </aside>
  );
}

function MysteryPanel({
  club,
  isGameMaster,
  onActivate,
}: {
  club: BookClub;
  isGameMaster: boolean;
  onActivate: (id: string) => void;
}) {
  return (
    <div className="book-club-panel-stack">
      <section className="book-club-feature-card">
        <span className="book-club-eyebrow">
          <Trans>Tonight's mystery</Trans>
        </span>
        <h3>{club.activeMystery?.title ?? t`No active mystery`}</h3>
        <p>
          {club.activeMystery
            ? t`The Mavens are on the case.`
            : t`Choose a mystery below to begin the evening.`}
        </p>
      </section>
      <section>
        <h3 className="book-club-section-title">
          <Trans>Club mysteries</Trans>
        </h3>
        <div className="book-club-choice-list">
          {club.mysteries.map((mystery) => (
            <div key={mystery.id} className={mystery.isActive ? "is-selected" : ""}>
              <span>
                <strong>{mystery.title}</strong>
                {mystery.isActive && (
                  <small>
                    <Check aria-hidden="true" /> <Trans>Active</Trans>
                  </small>
                )}
              </span>
              {isGameMaster && !mystery.isActive && (
                <Button size="sm" variant="outline" onClick={() => void onActivate(mystery.id)}>
                  <Trans>Make active</Trans>
                </Button>
              )}
            </div>
          ))}
          {club.mysteries.length === 0 && (
            <p className="book-club-muted">
              <Trans>No mysteries have been added yet.</Trans>
            </p>
          )}
        </div>
      </section>
      {isGameMaster && (
        <div className="book-club-link-grid">
          <a href={`/mysteries?bookClubId=${encodeURIComponent(club.id)}`}>
            <Plus aria-hidden="true" />
            <span>
              <Trans>Create mystery</Trans>
              <small>
                <Trans>Write a case for this club</Trans>
              </small>
            </span>
          </a>
          <a href={`/library?bookClubId=${encodeURIComponent(club.id)}`}>
            <BookOpen aria-hidden="true" />
            <span>
              <Trans>Mystery library</Trans>
              <small>
                <Trans>Your cases and the public library</Trans>
              </small>
            </span>
          </a>
        </div>
      )}
    </div>
  );
}

function RollsPanel({ club, onRefresh }: { club: BookClub; onRefresh: () => void }) {
  const [diceCount, setDiceCount] = useState(2);
  const [rolling, setRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState<Array<{ id: string; value: number }> | null>(null);
  const [animating, setAnimating] = useState(false);
  useEffect(() => {
    if (!lastRoll) return;
    setAnimating(true);
    const timer = window.setTimeout(() => setAnimating(false), DICE_ROLL_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [lastRoll]);
  const roll = async () => {
    const dice = Array.from({ length: diceCount }, (_, index) => ({
      id: `${Date.now()}-${index}`,
      value: Math.floor(Math.random() * 6) + 1,
    }));
    setLastRoll(dice);
    setRolling(true);
    try {
      await api.shareBookClubRoll(club.id, {
        label: t`Table roll`,
        dice: `${diceCount}d6`,
        result: `${dice.reduce((sum, die) => sum + die.value, 0)} (${dice.map(({ value }) => value).join(", ")})`,
      });
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not share that roll`);
    } finally {
      setRolling(false);
    }
  };
  return (
    <div className="book-club-panel-stack">
      <section className="book-club-roll-maker">
        <div>
          <span className="book-club-eyebrow">
            <Trans>Custom D6 roll</Trans>
          </span>
          <h3>
            <Trans>How many dice?</Trans>
          </h3>
        </div>
        <div className="book-club-stepper">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDiceCount((count) => Math.max(1, count - 1))}
            aria-label={t`Remove one die`}
          >
            −
          </Button>
          <strong>
            {diceCount}
            <small>d6</small>
          </strong>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDiceCount((count) => Math.min(12, count + 1))}
            aria-label={t`Add one die`}
          >
            +
          </Button>
        </div>
        {lastRoll && (
          <div className="book-club-dice-result" aria-live="polite">
            {lastRoll.map((die, index) => (
              <Die
                key={die.id}
                value={die.value}
                rollId={Number(die.id.split("-")[0])}
                index={index}
                isRemoved={false}
              />
            ))}
            <p className="w-full text-center">
              {animating
                ? t`Rolling…`
                : `${lastRoll.reduce((sum, die) => sum + die.value, 0)} (${lastRoll.map((die) => die.value).join(", ")})`}
            </p>
          </div>
        )}
        <Button variant="dark" onClick={() => void roll()} disabled={rolling || animating}>
          <Dices aria-hidden="true" />
          {rolling ? t`Rolling…` : t`Roll at the table`}
        </Button>
      </section>
      <section>
        <h3 className="book-club-section-title">
          <Trans>Recent rolls</Trans>
        </h3>
        <ol className="book-club-roll-list">
          {club.rolls.map((eventRoll) => (
            <li key={eventRoll.id}>
              <span>
                <strong>{eventRoll.characterName}</strong>
                <small>
                  {eventRoll.label} · {eventRoll.dice}
                </small>
              </span>
              <b>{eventRoll.result}</b>
              <time title={new Date(eventRoll.createdAt).toLocaleString()}>
                {relativeTime(eventRoll.createdAt)}
              </time>
            </li>
          ))}
          {club.rolls.length === 0 && (
            <p className="book-club-muted">
              <Trans>No rolls yet. Be the first to tempt fate.</Trans>
            </p>
          )}
        </ol>
      </section>
    </div>
  );
}

function CharactersPanel({
  localCharacters,
  assignedIds,
  onAssign,
  onRemove,
}: {
  localCharacters: ReturnType<typeof useCharacterStore.getState>["characters"];
  assignedIds: Set<string>;
  onAssign: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number; id: string; assigned: boolean } | null>(
    null,
  );
  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);
  const act = (id: string, assigned: boolean) => void (assigned ? onRemove(id) : onAssign(id));
  return (
    <div className="book-club-panel-stack">
      <p className="book-club-intro">
        <Trans>Choose which of your saved Mavens are sitting in on this Book Club.</Trans>
      </p>
      <div className="book-club-character-list">
        {localCharacters.map((character) => {
          const assigned = Boolean(character.id && assignedIds.has(character.id));
          return (
            <div
              key={character.id ?? character.name}
              className={assigned ? "is-selected" : ""}
              onContextMenu={(event) => {
                if (!character.id) return;
                event.preventDefault();
                setMenu({ x: event.clientX, y: event.clientY, id: character.id, assigned });
              }}
            >
              <span>
                <strong>{character.name || t`Unnamed Maven`}</strong>
                <small>{assigned ? t`At the table` : t`Not in this club`}</small>
              </span>
              {character.id ? (
                <Button
                  size="sm"
                  variant={assigned ? "outline" : "dark"}
                  onClick={() => act(character.id!, assigned)}
                >
                  {assigned ? t`Remove` : t`Add`}
                </Button>
              ) : (
                <small>
                  <Trans>Save sheet first</Trans>
                </small>
              )}
            </div>
          );
        })}
      </div>
      {menu && (
        <div className="book-club-context-menu" style={{ left: menu.x, top: menu.y }}>
          <Button variant="bare" onClick={() => act(menu.id, menu.assigned)}>
            {menu.assigned ? t`Remove from table` : t`Bring to table`}
          </Button>
        </div>
      )}
    </div>
  );
}

function SettingsPanel({
  club,
  isOwner,
  onUpdate,
  onMakeGameMaster,
  onDelete,
}: {
  club: BookClub;
  isOwner: boolean;
  onUpdate: (club: BookClub) => void;
  onMakeGameMaster: (id: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(club.name);
  useEffect(() => setName(club.name), [club.name]);
  const rename = async (event: FormEvent) => {
    event.preventDefault();
    try {
      onUpdate(await api.renameBookClub(club.id, name));
      toast.success(t`Book Club renamed`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not rename the Book Club`);
    }
  };
  return (
    <div className="book-club-panel-stack">
      <section>
        <h3 className="book-club-section-title">
          <Trans>Book Club name</Trans>
        </h3>
        <form className="book-club-inline-form" onSubmit={(event) => void rename(event)}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={!isOwner}
            maxLength={80}
          />
          <Button
            type="submit"
            variant="dark"
            disabled={!isOwner || name.trim().length < 2 || name.trim() === club.name}
          >
            <Trans>Save</Trans>
          </Button>
        </form>
        {!isOwner && (
          <p className="book-club-muted">
            <Lock aria-hidden="true" /> <Trans>Only the club owner can change this.</Trans>
          </p>
        )}
      </section>
      <section>
        <h3 className="book-club-section-title">
          <Trans>Game Master</Trans>
        </h3>
        <div className="book-club-gm-list">
          {club.members.map((member) => (
            <label key={member.id} className={member.isGameMaster ? "is-selected" : ""}>
              <Checkbox
                checked={member.isGameMaster}
                disabled={!isOwner}
                onCheckedChange={(checked) => checked === true && void onMakeGameMaster(member.id)}
              />
              <span>
                <strong>{member.nickname ?? t`Player`}</strong>
                <small>{member.id === club.ownerId ? t`Club owner` : t`Member`}</small>
              </span>
            </label>
          ))}
        </div>
      </section>
      {isOwner && (
        <section className="book-club-danger-zone">
          <h3>
            <Trans>Close this chapter</Trans>
          </h3>
          <PressTooltip content={t`Delete Book Club`} side="bottom" align="end">
            <Button
              variant="bare"
              size="icon"
              className="book-club-delete"
              aria-label={t`Delete Book Club`}
              onClick={() => void onDelete()}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </PressTooltip>
        </section>
      )}
    </div>
  );
}

function NotesPanel({
  club,
  socket,
  cursors,
}: {
  club: BookClub;
  socket: import("@/lib/live_book_club").LiveConnection | null;
  cursors: Array<BookClubNoteCursor & { seenAt: number }>;
}) {
  const session = useSyncExternalStore(accountScope.subscribe, accountScope.current);
  const ownerId = useRef(accountScope.current().accountId).current;
  const [shared, setShared] = useState({
    content: club.sharedNotes,
    version: club.sharedNotesVersion,
  });
  const [privateNotes, setPrivateNotes] = useState({ content: "", version: 0 });
  const [saved, setSaved] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const versions = useRef({ shared: club.sharedNotesVersion, private: 0 });
  const latest = useRef({ shared: club.sharedNotes, private: "" });
  const dirty = useRef({ shared: false, private: false });
  const saving = useRef({ shared: false, private: false });
  const timers = useRef<{ shared?: number; private?: number }>({});
  const mounted = useRef(true);
  const persistRef = useRef<(kind: "shared" | "private") => Promise<void>>(async () => {});

  const updateSavedState = () => {
    if (!mounted.current) return;
    setSaved(
      !dirty.current.shared &&
        !dirty.current.private &&
        !saving.current.shared &&
        !saving.current.private,
    );
  };

  const persist = useCallback(
    async (kind: "shared" | "private") => {
      const scope = accountScope.current();
      if (
        !ownerId ||
        scope.accountId !== ownerId ||
        scope.revalidating ||
        scope.signingOut ||
        saving.current[kind] ||
        !dirty.current[kind]
      )
        return;
      if (timers.current[kind]) window.clearTimeout(timers.current[kind]);
      timers.current[kind] = undefined;
      saving.current[kind] = true;
      const content = latest.current[kind];
      let continueWithNewerEdit = false;
      try {
        const result = await api.updateBookClubNotes(club.id, {
          kind,
          content,
          baseVersion: versions.current[kind],
        });
        const current = accountScope.current();
        if (current.accountId !== ownerId || current.generation !== scope.generation) {
          continueWithNewerEdit =
            mounted.current &&
            current.accountId === ownerId &&
            !current.revalidating &&
            !current.signingOut;
          return;
        }
        versions.current[kind] = result.version;
        if (latest.current[kind] === content) {
          dirty.current[kind] = false;
          localStorage.removeItem(`cozycrowns-book-club-notes:${ownerId}:${club.id}:${kind}`);
          latest.current[kind] = result.content;
          if (mounted.current) {
            if (kind === "shared") setShared(result);
            else setPrivateNotes(result);
          }
        } else {
          const reconciled = reconcilePendingNote(result.content, content, latest.current[kind]);
          latest.current[kind] = reconciled;
          localStorage.setItem(
            `cozycrowns-book-club-notes:${ownerId}:${club.id}:${kind}`,
            JSON.stringify({ content: reconciled, version: result.version }),
          );
          continueWithNewerEdit = true;
          if (mounted.current) {
            if (kind === "shared") setShared({ content: reconciled, version: result.version });
            else setPrivateNotes({ content: reconciled, version: result.version });
          }
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t`Could not save notes`);
      } finally {
        saving.current[kind] = false;
        updateSavedState();
        if (continueWithNewerEdit) void persistRef.current(kind);
      }
    },
    [club.id, ownerId],
  );
  persistRef.current = persist;

  useEffect(() => {
    const scope = accountScope.current();
    if (scope.accountId !== ownerId || scope.revalidating || scope.signingOut) return;
    let cancelled = false;
    setLoadingNotes(true);
    void api
      .getBookClubNotes(club.id)
      .then((notes) => {
        const current = accountScope.current();
        if (cancelled || current.accountId !== ownerId || current.generation !== scope.generation)
          return;
        for (const kind of ["shared", "private"] as const) {
          try {
            const draft = JSON.parse(
              localStorage.getItem(`cozycrowns-book-club-notes:${ownerId}:${club.id}:${kind}`) ??
                "null",
            );
            if (
              !dirty.current[kind] &&
              draft &&
              typeof draft.content === "string" &&
              Number.isInteger(draft.version)
            ) {
              dirty.current[kind] = true;
              latest.current[kind] = draft.content;
              versions.current[kind] = draft.version;
              if (kind === "shared") setShared(draft);
              else setPrivateNotes(draft);
            }
          } catch {
            /* Leave malformed recovery data intact. */
          }
        }
        if (notes.shared.version >= versions.current.shared && !dirty.current.shared) {
          setShared(notes.shared);
          latest.current.shared = notes.shared.content;
          versions.current.shared = notes.shared.version;
        }
        if (notes.private.version >= versions.current.private && !dirty.current.private) {
          setPrivateNotes(notes.private);
          latest.current.private = notes.private.content;
          versions.current.private = notes.private.version;
        }
        for (const kind of ["shared", "private"] as const)
          if (dirty.current[kind]) void persistRef.current(kind);
      })
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : t`Could not load notes`),
      )
      .finally(() => {
        if (!cancelled) setLoadingNotes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [club.id, ownerId, session.generation, session.revalidating, session.signingOut]);

  useEffect(() => {
    if (
      club.sharedNotesVersion <= versions.current.shared ||
      dirty.current.shared ||
      saving.current.shared
    )
      return;
    versions.current.shared = club.sharedNotesVersion;
    latest.current.shared = club.sharedNotes;
    setShared({ content: club.sharedNotes, version: club.sharedNotesVersion });
  }, [club.sharedNotes, club.sharedNotesVersion]);

  useEffect(() => {
    mounted.current = true;
    const timerState = timers.current;
    const dirtyState = dirty.current;
    const savingState = saving.current;
    const persistPending = persistRef;
    return () => {
      mounted.current = false;
      if (timerState.shared) window.clearTimeout(timerState.shared);
      if (timerState.private) window.clearTimeout(timerState.private);
      if (dirtyState.shared && !savingState.shared) void persistPending.current("shared");
      if (dirtyState.private && !savingState.private) void persistPending.current("private");
    };
  }, []);

  const queueSave = (kind: "shared" | "private", content: string) => {
    latest.current[kind] = content;
    dirty.current[kind] = true;
    try {
      localStorage.setItem(
        `cozycrowns-book-club-notes:${ownerId}:${club.id}:${kind}`,
        JSON.stringify({ content, version: versions.current[kind] }),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not save notes`);
    }
    setSaved(false);
    if (timers.current[kind]) window.clearTimeout(timers.current[kind]);
    timers.current[kind] = window.setTimeout(() => {
      void persistRef.current(kind);
    }, 650);
  };
  const sendCursor = (element: HTMLTextAreaElement) => {
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: "book-club-note-cursor",
        bookClubId: club.id,
        start: element.selectionStart,
        end: element.selectionEnd,
      }),
    );
  };
  return (
    <div className="book-club-panel-stack">
      <div className="book-club-note-status" aria-live="polite">
        <span className={saved ? "is-saved" : ""}>{saved ? t`All notes saved` : t`Saving…`}</span>
        {cursors.length > 0 && (
          <span>
            {cursors.map((cursor) => cursor.nickname ?? t`Another player`).join(", ")}{" "}
            {cursors.length === 1 ? t`is writing` : t`are writing`}
          </span>
        )}
      </div>
      <label className="book-club-note-field">
        <span>
          <Users aria-hidden="true" />
          <strong>
            <Trans>Shared notebook</Trans>
          </strong>
          <small>
            <Trans>Everyone in the club can read and edit this.</Trans>
          </small>
        </span>
        <textarea
          value={shared.content}
          disabled={loadingNotes}
          onChange={(event) => {
            setShared((current) => ({ ...current, content: event.target.value }));
            queueSave("shared", event.target.value);
          }}
          onSelect={(event) => sendCursor(event.currentTarget)}
          onKeyUp={(event) => sendCursor(event.currentTarget)}
          placeholder={t`The fog rolled in just after tea…`}
        />
        {cursors.map((cursor) => (
          <i
            key={cursor.userId}
            className="book-club-live-cursor"
            style={
              {
                "--cursor-position": Math.min(
                  100,
                  (cursor.start / Math.max(1, shared.content.length)) * 100,
                ),
              } as React.CSSProperties
            }
          >
            {cursor.nickname ?? t`Player`}
          </i>
        ))}
      </label>
      <label className="book-club-note-field is-private">
        <span>
          <Lock aria-hidden="true" />
          <strong>
            <Trans>Private notebook</Trans>
          </strong>
          <small>
            <Trans>Only you can see these notes.</Trans>
          </small>
        </span>
        <textarea
          value={privateNotes.content}
          disabled={loadingNotes}
          onChange={(event) => {
            setPrivateNotes((current) => ({ ...current, content: event.target.value }));
            queueSave("private", event.target.value);
          }}
          placeholder={t`A thought to keep under your hat…`}
        />
      </label>
    </div>
  );
}

const clueTitle = (text: string) => text.split(" — ")[0];

function CluesPanel({
  club,
  isGameMaster,
  onUpdate,
}: {
  club: BookClub;
  isGameMaster: boolean;
  onUpdate: (club: BookClub) => void;
}) {
  const active = club.activeMystery;
  const [revealing, setRevealing] = useState<string | null>(null);
  const [selectedClue, setSelectedClue] = useState<
    NonNullable<BookClub["activeMystery"]>["clues"][number] | null
  >(null);
  const [description, setDescription] = useState("");
  const [revealError, setRevealError] = useState("");
  const mounted = useRef(true);
  const revealPending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const setClueVisibility = async (
    clue: NonNullable<BookClub["activeMystery"]>["clues"][number],
    checked: boolean,
    text?: string,
  ) => {
    if (!active || revealPending.current || !isGameMaster) return;
    revealPending.current = true;
    const scope = accountScope.current();
    setRevealing(clue.id);
    setRevealError("");
    try {
      const updated = await api.updateBookClubClue(club.id, active.id, clue.id, {
        checked,
        ...(checked && text !== undefined && text !== clue.text ? { text } : {}),
      });
      if (
        !mounted.current ||
        !(
          accountScope.current().generation === scope.generation &&
          accountScope.current().accountId === scope.accountId
        )
      )
        return;
      onUpdate(updated);
      setSelectedClue(null);
      toast.success(
        checked ? t`Clue revealed and added to the canvas.` : t`Clue hidden from players.`,
      );
    } catch (error) {
      if (
        mounted.current &&
        accountScope.current().generation === scope.generation &&
        accountScope.current().accountId === scope.accountId
      )
        setRevealError(error instanceof Error ? error.message : t`Could not update clue`);
    } finally {
      revealPending.current = false;
      if (mounted.current) setRevealing(null);
    }
  };
  const otherVoidClues = club.mysteries
    .filter((mystery) => mystery.id !== active?.id)
    .flatMap((mystery) =>
      mystery.voidClues
        .filter((clue) => clue.checked)
        .map((clue) => Object.assign({}, clue, { mystery: mystery.title })),
    );
  return (
    <div className="book-club-panel-stack">
      {active ? (
        <>
          <ClueGroup
            title={t`Found clues`}
            clues={active.clues.filter((clue) => clue.checked && !clue.isVoid)}
          />
          <ClueGroup
            title={t`Found Void Clues`}
            clues={active.clues.filter((clue) => clue.checked && clue.isVoid)}
            voidClues
          />
          {isGameMaster && (
            <section className="book-club-prepared-clues">
              <h3 className="book-club-section-title">
                <Trans>Mystery clues</Trans>
              </h3>
              <p className="book-club-muted">
                <Lock aria-hidden="true" />
                <Trans>Only the GM can see unrevealed clues.</Trans>
              </p>
              {revealError && (
                <p role="alert" className="book-club-reveal-error">
                  {revealError}
                </p>
              )}
              <ul className="book-club-clue-list">
                {active.clues.map((clue) => (
                  <li
                    key={clue.id}
                    className={`book-club-prepared-clue ${clue.isVoid ? "is-void" : ""} ${clue.checked ? "is-checked" : ""}`}
                  >
                    <PressTooltip content={clue.text} align="start">
                      <span className="book-club-clue-text" tabIndex={0}>
                        <strong>{clueTitle(clue.text)}</strong>
                        {clue.text.includes(" — ") && (
                          <> — {clue.text.split(" — ").slice(1).join(" — ")}</>
                        )}
                        <span className="sr-only">{clue.isVoid ? t`Void Clue` : ""}</span>
                      </span>
                    </PressTooltip>
                    <div className="book-club-clue-actions">
                      <PressTooltip
                        content={
                          revealing
                            ? t`Updating clue…`
                            : clue.checked
                              ? t`Unreveal clue`
                              : t`Reveal clue`
                        }
                      >
                        <span>
                          <Button
                            size="icon"
                            variant="bare"
                            className="book-club-clue-icon"
                            aria-label={`${clue.checked ? t`Unreveal clue` : t`Reveal clue`}: ${clueTitle(clue.text)}`}
                            disabled={revealing !== null}
                            onClick={() => void setClueVisibility(clue, !clue.checked)}
                          >
                            {clue.checked ? (
                              <EyeOff aria-hidden="true" />
                            ) : (
                              <Eye aria-hidden="true" />
                            )}
                          </Button>
                        </span>
                      </PressTooltip>
                      <PressTooltip content={revealing ? t`Updating clue…` : t`Customize`}>
                        <span>
                          <Button
                            size="icon"
                            variant="bare"
                            className="book-club-clue-icon"
                            aria-label={`${t`Customize`}: ${clueTitle(clue.text)}`}
                            disabled={revealing !== null}
                            onClick={() => {
                              setSelectedClue(clue);
                              setDescription(clue.text.split(" — ").slice(1).join(" — "));
                              setRevealError("");
                            }}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                        </span>
                      </PressTooltip>
                    </div>
                  </li>
                ))}
                {active.clues.length === 0 && (
                  <p className="book-club-muted">
                    <Trans>No clues yet.</Trans>
                  </p>
                )}
              </ul>
            </section>
          )}
          <section>
            <h3 className="book-club-section-title">
              <Trans>Void Clues from other mysteries</Trans>
            </h3>
            <ul className="book-club-clue-list is-void">
              {otherVoidClues.map((clue) => (
                <li key={clue.id}>
                  <PressTooltip content={clue.text} align="start">
                    <span className="book-club-clue-text" tabIndex={0}>
                      {clue.text}
                    </span>
                  </PressTooltip>
                  <small>{clue.mystery}</small>
                </li>
              ))}
              {otherVoidClues.length === 0 && (
                <p className="book-club-muted">
                  <Trans>No other Void Clues yet.</Trans>
                </p>
              )}
            </ul>
          </section>
          <Dialog
            open={selectedClue !== null}
            onOpenChange={(open) => {
              if (!open && !revealing) setSelectedClue(null);
            }}
          >
            <DialogContent
              className="book-club-clue-dialog"
              onInteractOutside={(event) => {
                if (revealing) event.preventDefault();
              }}
              onEscapeKeyDown={(event) => {
                if (revealing) event.preventDefault();
              }}
            >
              <DialogHeader>
                <DialogTitle>
                  <Trans>Reveal a clue</Trans>
                </DialogTitle>
                <DialogDescription>
                  <Trans>Players will see this description in found clues and on the canvas.</Trans>
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (selectedClue)
                    void setClueVisibility(
                      selectedClue,
                      true,
                      [clueTitle(selectedClue.text), description.trim()]
                        .filter(Boolean)
                        .join(" — "),
                    );
                }}
              >
                <h3>{selectedClue ? clueTitle(selectedClue.text) : ""}</h3>
                <label className="book-club-clue-description">
                  <Trans>Description</Trans>
                  <Textarea
                    autoFocus
                    value={description}
                    maxLength={Math.max(
                      0,
                      20500 - (selectedClue ? clueTitle(selectedClue.text).length : 0) - 3,
                    )}
                    disabled={revealing !== null}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
                {revealError && (
                  <p role="alert" className="book-club-reveal-error">
                    {revealError}
                  </p>
                )}
                <div className="book-club-clue-actions">
                  <Button
                    type="button"
                    variant="bare"
                    disabled={revealing !== null}
                    onClick={() => setSelectedClue(null)}
                  >
                    <Trans>Cancel</Trans>
                  </Button>
                  <Button type="submit" variant="dark" disabled={revealing !== null}>
                    {revealing ? <Trans>Revealing…</Trans> : <Trans>Reveal clue</Trans>}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <p className="book-club-muted">
          <Trans>Choose an active mystery to reveal its clues.</Trans>
        </p>
      )}
    </div>
  );
}

function ClueGroup({
  title,
  clues,
  voidClues = false,
}: {
  title: string;
  clues: Array<{ id: string; text: string; checked: boolean }>;
  voidClues?: boolean;
}) {
  return (
    <section>
      <h3 className="book-club-section-title">{title}</h3>
      <ul className={`book-club-clue-list ${voidClues ? "is-void" : ""}`}>
        {clues.map((clue) => (
          <li key={clue.id} className={clue.checked ? "is-checked" : ""}>
            {clue.checked && <Check aria-hidden="true" />}
            <PressTooltip content={clue.text} align="start">
              <span className="book-club-clue-text" tabIndex={0}>
                {clue.text}
              </span>
            </PressTooltip>
          </li>
        ))}
        {clues.length === 0 && (
          <p className="book-club-muted">
            <Trans>No clues yet.</Trans>
          </p>
        )}
      </ul>
    </section>
  );
}

function QuickNavigator({
  open,
  query,
  onQueryChange,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSelect: (page: DrawerPage) => void;
}) {
  const matches = drawerPages.filter(({ label, description }) =>
    `${label} ${description}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="book-club-quick-nav sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <Trans>Go to a Book Club tool</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Search Mystery, Rolls, Characters, Settings, Notes, or Clues.</Trans>
          </DialogDescription>
        </DialogHeader>
        <label className="book-club-search">
          <Search aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t`Search tools…`}
            autoFocus
          />
        </label>
        <div className="book-club-quick-list">
          {matches.map(({ id, label, description, icon: Icon }) => (
            <Button key={id} variant="bare" onClick={() => onSelect(id)}>
              <Icon aria-hidden={true} />
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <ChevronRight aria-hidden="true" />
            </Button>
          ))}
        </div>
        <small className="book-club-shortcut">
          <kbd>⌘</kbd>
          <kbd>K</kbd> <Trans>to toggle</Trans>
        </small>
        <Button
          variant="bare"
          onClick={() => {
            onOpenChange(false);
            window.dispatchEvent(new Event("cozycrowns:open-navigation"));
          }}
        >
          <Search aria-hidden="true" />
          <Trans>Go to a page</Trans>
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function EmptyClubState({
  name,
  onNameChange,
  onCreate,
}: {
  name: string;
  onNameChange: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <section className="book-club-empty-state">
      <BookOpen aria-hidden="true" />
      <h1>
        <Trans>Gather a Book Club</Trans>
      </h1>
      <p>
        <Trans>Bring Mavens together, share rolls, and solve a mystery in one cozy place.</Trans>
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) onCreate();
        }}
      >
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={t`Book Club name`}
          aria-label={t`Book Club name`}
        />
        <Button type="submit" variant="dark" disabled={name.trim().length < 2}>
          <Plus aria-hidden="true" />
          <Trans>Create Book Club</Trans>
        </Button>
      </form>
    </section>
  );
}

function MavenCard({
  href,
  character,
  own,
  ornament,
  onOpen,
}: {
  href: string;
  character: CharacterWithOwner;
  own: boolean;
  ornament: Ornament;
  onOpen: () => void;
}) {
  const data = character.data;
  const activeCrownIndex = data.voidChecks?.lastIndexOf(true) ?? -1;
  const crown = activeCrownIndex >= 0 ? getCrownOfTheVoid()[activeCrownIndex] : null;
  const availableItems = (data.cozyItems ?? []).filter(
    (item) => item.text?.trim() && !item.checked,
  );
  const usedItems = (data.cozyItems ?? []).filter((item) => item.text?.trim() && item.checked);
  return (
    <a
      className="book-club-maven-card"
      href={href}
      aria-label={t`Open ${characterName(character)}’s character sheet`}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onOpen();
      }}
    >
      <CardOrnament ornament={ornament} />
      <header>
        <span>{own ? t`Your Maven` : (character.nickname ?? t`Player`)}</span>
        <h2>{characterName(character)}</h2>
      </header>
      <CardSummary
        title={t`Active conditions`}
        values={summaryItems(data.conditions)}
        empty={t`None recorded`}
      />
      <CardSummary
        title={t`Maven Moves`}
        values={summaryItems(data.mavenMoves)}
        empty={t`None recorded`}
      />
      <CardSummary
        title={t`Crown of the Void`}
        values={[
          crown
            ? `${activeCrownIndex + 1}/${getCrownOfTheVoid().length} ${crown.title}`
            : t`None active`,
        ]}
      />
      <CardSummary
        title={t`A Cozy Little Place`}
        values={[
          ...availableItems.map((item) => item.text),
          ...usedItems.map((item) => `✓ ${item.text}`),
        ]}
        empty={t`No available items`}
      />
    </a>
  );
}

function CardSummary({
  title,
  values,
  empty,
}: {
  title: string;
  values: string[];
  empty?: string;
}) {
  return (
    <section>
      <h3>{title}</h3>
      {values.length ? (
        <ul>
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}

function CardOrnament({ ornament }: { ornament: Ornament }) {
  return (
    <div
      className={`book-club-card-filigree book-club-card-filigree--${ornament}`}
      aria-hidden="true"
    >
      {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((corner) => (
        <svg key={corner} className={`book-club-card-ornament is-${corner}`} viewBox="0 0 100 100">
          <path className="filigree-frame" d="M5 82V5h77" />
          {ornament === "tentacles" && (
            <>
              <path d="M6 62c3-24 21-31 28-19 6 11-6 19-13 12-5-5 1-12 7-8M8 39c17-3 23-17 16-25-5-7-16-2-13 6 2 6 10 4 10-1M39 7c-3 18 11 26 23 18 10-6 21 3 14 12-5 7-14 1-10-5M58 6c16 5 19 18 10 25" />
              <path className="filigree-accent" d="M6 73c13-9 16-21 9-31M73 6c-8 13-20 16-31 9" />
              <circle cx="7" cy="72" r="2.2" />
              <circle cx="73" cy="7" r="2.2" />
            </>
          )}
          {ornament === "yarn" && (
            <>
              <circle cx="22" cy="22" r="13" />
              <path d="M10 19c12-5 21 2 25 12M12 29c8-10 17-13 27-8M17 10c-1 13 7 23 19 27M33 34c17 3 28 13 25 27-2 9-13 12-17 4-3-7 6-12 11-7M35 12c12 11 25 12 39 5" />
              <path className="filigree-accent" d="M7 74c12-7 22-18 25-35M74 7c-11 9-23 13-36 13" />
              <path d="M49 5l18 31M57 5l14 27" />
            </>
          )}
          {ornament === "tea" && (
            <>
              <path d="M7 72c15-11 18-24 14-39C18 20 26 10 40 7M21 37c-11-6-14-15-10-22 10-1 17 5 18 16M23 43c12-8 22-7 28-1-2 11-12 16-25 10M43 7c-5 13 0 23 11 27 10 4 14 13 8 21M49 19c6-10 15-12 23-7 0 10-7 17-18 17" />
              <path
                className="filigree-accent"
                d="M6 82V70M70 6h12M10 60c11-4 18-12 21-24M61 10c-10 7-19 9-28 6"
              />
            </>
          )}
          {ornament === "biscuits" && (
            <>
              <circle cx="22" cy="23" r="14" />
              <circle cx="22" cy="23" r="3" />
              <circle cx="15" cy="17" r="1.6" />
              <circle cx="29" cy="17" r="1.6" />
              <circle cx="15" cy="29" r="1.6" />
              <circle cx="29" cy="30" r="1.6" />
              <path d="M10 43c18-5 30 4 31 20 1 11-13 17-19 8-5-8 5-16 12-10M42 12c12 15 26 17 38 9M41 28c9 11 20 16 34 14" />
              <path className="filigree-accent" d="M7 73c9-8 14-18 15-29M73 7c-9 8-20 12-31 11" />
              <circle cx="11" cy="53" r="1.8" />
              <circle cx="53" cy="11" r="1.8" />
            </>
          )}
        </svg>
      ))}
    </div>
  );
}

function summaryItems(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
}

export default BookClubOverview;
