import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useBookClubStore } from "@/lib/book_club_store";
import { useCharacterStore } from "@/lib/character_store";
import { parsePastedClueList } from "@/lib/clue_list";
import TheorizeBoard from "@/pages/TheorizeBoard";
import { getCrownOfTheVoid } from "@/game_data";
import {
  api,
  connectBookClubUpdates,
  type BookClub,
  type BookClubCharacter,
  type BookClubInvitation,
} from "@/utils/api";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BookOpen, ChevronLeft, Circle, Dices, Plus, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type CharacterWithOwner = BookClubCharacter & { ownerId: string; nickname: string | null };

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

const BookClubOverview = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const [clubs, setClubs] = useState<BookClub[]>([]);
  const [invitations, setInvitations] = useState<BookClubInvitation[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [newClubName, setNewClubName] = useState("");
  const [inviteNickname, setInviteNickname] = useState("");
  const [selectedMysteryId, setSelectedMysteryId] = useState("");
  const [theorizeMystery, setTheorizeMystery] = useState<{ id: string; title: string } | null>(null);
  const [clueText, setClueText] = useState("");
  const [voidClueText, setVoidClueText] = useState("");
  const [loading, setLoading] = useState(true);
  const isRefreshing = useRef(false);
  const refreshQueued = useRef(false);
  const { characters: localCharacters, setCurrentCharacter } = useCharacterStore();
  const setActiveBookClub = useBookClubStore((state) => state.setActiveBookClub);
  const setShareRolls = useBookClubStore((state) => state.setShareRolls);

  const refresh = useCallback(async (showError = true) => {
    if (isRefreshing.current) {
      refreshQueued.current = true;
      return;
    }
    isRefreshing.current = true;
    try {
      const response = await api.getBookClubs();
      setClubs(response.clubs);
      setInvitations(response.invitations);
      setSelectedClubId((selected) => selected ?? response.clubs[0]?.id ?? null);
    } catch (error) {
      if (showError) toast.error(error instanceof Error ? error.message : t`Could not load Book Clubs`);
    } finally {
      setLoading(false);
      isRefreshing.current = false;
      if (refreshQueued.current) {
        refreshQueued.current = false;
        void refresh(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(false);
    }, 120_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let reconnectAttempts = 0;
    let disposed = false;

    const connect = () => {
      socket = connectBookClubUpdates(() => {
        reconnectAttempts = 0;
        void refresh(false);
      });
      socket?.addEventListener(
        "close",
        () => {
          if (disposed) return;
          const delay = Math.min(5_000 * 2 ** reconnectAttempts, 60_000);
          reconnectAttempts += 1;
          reconnectTimer = window.setTimeout(connect, delay);
        },
        { once: true },
      );
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [refresh]);

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

  useEffect(() => {
    setShareRolls(false);
  }, [club?.id, setShareRolls]);

  const updateClub = (updated: BookClub) => {
    setClubs((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
  };

  const createClub = async () => {
    try {
      const created = await api.createBookClub(newClubName);
      setClubs((current) => [...current, created]);
      setNewClubName("");
      setSelectedClubId(created.id);
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

  const respondToInvitation = async (invitation: BookClubInvitation, accept: boolean) => {
    try {
      const result = await api.respondToBookClubInvitation(invitation.club.id, accept);
      if (accept && "members" in result) {
        setClubs((current) => [...current.filter((entry) => entry.id !== result.id), result]);
        setSelectedClubId(result.id);
      }
      setInvitations((current) => current.filter((entry) => entry.club.id !== invitation.club.id));
      toast.success(accept ? t`Joined Book Club` : t`Invitation declined`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not update invitation`);
    }
  };

  const assignCharacter = async (characterId: string) => {
    if (!club) return;
    try {
      updateClub(await api.assignBookClubCharacter(club.id, characterId));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t`Could not bring that Maven to the club`,
      );
    }
  };

  const removeCharacter = async (characterId: string) => {
    if (!club) return;
    try {
      await api.removeBookClubCharacter(club.id, characterId);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not remove that Maven`);
    }
  };

  const makeGameMaster = async (memberId: string) => {
    if (!club) return;
    try {
      updateClub(await api.setBookClubGameMaster(club.id, memberId, true));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not update the GM`);
    }
  };

  const createMystery = async (name: string, initialClues: string) => {
    if (!club) return false;
    try {
      updateClub(await api.createBookClubMystery(club.id, name, parsePastedClueList(initialClues)));
      toast.success(t`Mystery created`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not create the mystery`);
      return false;
    }
  };

  const activateMystery = async (mysteryId: string) => {
    if (!club) return false;
    try {
      updateClub(await api.activateBookClubMystery(club.id, mysteryId));
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not activate the mystery`);
      return false;
    }
  };

  const addClue = async (isVoid: boolean) => {
    if (!club?.activeMystery) return;
    const text = isVoid ? voidClueText : clueText;
    try {
      updateClub(await api.addBookClubClue(club.id, club.activeMystery.id, text, isVoid));
      if (isVoid) {
        setVoidClueText("");
      } else {
        setClueText("");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not add clue`);
    }
  };

  const setClueChecked = async (clueId: string, checked: boolean) => {
    if (!club?.activeMystery) return;
    try {
      updateClub(await api.updateBookClubClue(club.id, club.activeMystery.id, clueId, { checked }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not update clue`);
    }
  };

  const openOwnSheet = (character: CharacterWithOwner) => {
    const index = localCharacters.findIndex((entry) => entry.id === character.id);
    if (index < 0) {
      toast.error(t`Your Maven is still syncing. Try again in a moment.`);
      return;
    }
    setCurrentCharacter(index);
    onClose();
  };

  const characters: CharacterWithOwner[] =
    club?.members.flatMap((member) =>
      member.characters.map((character) => ({
        ...character,
        ownerId: member.id,
        nickname: member.nickname,
      })),
    ) ?? [];

  if (club && theorizeMystery) {
    return (
      <TheorizeBoard
        bookClubId={club.id}
        mystery={theorizeMystery}
        onClose={() => setTheorizeMystery(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-3 text-gray-100 sm:p-6">
      <div className="mx-auto flex max-w-7xl gap-6">
        <aside className="hidden w-64 shrink-0 rounded-xl bg-gray-800 p-4 shadow-lg lg:block">
          <Button
            variant="ghost"
            className="mb-6 w-full justify-start text-gray-100"
            onClick={onClose}
          >
            <ChevronLeft className="size-4" /> <Trans>Character sheets</Trans>
          </Button>
          <h2 className="flex items-center gap-2 font-semibold text-secondary">
            <Users className="size-4" /> <Trans>Book Clubs</Trans>
          </h2>
          <div className="mt-3 space-y-1">
            {clubs.map((entry) => (
              <Button
                key={entry.id}
                variant="bare"
                onClick={() => setSelectedClubId(entry.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${entry.id === club?.id ? "bg-dark-secondary text-tertiary" : "hover:bg-gray-700"}`}
              >
                {entry.name}
              </Button>
            ))}
          </div>
          <form
            className="mt-6 space-y-2 border-t border-gray-700 pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (newClubName.trim()) void createClub();
            }}
          >
            <Input
              value={newClubName}
              onChange={(event) => setNewClubName(event.target.value)}
              placeholder={t`New Book Club name`}
            />
            <Button className="w-full" type="submit" disabled={!newClubName.trim()}>
              <Plus /> <Trans>Create Book Club</Trans>
            </Button>
          </form>
          {club && (
            <div className="mt-6 border-t border-gray-700 pt-4">
              <ClubManagement
                club={club}
                isOwner={isOwner}
                inviteNickname={inviteNickname}
                onInviteNicknameChange={setInviteNickname}
                onInvite={() => void invite()}
                onMakeGameMaster={(memberId) => void makeGameMaster(memberId)}
                isGameMaster={isGameMaster}
                onCreateMystery={createMystery}
                compact
              />
            </div>
          )}
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 lg:hidden">
              <Button variant="outline" onClick={onClose}>
                <ChevronLeft className="size-4" /> <Trans>Sheets</Trans>
              </Button>
              <select
                value={club?.id ?? ""}
                onChange={(event) => setSelectedClubId(event.target.value || null)}
                className="h-9 max-w-52 rounded-md border border-gray-600 bg-gray-800 px-2 text-sm"
              >
                <option value="">
                  <Trans>Choose a Book Club</Trans>
                </option>
                {clubs.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {invitations.length > 0 && (
            <section className="mb-6 rounded-xl border border-secondary/35 bg-secondary/10 p-4">
              <h2 className="font-semibold text-secondary">
                <Trans>Book Club invitations</Trans>
              </h2>
              <div className="mt-3 space-y-2">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.club.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-900/60 p-3 text-sm"
                  >
                    <span>
                      <strong>{invitation.invitedByNickname ?? t`A player`}</strong>{" "}
                      <Trans>invited you to</Trans> <strong>{invitation.club.name}</strong>.
                    </span>
                    <span className="flex gap-2">
                      <Button size="sm" onClick={() => void respondToInvitation(invitation, true)}>
                        <Trans>Accept</Trans>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void respondToInvitation(invitation, false)}
                      >
                        <Trans>Decline</Trans>
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!club && !loading && (
            <section className="rounded-xl bg-gray-800 p-8 text-center shadow-lg">
              <BookOpen className="book-club-empty-icon mx-auto size-9 text-secondary" />
              <h1 className="mt-3 text-2xl font-bold">
                <Trans>Gather your Book Club</Trans>
              </h1>
              <p className="mx-auto mt-2 max-w-lg text-sm text-gray-300">
                <Trans>
                  Create a Book Club to bring Mavens together, share rolls, and keep a mystery’s
                  clues in one cozy place.
                </Trans>
              </p>
              <form
                className="mx-auto mt-5 flex max-w-sm gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (newClubName.trim()) void createClub();
                }}
              >
                <Input
                  value={newClubName}
                  onChange={(event) => setNewClubName(event.target.value)}
                  placeholder={t`New Book Club name`}
                />
                <Button type="submit" disabled={!newClubName.trim()}>
                  <Trans>Create</Trans>
                </Button>
              </form>
            </section>
          )}

          {club && (
            <>
              <header className="rounded-xl bg-gradient-to-br from-dark-secondary to-gray-800 p-4 shadow-lg sm:p-5">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
                  <Trans>CozyCrowns Book Club</Trans>
                </p>
                <h1 className="mt-1 !text-3xl leading-none text-tertiary">{club.name}</h1>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {club.members.map((member) => (
                    <span
                      key={member.id}
                      className="rounded-full border border-gray-600 bg-gray-950/35 px-2 py-0.5 text-xs leading-4"
                    >
                      <Circle className="mr-1 inline size-1.5 fill-emerald-400 text-emerald-400" />
                      {member.nickname ?? t`Player`}
                      {member.isGameMaster ? ` · ${t`GM`}` : ""}
                    </span>
                  ))}
                </div>
              </header>

              <section className="mt-5">
                <h2 className="mb-3 text-xl font-bold text-tertiary">
                  <Trans>At the table</Trans>
                </h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {characters.map((character) => (
                    <MavenCard
                      key={character.id}
                      character={character}
                      own={character.ownerId === user?.id}
                      onOpen={() => openOwnSheet(character)}
                    />
                  ))}
                  {characters.length === 0 && (
                    <p className="rounded-xl bg-gray-800 p-5 text-sm text-gray-300">
                      <Trans>No Mavens have been brought to this Book Club yet.</Trans>
                    </p>
                  )}
                </div>
              </section>

              <div className="mt-5 lg:hidden">
                <ClubManagement
                  club={club}
                  isOwner={isOwner}
                  inviteNickname={inviteNickname}
                  onInviteNicknameChange={setInviteNickname}
                  onInvite={() => void invite()}
                  onMakeGameMaster={(memberId) => void makeGameMaster(memberId)}
                  isGameMaster={isGameMaster}
                  onCreateMystery={createMystery}
                />
              </div>

              <section className="mt-5 space-y-5">
                <section className="rounded-xl bg-gray-800 p-5 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-secondary">
                        <Trans>Bring your Mavens</Trans>
                      </h2>
                      <p className="mt-1 text-sm text-gray-300">
                        <Trans>
                          Only Mavens at this Book Club can share their rolls with the table.
                        </Trans>
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {localCharacters.map((character) => {
                      const assigned = Boolean(
                        character.id && assignedCharacterIds.has(character.id),
                      );
                      return (
                        <div
                          key={character.id ?? character.name}
                          className="flex items-center gap-2 rounded-md border border-gray-600 px-3 py-2 text-sm"
                        >
                          <span>{character.name || t`Unnamed Maven`}</span>
                          {character.id ? (
                            <Button
                              size="sm"
                              variant={assigned ? "outline" : "default"}
                              onClick={() =>
                                void (assigned
                                  ? removeCharacter(character.id!)
                                  : assignCharacter(character.id!))
                              }
                            >
                              {assigned ? <Trans>Remove</Trans> : <Trans>Add</Trans>}
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400">
                              <Trans>Save sheet first</Trans>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-xl bg-gray-800 p-5 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-secondary">
                        <Trans>Active mystery</Trans>
                      </h2>
                      <p className="mt-1 text-sm text-gray-300">
                        {club.activeMystery ? (
                          club.activeMystery.title
                        ) : (
                          <Trans>No mystery is active.</Trans>
                        )}
                      </p>
                    </div>
                    {club.activeMystery && (
                      <Button
                        size="sm"
                        onClick={() =>
                          setTheorizeMystery({
                            id: club.activeMystery!.id,
                            title: club.activeMystery!.title,
                          })
                        }
                      >
                        <Trans>Theorize</Trans>
                      </Button>
                    )}
                    {club.mysteries.length > 1 && (
                      <select
                        aria-label={t`Open a different theory board`}
                        className="h-8 rounded-md border border-gray-600 bg-gray-950/35 px-2 text-xs text-gray-100"
                        defaultValue=""
                        onChange={(event) => {
                          const selected = club.mysteries.find(
                            (mystery) => mystery.id === event.target.value,
                          );
                          if (selected) {
                            setTheorizeMystery({ id: selected.id, title: selected.title });
                            event.currentTarget.value = "";
                          }
                        }}
                      >
                        <option value="">{t`Open another board…`}</option>
                        {club.mysteries
                          .filter((mystery) => mystery.id !== club.activeMystery?.id)
                          .map((mystery) => (
                            <option key={mystery.id} value={mystery.id}>
                              {mystery.title}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                  {isGameMaster && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="sr-only" htmlFor="active-mystery">
                        <Trans>Select a mystery</Trans>
                      </label>
                      <select
                        id="active-mystery"
                        className="h-9 min-w-48 rounded-md border border-gray-600 bg-gray-950/35 px-3 text-sm text-gray-100"
                        value={selectedMysteryId}
                        onChange={(event) => setSelectedMysteryId(event.target.value)}
                      >
                        <option value="">{t`Select a mystery`}</option>
                        {club.mysteries
                          .filter((mystery) => !mystery.isActive)
                          .map((mystery) => (
                            <option key={mystery.id} value={mystery.id}>
                              {mystery.title}
                            </option>
                          ))}
                      </select>
                      <Button
                        size="sm"
                        disabled={!selectedMysteryId}
                        onClick={() => {
                          void (async () => {
                            if (await activateMystery(selectedMysteryId)) setSelectedMysteryId("");
                          })();
                        }}
                      >
                        <Trans>Activate</Trans>
                      </Button>
                    </div>
                  )}
                  {club.activeMystery && (
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <ClueList
                        title={t`Clues`}
                        clues={club.activeMystery.clues.filter((clue) => !clue.isVoid)}
                        text={clueText}
                        onTextChange={setClueText}
                        onAdd={() => void addClue(false)}
                        onCheck={setClueChecked}
                        isGameMaster={isGameMaster}
                        placeholder={t`Add a clue...`}
                      />
                      <ClueList
                        title={t`Void Clues`}
                        clues={club.activeMystery.clues.filter((clue) => clue.isVoid)}
                        text={voidClueText}
                        onTextChange={setVoidClueText}
                        onAdd={() => void addClue(true)}
                        onCheck={setClueChecked}
                        isGameMaster={isGameMaster}
                        placeholder={t`Add a Void Clue...`}
                        voidClues
                      />
                    </div>
                  )}
                </section>

                <section className="rounded-xl bg-gray-800 p-5 shadow-lg">
                  <h2 className="flex items-center gap-2 font-semibold text-secondary">
                    <Dices className="size-4" /> <Trans>Recent table rolls</Trans>
                  </h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {characters.map((character) => (
                      <div key={character.id} className="rounded-lg bg-gray-900/65 p-3">
                        <h3 className="font-medium">{characterName(character)}</h3>
                        <div className="mt-2 space-y-2 text-sm">
                          {club.rolls
                            .filter((roll) => roll.characterId === character.id)
                            .slice(0, 4)
                            .map((roll) => (
                              <p key={roll.id}>
                                <span className="text-gray-400">
                                  {relativeTime(roll.createdAt)} · {roll.dice} · {roll.label}
                                </span>
                                <br />
                                <strong className="text-tertiary">{roll.result}</strong>
                              </p>
                            ))}
                          {!club.rolls.some((roll) => roll.characterId === character.id) && (
                            <p className="text-gray-400">
                              <Trans>No rolls yet</Trans>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {characters.length === 0 && (
                      <p className="text-sm text-gray-400">
                        <Trans>Add a Maven to start sharing rolls.</Trans>
                      </p>
                    )}
                  </div>
                </section>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

function ClubManagement({
  club,
  isOwner,
  inviteNickname,
  onInviteNicknameChange,
  onInvite,
  onMakeGameMaster,
  isGameMaster,
  onCreateMystery,
  compact = false,
}: {
  club: BookClub;
  isOwner: boolean;
  inviteNickname: string;
  onInviteNicknameChange: (nickname: string) => void;
  onInvite: () => void;
  onMakeGameMaster: (memberId: string) => void;
  isGameMaster: boolean;
  onCreateMystery: (name: string, initialClues: string) => Promise<boolean>;
  compact?: boolean;
}) {
  const sectionClass = compact
    ? "rounded-lg border border-gray-700 bg-gray-900/45 p-3"
    : "rounded-xl bg-gray-800 p-5 shadow-lg";

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      <section className={sectionClass}>
        <h2 className="font-semibold text-secondary">
          <Trans>Invite a player</Trans>
        </h2>
        <p className="mt-1 text-sm text-gray-300">
          <Trans>Invite by their unique profile nickname.</Trans>
        </p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (inviteNickname.trim()) onInvite();
          }}
        >
          <Input
            value={inviteNickname}
            onChange={(event) => onInviteNicknameChange(event.target.value)}
            placeholder={t`Nickname`}
          />
          <Button type="submit" disabled={!inviteNickname.trim()}>
            <Trans>Invite</Trans>
          </Button>
        </form>
      </section>
      {isGameMaster && <MysteryCreation onCreate={onCreateMystery} sectionClass={sectionClass} />}
      {isOwner && (
        <section className={sectionClass}>
          <h2 className="font-semibold text-secondary">
            <Trans>Choose the GM</Trans>
          </h2>
          <p className="mt-1 text-sm text-gray-300">
            <Trans>The GM manages mysteries and clues. A Book Club has one GM at a time.</Trans>
          </p>
          <div className="mt-3 space-y-2">
            {club.members.map((member) => (
              <label
                key={member.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-600 p-2 text-sm"
              >
                <Checkbox
                  checked={member.isGameMaster}
                  onCheckedChange={(checked) => checked === true && onMakeGameMaster(member.id)}
                />
                {member.nickname ?? t`Player`}
                {member.id === club.ownerId && (
                  <span className="text-xs text-gray-400">
                    <Trans>(owner)</Trans>
                  </span>
                )}
              </label>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MysteryCreation({
  onCreate,
  sectionClass,
}: {
  onCreate: (name: string, initialClues: string) => Promise<boolean>;
  sectionClass: string;
}) {
  const [name, setName] = useState("");
  const [initialClues, setInitialClues] = useState("");

  return (
    <section className={sectionClass}>
      <h2 className="font-semibold text-secondary">
        <Trans>Create a mystery</Trans>
      </h2>
      <p className="mt-1 text-sm text-gray-300">
        <Trans>Create it here, then select it when you are ready to play.</Trans>
      </p>
      <form
        className="mt-3 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          void (async () => {
            if (await onCreate(name, initialClues)) {
              setName("");
              setInitialClues("");
            }
          })();
        }}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t`Mystery title`}
        />
        <Textarea
          value={initialClues}
          onChange={(event) => setInitialClues(event.target.value)}
          placeholder={t`Add any opening clues, one per line...`}
          className="min-h-20"
        />
        <Button type="submit" disabled={!name.trim()}>
          <Plus className="size-4" /> <Trans>Create mystery</Trans>
        </Button>
      </form>
    </section>
  );
}

function ClueList({
  title,
  clues,
  text,
  onTextChange,
  onAdd,
  onCheck,
  isGameMaster,
  placeholder,
  voidClues = false,
}: {
  title: string;
  clues: Array<{ id: string; text: string; checked: boolean }>;
  text: string;
  onTextChange: (value: string) => void;
  onAdd: () => void;
  onCheck: (id: string, checked: boolean) => void;
  isGameMaster: boolean;
  placeholder: string;
  voidClues?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${voidClues ? "border-purple-500/35 bg-purple-950/15" : "border-secondary/25 bg-gray-900/45"}`}
    >
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 space-y-2">
        {clues.map((clue) => (
          <label
            key={clue.id}
            className={`flex items-start gap-2 rounded-md p-2 text-sm ${clue.checked ? "bg-secondary/15" : "bg-gray-950/35"}`}
          >
            <Checkbox
              className="mt-0.5"
              checked={clue.checked}
              disabled={!isGameMaster}
              onCheckedChange={(checked) => void onCheck(clue.id, checked === true)}
            />
            <span className={clue.checked ? "font-medium" : ""}>{clue.text}</span>
          </label>
        ))}
        {clues.length === 0 && (
          <p className="text-sm text-gray-400">
            <Trans>No clues yet.</Trans>
          </p>
        )}
      </div>
      {isGameMaster && (
        <div className="mt-3 flex gap-2">
          <Input
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && text.trim() && onAdd()}
            placeholder={placeholder}
          />
          <Button size="sm" disabled={!text.trim()} onClick={onAdd}>
            <Plus className="size-4" />
            <span className="sr-only">
              <Trans>Add clue</Trans>
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}

function MavenCard({
  character,
  own,
  onOpen,
}: {
  character: CharacterWithOwner;
  own: boolean;
  onOpen: () => void;
}) {
  const data = character.data;
  const activeCrownIndex = data.voidChecks?.lastIndexOf(true) ?? -1;
  const crown = activeCrownIndex >= 0 ? getCrownOfTheVoid()[activeCrownIndex] : null;
  const availableItems = (data.cozyItems ?? []).filter(
    (item: { text: string; checked: boolean }) => item.text?.trim() && !item.checked,
  );
  const usedItems = (data.cozyItems ?? []).filter(
    (item: { text: string; checked: boolean }) => item.text?.trim() && item.checked,
  );
  const conditions = summaryItems(data.conditions);
  const mavenMoves = summaryItems(data.mavenMoves);
  return (
    <article className="flex min-h-72 flex-col rounded-xl bg-gradient-to-br from-gray-800 via-gray-800 to-dark-secondary/70 p-5 shadow-lg">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-secondary">
          {own ? <Trans>Your Maven</Trans> : (character.nickname ?? t`Player`)}
        </p>
        <h3 className="mt-1 !text-2xl leading-none text-tertiary">{characterName(character)}</h3>
        <p className="mt-1 text-xs text-gray-400">
          <Trans>Sheet updated</Trans> {relativeTime(character.updatedAt)} <Trans>ago</Trans>
        </p>
      </div>
      <div className="mt-4 space-y-4">
        <SummaryList title={t`Active conditions`} items={conditions} empty={t`None recorded`} chips />
        <SummaryList title={t`Available Maven Moves`} items={mavenMoves} empty={t`None recorded`} />
        <SummaryBlock
          title={t`Crown of the Void`}
          value={
            crown
              ? `${activeCrownIndex + 1}/${getCrownOfTheVoid().length} ${crown.title}`
              : t`None active`
          }
        />
        <section>
          <p className="text-xs font-bold uppercase tracking-wider text-secondary">
            <Trans>A Cozy Little Place</Trans>
          </p>
          {!availableItems.length && !usedItems.length && (
            <p className="mt-2 text-sm text-gray-400">
              <Trans>No available items</Trans>
            </p>
          )}
          {availableItems.length > 0 && (
            <ItemList
              label={t`Available:`}
              items={availableItems.map((item: { text: string }) => item.text)}
              tone="available"
            />
          )}
          {usedItems.length > 0 && (
            <ItemList
              label={t`Marked:`}
              items={usedItems.map((item: { text: string }) => item.text)}
              tone="marked"
            />
          )}
        </section>
      </div>
      {own && (
        <Button className="mt-6 w-full justify-center" variant="outline" onClick={onOpen}>
          <Trans>Open my sheet</Trans>
        </Button>
      )}
    </article>
  );
}

function SummaryBlock({ title, value }: { title: string; value: string }) {
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-wider text-secondary">{title}</p>
      <p className="mt-2 rounded-md bg-gray-950/35 px-3 py-2 text-sm leading-snug text-gray-200">
        {value}
      </p>
    </section>
  );
}

function SummaryList({
  title,
  items,
  empty,
  chips = false,
}: {
  title: string;
  items: string[];
  empty: string;
  chips?: boolean;
}) {
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-wider text-secondary">{title}</p>
      {items.length ? (
        <ul className={chips ? "mt-2 flex flex-wrap gap-2" : "mt-2 space-y-2"}>
          {items.map((item) => (
            <li
              key={item}
              className={
                chips
                  ? "rounded-full border border-secondary/35 bg-secondary/10 px-2.5 py-1 text-xs text-gray-100"
                  : "flex gap-2 rounded-md bg-gray-950/35 px-3 py-2 text-sm leading-snug text-gray-200 before:mt-1.5 before:size-1.5 before:shrink-0 before:rounded-full before:bg-secondary before:content-['']"
              }
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-gray-400">{empty}</p>
      )}
    </section>
  );
}

function ItemList({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "available" | "marked";
}) {
  const styles =
    tone === "available"
      ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-100 before:bg-emerald-300"
      : "border-gray-600 bg-gray-950/25 text-gray-300 before:bg-gray-500";

  return (
    <div className="mt-2">
      <p className={tone === "available" ? "text-xs font-semibold text-emerald-300" : "text-xs font-semibold text-gray-400"}>
        {label}
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className={`flex gap-2 rounded-md border px-2.5 py-2 text-sm leading-snug before:mt-1.5 before:size-1.5 before:shrink-0 before:rounded-full before:content-[''] ${styles}`}
          >
            {item}
          </li>
        ))}
      </ul>
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
