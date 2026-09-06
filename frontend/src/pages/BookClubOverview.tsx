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
import { getCrownOfTheVoid } from "@/game_data";
import { useAuth } from "@/hooks/useAuth";
import { useBookClubStore } from "@/lib/book_club_store";
import { useCharacterStore } from "@/lib/character_store";
import TheorizeBoard from "@/pages/TheorizeBoard";
import {
  api,
  connectBookClubUpdates,
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
  Lightbulb,
  Lock,
  NotebookPen,
  Palette,
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
  { id: "settings", label: t`Settings`, description: t`Manage this Book Club`, icon: Settings },
  { id: "notes", label: t`Notes`, description: t`Shared and private notes`, icon: NotebookPen },
  { id: "clues", label: t`Clues`, description: t`Review every clue`, icon: Lightbulb },
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

type BookClubOverviewProps = {
  clubId: string | null;
  panel: DrawerPage | null;
  onClose: () => void;
  onClubChange: (clubId: string) => void;
  onPanelChange: (panel: DrawerPage | null) => void;
};

const BookClubOverview = ({
  clubId,
  panel,
  onClose,
  onClubChange,
  onPanelChange,
}: BookClubOverviewProps) => {
  const { user } = useAuth();
  const [clubs, setClubs] = useState<BookClub[]>([]);
  const [invitations, setInvitations] = useState<BookClubInvitation[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(clubId);
  const selectedClubIdRef = useRef<string | null>(clubId);
  const [newClubName, setNewClubName] = useState("");
  const [inviteNickname, setInviteNickname] = useState("");
  const [theorizeMystery, setTheorizeMystery] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [quickNavOpen, setQuickNavOpen] = useState(false);
  const [quickNavQuery, setQuickNavQuery] = useState("");
  const [noteCursors, setNoteCursors] = useState<Array<BookClubNoteCursor & { seenAt: number }>>(
    [],
  );
  const [scenery, setScenery] = useState<Scenery>(() =>
    readPreference("book-club-scenery", sceneryOptions, "harbor"),
  );
  const [ornament, setOrnament] = useState<Ornament>(() =>
    readPreference("book-club-ornament", ornamentOptions, "tentacles"),
  );
  const isRefreshing = useRef(false);
  const refreshQueued = useRef(false);
  const socketRef = useRef<WebSocket | null>(null);
  const { characters: localCharacters, setCurrentCharacter } = useCharacterStore();
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

  const refresh = useCallback(
    async (showError = true) => {
      if (isRefreshing.current) {
        refreshQueued.current = true;
        return;
      }
      isRefreshing.current = true;
      try {
        const response = await api.getBookClubs();
        setClubs(response.clubs);
        setInvitations(response.invitations);
        const previous = selectedClubIdRef.current;
        const next =
          (clubId && response.clubs.some((entry) => entry.id === clubId) ? clubId : null) ??
          (response.clubs.some((entry) => entry.id === previous) ? previous : null) ??
          response.clubs[0]?.id ??
          null;
        selectedClubIdRef.current = next;
        setSelectedClubId(next);
        if (next && next !== clubId) onClubChange(next);
      } catch (error) {
        if (showError)
          toast.error(error instanceof Error ? error.message : t`Could not load Book Clubs`);
      } finally {
        setLoading(false);
        isRefreshing.current = false;
        if (refreshQueued.current) {
          refreshQueued.current = false;
          void refresh(false);
        }
      }
    },
    [clubId, onClubChange],
  );

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(
      () => document.visibilityState === "visible" && void refresh(false),
      120_000,
    );
    const onVisible = () => document.visibilityState === "visible" && void refresh(false);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    let initialTimer: number | undefined;
    let reconnectTimer: number | undefined;
    let attempts = 0;
    let disposed = false;
    const connect = () => {
      if (disposed) return;
      const socket = connectBookClubUpdates(
        () => {
          attempts = 0;
          void refresh(false);
        },
        (cursor) => {
          if (cursor.userId === user?.id) return;
          setNoteCursors((current) => [
            ...current.filter((entry) => entry.userId !== cursor.userId),
            { ...cursor, seenAt: Date.now() },
          ]);
        },
      );
      socketRef.current = socket;
      socket?.addEventListener(
        "close",
        () => {
          if (disposed) return;
          reconnectTimer = window.setTimeout(connect, Math.min(5_000 * 2 ** attempts++, 60_000));
        },
        { once: true },
      );
    };
    initialTimer = window.setTimeout(connect, 0);
    return () => {
      disposed = true;
      if (initialTimer) window.clearTimeout(initialTimer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [refresh, user?.id]);

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
  const openOwnSheet = (character: CharacterWithOwner) => {
    const index = localCharacters.findIndex((entry) => entry.id === character.id);
    if (index < 0) return void toast.error(t`Your Maven is still syncing. Try again in a moment.`);
    setCurrentCharacter(index);
    onClose();
  };
  const deleteClub = async () => {
    if (!club) return;
    try {
      await api.deleteBookClub(club.id);
      const remaining = clubs.filter((entry) => entry.id !== club.id);
      setClubs(remaining);
      onPanelChange(null);
      if (remaining[0]) selectClub(remaining[0].id);
      else onClose();
      toast.success(t`Book Club deleted`);
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

  if (club && theorizeMystery)
    return (
      <TheorizeBoard
        bookClubId={club.id}
        mystery={theorizeMystery}
        onClose={() => setTheorizeMystery(null)}
      />
    );

  return (
    <div className={`book-club-shell book-club-shell--${scenery} ${panel ? "has-drawer" : ""}`}>
      <SceneryArtwork scenery={scenery} />
      <div className="book-club-haze" aria-hidden="true" />
      <div className="book-club-club-picker">
        <Button variant="bare" size="icon" onClick={onClose} aria-label={t`Back to sheet`}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        {clubs.length > 0 && (
          <select
            value={club?.id ?? ""}
            onChange={(event) => event.target.value && selectClub(event.target.value)}
            aria-label={t`Choose a Book Club`}
          >
            {clubs.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
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
                  onOpen={() => openOwnSheet(character)}
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
        ) : (
          <EmptyClubState
            name={newClubName}
            onNameChange={setNewClubName}
            onCreate={() => void createClub()}
          />
        )}
      </main>
      {club && (
        <DrawerRail
          activePage={panel}
          onSelect={(page) => onPanelChange(panel === page ? null : page)}
        />
      )}
      {club && panel && (
        <ClubDrawer
          title={drawerPages.find(({ id }) => id === panel)!.label}
          onClose={() => onPanelChange(null)}
        >
          {panel === "mystery" && (
            <MysteryPanel club={club} isGameMaster={isGameMaster} onActivate={activateMystery} />
          )}
          {panel === "rolls" && <RollsPanel club={club} onRefresh={() => void refresh(false)} />}
          {panel === "characters" && (
            <CharactersPanel
              localCharacters={localCharacters}
              assignedIds={assignedCharacterIds}
              onAssign={assignCharacter}
              onRemove={removeCharacter}
            />
          )}
          {panel === "settings" && (
            <SettingsPanel
              club={club}
              isOwner={isOwner}
              onUpdate={updateClub}
              onMakeGameMaster={makeGameMaster}
              onDelete={deleteClub}
            />
          )}
          {panel === "notes" && (
            <NotesPanel
              club={club}
              socket={socketRef.current}
              cursors={noteCursors.filter(
                (cursor) => cursor.bookClubId === club.id && Date.now() - cursor.seenAt < 8_000,
              )}
            />
          )}
          {panel === "clues" && <CluesPanel club={club} onTheorize={setTheorizeMystery} />}
        </ClubDrawer>
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
  activePage,
  onSelect,
}: {
  activePage: DrawerPage | null;
  onSelect: (page: DrawerPage) => void;
}) {
  return (
    <nav className="book-club-drawer-rail" aria-label={t`Book Club tools`}>
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
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <aside className="book-club-drawer" aria-label={title}>
      <header>
        <div>
          <span>
            <Trans>Book Club</Trans>
          </span>
          <h2>{title}</h2>
        </div>
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
          <a href="/library">
            <BookOpen aria-hidden="true" />
            <span>
              <Trans>Mystery library</Trans>
              <small>
                <Trans>Browse published mysteries</Trans>
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
            {lastRoll.map((die) => (
              <span key={die.id}>{die.value}</span>
            ))}
          </div>
        )}
        <Button variant="dark" onClick={() => void roll()} disabled={rolling}>
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteName, setDeleteName] = useState("");
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
          <p>
            <Trans>
              Deleting a Book Club removes its shared mysteries, clues, rolls, and notes for
              everyone.
            </Trans>
          </p>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden="true" /> <Trans>Delete Book Club</Trans>
          </Button>
        </section>
      )}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="book-club-delete-dialog sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <Trans>Delete “{club.name}”?</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>This cannot be undone. Type the Book Club name to confirm.</Trans>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteName}
            onChange={(event) => setDeleteName(event.target.value)}
            placeholder={club.name}
            autoFocus
          />
          <div className="book-club-dialog-actions">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              <Trans>Keep Book Club</Trans>
            </Button>
            <Button
              variant="destructive"
              disabled={deleteName !== club.name}
              onClick={() => void onDelete()}
            >
              <Trash2 aria-hidden="true" /> <Trans>Delete forever</Trans>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotesPanel({
  club,
  socket,
  cursors,
}: {
  club: BookClub;
  socket: WebSocket | null;
  cursors: Array<BookClubNoteCursor & { seenAt: number }>;
}) {
  const [shared, setShared] = useState({
    content: club.sharedNotes,
    version: club.sharedNotesVersion,
  });
  const [privateNotes, setPrivateNotes] = useState({ content: "", version: 0 });
  const [saved, setSaved] = useState(true);
  const versions = useRef({ shared: club.sharedNotesVersion, private: 0 });
  const timers = useRef<{ shared?: number; private?: number }>({});
  useEffect(() => {
    let cancelled = false;
    void api
      .getBookClubNotes(club.id)
      .then((notes) => {
        if (cancelled) return;
        setShared(notes.shared);
        setPrivateNotes(notes.private);
        versions.current = { shared: notes.shared.version, private: notes.private.version };
      })
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : t`Could not load notes`),
      );
    return () => {
      cancelled = true;
    };
  }, [club.id]);
  useEffect(
    () => () => {
      if (timers.current.shared) window.clearTimeout(timers.current.shared);
      if (timers.current.private) window.clearTimeout(timers.current.private);
    },
    [],
  );
  const queueSave = (kind: "shared" | "private", content: string) => {
    setSaved(false);
    if (timers.current[kind]) window.clearTimeout(timers.current[kind]);
    timers.current[kind] = window.setTimeout(() => {
      void api
        .updateBookClubNotes(club.id, { kind, content, baseVersion: versions.current[kind] })
        .then((result) => {
          versions.current[kind] = result.version;
          if (kind === "shared")
            setShared((current) => (current.content === content ? result : current));
          else setPrivateNotes((current) => (current.content === content ? result : current));
          setSaved(true);
        })
        .catch((error) =>
          toast.error(error instanceof Error ? error.message : t`Could not save notes`),
        );
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

function CluesPanel({
  club,
  onTheorize,
}: {
  club: BookClub;
  onTheorize: (mystery: { id: string; title: string }) => void;
}) {
  const active = club.activeMystery;
  const otherVoidClues = club.mysteries
    .filter((mystery) => mystery.id !== active?.id)
    .flatMap((mystery) => mystery.voidClues.map((clue) => ({ ...clue, mystery: mystery.title })));
  return (
    <div className="book-club-panel-stack">
      {active ? (
        <>
          <section className="book-club-feature-card">
            <span className="book-club-eyebrow">
              <Trans>Current mystery</Trans>
            </span>
            <h3>{active.title}</h3>
            <Button
              variant="dark"
              onClick={() => onTheorize({ id: active.id, title: active.title })}
            >
              <Sparkles aria-hidden="true" /> <Trans>Open clue canvas</Trans>
            </Button>
          </section>
          <ClueGroup title={t`Clues`} clues={active.clues.filter((clue) => !clue.isVoid)} />
          <ClueGroup
            title={t`Void Clues`}
            clues={active.clues.filter((clue) => clue.isVoid)}
            voidClues
          />
          <section>
            <h3 className="book-club-section-title">
              <Trans>Void Clues from other mysteries</Trans>
            </h3>
            <ul className="book-club-clue-list is-void">
              {otherVoidClues.map((clue) => (
                <li key={clue.id}>
                  <span>{clue.text}</span>
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
            <span>{clue.text}</span>
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
      <p className="book-club-eyebrow">
        <Trans>A table of your own</Trans>
      </p>
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
  character,
  own,
  ornament,
  onOpen,
}: {
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
    <article className="book-club-maven-card">
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
      {own && (
        <Button variant="bare" onClick={onOpen}>
          <Trans>Open my sheet</Trans>
          <ChevronRight aria-hidden="true" />
        </Button>
      )}
    </article>
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
    <svg
      className={`book-club-card-ornament book-club-card-ornament--${ornament}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      {ornament === "tentacles" && (
        <>
          <path d="M5 44C7 17 22 6 48 6M6 66c8-25 27-24 24-49M22 8c0 19 14 17 15 4" />
          <circle cx="7" cy="67" r="2" />
        </>
      )}
      {ornament === "yarn" && (
        <>
          <circle cx="18" cy="20" r="11" />
          <path d="M9 16c9 1 13 7 18 13M8 24c8-7 14-9 20-7M29 31c13 5 17 14 13 29M35 4l18 47M43 3l10 48" />
        </>
      )}
      {ornament === "tea" && (
        <>
          <path d="M7 8c18 1 31 12 35 32M15 21c8-9 18-8 21-5-2 10-9 16-20 14M31 32c4-12 13-15 19-14 1 10-4 17-15 19M9 49h31c0 13-6 20-16 20S9 62 9 49Zm31 4c14-2 14 12 2 12" />
        </>
      )}
      {ornament === "biscuits" && (
        <>
          <circle cx="18" cy="19" r="12" />
          <circle cx="18" cy="19" r="3" />
          <circle cx="12" cy="13" r="1.5" />
          <circle cx="25" cy="14" r="1.5" />
          <circle cx="11" cy="24" r="1.5" />
          <circle cx="26" cy="25" r="1.5" />
          <path d="M6 48c13-10 27-8 40 4M16 39c5 10 13 17 25 21" />
        </>
      )}
    </svg>
  );
}

function SceneryArtwork({ scenery }: { scenery: Scenery }) {
  return (
    <svg
      className="book-club-scenery"
      viewBox="0 0 1600 600"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      {scenery === "harbor" && (
        <>
          <circle className="sun" cx="1160" cy="185" r="75" />
          <path
            className="soft"
            d="M0 390c170-35 286 20 430-3 155-25 251-75 424-38 190 41 269-23 440-2 120 15 205 54 306 38v215H0Z"
          />
          <path d="M0 461h106l24-97h105l23 97h76l11-148h98l13 148h81l34-105h88l16 105h119l31-176h67l23 176h139l19-127h104l19 127h145v139H0Z" />
          <path
            className="line"
            d="M0 442c300-28 510 42 784 0s528 34 816-9M0 488c350-32 520 40 805 0s512 38 795-4"
          />
        </>
      )}
      {scenery === "teaGarden" && (
        <>
          <circle className="moon" cx="320" cy="130" r="60" />
          <path
            className="soft"
            d="M0 448c133-78 269-51 386-1 138 59 296 16 423-23 188-58 288 60 449 26 116-24 206-20 342 30v120H0Z"
          />
          <path d="M0 494c132-43 261-20 382 19 98 31 201 23 302 2 134-28 230-19 337 10 174 47 329-60 579-12v87H0Z" />
          <g>
            <path d="M620 510h220l-27-65H648Z" />
            <path d="M676 445v-54h104v54M643 505l-31 95M818 505l31 95" />
            <circle cx="703" cy="412" r="19" />
            <path d="M696 407h28v20h-28Zm28 4c20-5 21 17 2 16" />
          </g>
          <g>
            <circle cx="545" cy="407" r="30" />
            <path d="M513 448c4-44 62-44 66 0v82h-66Zm-10 82h88v18h-88Z" />
            <circle cx="918" cy="407" r="30" />
            <path d="M886 448c4-44 62-44 66 0v82h-66Zm-10 82h88v18h-88Z" />
          </g>
          <path className="line" d="M80 510c70-120 140-91 195 5M1280 523c45-146 150-137 222-10" />
        </>
      )}
      {scenery === "midnightMeeting" && (
        <>
          <circle className="moon" cx="1190" cy="130" r="56" />
          <path
            className="soft"
            d="M0 510c167-97 272-14 419-45 175-37 246 37 399-3 173-46 290 61 426 19 126-39 244-14 356 36v83H0Z"
          />
          <path d="M0 532c173-52 326 12 457-5 186-25 332 45 520 1 160-38 335 25 623 9v63H0Z" />
          <g>
            <path d="M593 538c-9-105 59-157 111-89 52-68 120-16 111 89Z" />
            <circle cx="704" cy="413" r="27" />
            <path d="M653 454c24-54 78-54 102 0" />
          </g>
          <g>
            <path d="M883 553c-5-78 46-121 87-69 40-52 91-9 86 69Z" />
            <circle cx="970" cy="455" r="21" />
          </g>
          <path
            className="line"
            d="M0 580c90-77 80-190 151-207 62-14 41 87 4 87-31 0-22-53 11-68M1600 576c-79-66-61-183-131-195-55-9-51 82-12 79 30-3 18-53-14-65"
          />
        </>
      )}
      {scenery === "moonlitPier" && (
        <>
          <circle className="moon" cx="380" cy="145" r="72" />
          <path className="soft" d="M0 410c279-25 514 26 800 0s526 29 800 0v190H0Z" />
          <path
            className="line"
            d="M0 431c299-27 504 30 805 0s510 34 795 0M0 470c313-25 518 35 812 0s502 31 788 0"
          />
          <path d="M910 396h560v35H910Zm80 35h28v169h-28Zm352 0h28v169h-28ZM1200 112h62l26 284h-114Zm-30 99h148l-26 23h-97Z" />
          <path d="M770 600c9-143 27-241 57-293h22c-27 76-39 174-42 293Z" />
        </>
      )}
    </svg>
  );
}

function summaryItems(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
}

export default BookClubOverview;
