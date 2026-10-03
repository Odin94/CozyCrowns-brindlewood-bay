import { lazy, Suspense, useEffect, useState } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useAuth } from "@/hooks/useAuth";
import { api, type BookClubCharacter } from "@/utils/api";
import { useCharacterStore } from "@/lib/character_store";
import { normalizeCharacter } from "@/lib/character_document";
import {
  getAdvancementOptions,
  getEndOfSessionQuestions,
  getCrownsOfTheQueen,
  getCrownOfTheVoid,
} from "@/game_data";
import { Button } from "@/components/ui/button";
const CharacterSheet = lazy(() => import("./CharacterSheet"));

export default function BookClubMaven({
  clubId,
  characterId,
  onBack,
  onGoToSheet,
  onGoToDarkConspiracy,
}: {
  clubId: string;
  characterId: string;
  onBack: () => void;
  onGoToSheet: () => void;
  onGoToDarkConspiracy: () => void;
}) {
  const { user } = useAuth();
  const [result, setResult] = useState<{
    character: BookClubCharacter;
    own: boolean;
    clubName: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError("");
    void api
      .getBookClubs()
      .then(async ({ clubs }) => {
        const club = clubs.find((entry) => entry.id === clubId);
        const member = club?.members.find((entry) =>
          entry.characters.some((character) => character.id === characterId),
        );
        const character = member?.characters.find((entry) => entry.id === characterId);
        if (!club || !member || !character)
          throw new Error(t`This Maven is no longer available in this Book Club.`);
        const own = member.id === user?.id;
        if (own) {
          if (!useCharacterStore.getState().characters.some((entry) => entry.id === characterId)) {
            const response = await api.getCharacters();
            if (cancelled) return;
            useCharacterStore
              .getState()
              .mergeRemote(response.characters.filter((entry) => entry.owned));
          }
          if (cancelled) return;
          const index = useCharacterStore
            .getState()
            .characters.findIndex((entry) => entry.id === characterId);
          if (index < 0) throw new Error(t`Your Maven is still syncing. Try again in a moment.`);
          useCharacterStore.getState().setCurrentCharacter(index);
        }
        if (!cancelled) setResult({ character, own, clubName: club.name });
      })
      .catch((loadError: unknown) => {
        if (!cancelled)
          setError(loadError instanceof Error ? loadError.message : t`Could not load Book Clubs`);
      });
    return () => {
      cancelled = true;
    };
  }, [clubId, characterId, user?.id, attempt]);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-800 px-5 py-3 text-secondary">
        <p>
          {result
            ? result.own
              ? result.clubName
              : t`Viewing ${result.character.name || t`Unnamed Maven`} · Read only`
            : t`Book Club`}
        </p>
        <Button variant="dark" onClick={onBack}>
          <Trans>Back to Book Club</Trans>
        </Button>
      </div>
      {error ? (
        <div className="p-6" role="alert">
          <p>{error}</p>
          <Button onClick={() => setAttempt((value) => value + 1)}>
            <Trans>Try again</Trans>
          </Button>
        </div>
      ) : !result ? (
        <p className="p-6" role="status">
          <Trans>Loading…</Trans>
        </p>
      ) : result.own ? (
        <Suspense fallback={null}>
          <CharacterSheet
            onBookClubsClick={onBack}
            onSwitchToCharacter={onGoToSheet}
            onSwitchToDarkConspiracy={onGoToDarkConspiracy}
          />
        </Suspense>
      ) : (
        <ReadOnlySheet character={result.character} />
      )}
    </>
  );
}

function ReadOnlySheet({ character }: { character: BookClubCharacter }) {
  const data = normalizeCharacter(character.data);
  const sections = [
    { title: t`Style`, text: data.style },
    { title: t`Cozy Activity`, text: data.activity },
    {
      title: t`Abilities`,
      text: data.abilities
        .map(({ name, value }) => `${name}: ${value > 0 ? "+" : ""}${value}`)
        .join("\n"),
    },
    { title: t`XP`, text: String(data.xp) },
    { title: t`Conditions`, text: data.conditions },
    { title: t`Maven Moves`, text: data.mavenMoves },
    { title: t`End of Session`, text: checks(getEndOfSessionQuestions(), data.endOfSessionChecks) },
    { title: t`Advancements`, text: checks(getAdvancementOptions(), data.advancementChecks) },
    { title: t`Crown of the Queen`, text: checks(getCrownsOfTheQueen(), data.crownChecks) },
    {
      title: t`Crown of the Void`,
      text: checks(
        getCrownOfTheVoid().map(({ title, description }) => `${title} ${description}`),
        data.voidChecks,
      ),
    },
    {
      title: t`A Cozy Little Place`,
      text: data.cozyItems
        .filter(({ text }) => text.trim())
        .map(({ text, checked }) => `${checked ? "☑" : "☐"} ${text}`)
        .join("\n"),
    },
  ];
  return (
    <main className="mx-auto max-w-7xl p-5 pb-24">
      <h1 className="mb-6 text-center text-3xl">{character.name || t`Unnamed Maven`}</h1>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {sections.map(({ title, text }) => (
          <section key={title} className="rounded-lg bg-gray-800 p-5 text-gray-200">
            <h2 className="mb-3 text-xl text-secondary">{title}</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {text || t`None recorded`}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
function checks(labels: string[], values: boolean[]) {
  return labels.map((label, index) => `${values[index] ? "☑" : "☐"} ${label}`).join("\n\n");
}
