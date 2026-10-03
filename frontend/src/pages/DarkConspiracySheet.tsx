import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DarkConspiracyDataSchema } from "@/types/darkConspiracySchema";
import {
  getDefaultDarkConspiracyData,
  useDarkConspiracyStore,
  type DarkConspiracyData,
  type MysteryRecord,
} from "@/lib/dark_conspiracy_store";
import { ChevronLeft, Download, Upload } from "lucide-react";
import type React from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { toast } from "sonner";

const layerTwoHistory = [
  "In the summer of 1877, the crew of the whaler Deep Reaver returned with a whale that had tentacle-like legs and rows of oily, black eyes.",
  "In the spring of 1942, wreckage from a Nazi U-boat washed ashore at Brindlewood Bay, torn apart and marked with strange occult symbols.",
  "In 1967, a hippie commune outside town was blamed after George Maplethorpe went missing. The commune burned, and George was never found.",
  "In the fall of 1992, anti-government separatists called the Sons of Freedom had a six-day standoff filled with bizarre phenomena.",
  "New Year's Eve, 2011: Brindlewood Bay drew doomsday prophets for an End of All Things party. A few revelers remained.",
];

const layerThreeReveals = [
  'The Mavens hear the words "The Midwives of the Fragrant Void" for the first time.',
  "The leader of the Midwives makes themselves known to the Murder Mavens.",
  "The Murder Mavens stumble onto direct, physical evidence of the existence of the cult.",
  "A character the Mavens believed was an ally or friend is revealed to be a member of the Midwives.",
];

const mysteryKeys = ["first", "second", "third", "fourth", "fifth", "sixth"];

const exportDarkConspiracy = (data: DarkConspiracyData) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "CozyCrowns_Dark_Conspiracy.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

type TextField = {
  [K in keyof DarkConspiracyData]-?: DarkConspiracyData[K] extends string ? K : never;
}[keyof DarkConspiracyData];
const KeeperTextarea = ({
  field,
  minRows = 3,
  label,
}: {
  field: TextField;
  minRows?: number;
  label: string;
}) => {
  const value = useDarkConspiracyStore((state) => state.current[field]);
  const update = useDarkConspiracyStore((state) => state.updateCurrentDarkConspiracy);
  return (
    <Textarea
      aria-label={label}
      value={value}
      onChange={(event) => update({ [field]: event.target.value })}
      className="keeper-input min-h-0 resize-none text-[0.7rem] leading-tight text-foreground no-ring focus-visible:ring-0"
      style={{ height: `${minRows * 1.6}rem` }}
    />
  );
};

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="keeper-field-label">{children}</p>
);

const CheckedParagraph = ({
  field,
  index,
  children,
}: {
  field: "layerTwoChecks" | "layerThreeChecks";
  index: number;
  children: React.ReactNode;
}) => {
  const checked = useDarkConspiracyStore((state) => state.current[field][index] ?? false);
  return (
    <label className="grid grid-cols-[1rem_1fr] gap-2 text-[0.62rem] leading-[1.05] text-foreground">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => {
          const state = useDarkConspiracyStore.getState();
          const checks = [...state.current[field]];
          checks[index] = value === true;
          state.updateCurrentDarkConspiracy({ [field]: checks });
        }}
        className="mt-0.5 size-3 border-dark-secondary bg-transparent data-[state=checked]:bg-primary"
      />
      <span>{children}</span>
    </label>
  );
};

const MysteryTracker = () => {
  const mysteries = useDarkConspiracyStore((state) => state.current.mysteries);
  const update = useDarkConspiracyStore((state) => state.updateCurrentDarkConspiracy);
  const updateMystery = (index: number, updates: Partial<MysteryRecord>) => {
    const nextMysteries = [...mysteries];
    nextMysteries[index] = { ...nextMysteries[index], ...updates };
    update({ mysteries: nextMysteries });
  };

  return (
    <section className="space-y-2">
      <h3 className="dark-conspiracy-section-title">Mystery Tracker</h3>
      {mysteries.map((mystery, index) => (
        <div
          key={mysteryKeys[index] ?? mystery.name}
          className={
            index < mysteries.length - 1
              ? "space-y-1 border-b border-dark-secondary/25 pb-2"
              : "space-y-1"
          }
        >
          <label className="text-[0.62rem] font-semibold leading-none text-dark-secondary">
            Mystery Name:
            <input
              value={mystery.name}
              onChange={(event) => updateMystery(index, { name: event.target.value })}
              className="keeper-inline-input ml-1 w-[calc(100%-5.4rem)] text-[0.65rem] no-ring focus:outline-none focus-visible:outline-none"
            />
          </label>
          <label className="block text-[0.62rem] font-semibold leading-none text-dark-secondary">
            Resolution:
            <Textarea
              value={mystery.resolution}
              onChange={(event) => updateMystery(index, { resolution: event.target.value })}
              className="keeper-input mt-1 h-10 min-h-0 resize-none text-[0.65rem] leading-tight no-ring"
            />
          </label>
        </div>
      ))}
    </section>
  );
};

const DarkConspiracySheet = ({
  onBackToCharacterSheet,
}: {
  onBackToCharacterSheet: () => void;
}) => {
  const replaceCurrentDarkConspiracy = useDarkConspiracyStore(
    (state) => state.replaceCurrentDarkConspiracy,
  );

  const importFile = async (file: File) => {
    const original = JSON.stringify(useDarkConspiracyStore.getState().current);
    try {
      const rawData: unknown = JSON.parse(await file.text());
      const result = DarkConspiracyDataSchema.safeParse(rawData);
      if (!result.success) {
        toast.error(t`Invalid dark conspiracy save file.`);
        return;
      }
      if (JSON.stringify(useDarkConspiracyStore.getState().current) !== original) {
        toast.error(t`Your sheet changed while the file was opening. Load the file again.`);
        return;
      }
      replaceCurrentDarkConspiracy({
        ...getDefaultDarkConspiracyData(),
        ...result.data,
        id: undefined,
        version: undefined,
      });
      toast.success(t`Dark conspiracy loaded.`);
    } catch {
      toast.error(t`Invalid JSON file format.`);
    }
  };
  const handleUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) void importFile(file);
    });
    input.click();
  };

  return (
    <div
      className="dark-conspiracy-sheet"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(event) => {
        const file = event.dataTransfer.files[0];
        if (file) {
          event.preventDefault();
          void importFile(file);
        }
      }}
      onPaste={(event) => {
        if ((event.target as HTMLElement).closest("input,textarea")) return;
        const file = event.clipboardData.files[0];
        if (file) {
          event.preventDefault();
          void importFile(file);
        }
      }}
    >
      <div className="dark-conspiracy-actions">
        <Button onClick={onBackToCharacterSheet} variant="dark" className="h-8 dark-ring">
          <ChevronLeft className="size-4" />
          <Trans>Back to sheet</Trans>
        </Button>
        <div className="flex gap-2">
          <Button
            onClick={() => exportDarkConspiracy(useDarkConspiracyStore.getState().current)}
            variant="dark"
            className="h-8 dark-ring"
          >
            <Download className="mr-2 size-4" />
            <Trans>Save JSON</Trans>
          </Button>
          <Button onClick={handleUpload} variant="dark" className="h-8 dark-ring">
            <Upload className="mr-2 size-4" />
            <Trans>Load JSON</Trans>
          </Button>
        </div>
      </div>

      <article className="dark-conspiracy-page dark-conspiracy-page--overview">
        <header className="dark-conspiracy-header">
          <p>BRINDLEWOOD BAY</p>
          <h2>The Dark Conspiracy</h2>
          <p>
            Use this sheet to track the history, motivations, and actions of the Midwives of the
            Fragrant Void.
          </p>
        </header>

        <div className="grid flex-1 grid-cols-3 gap-5">
          <section>
            <h3 className="dark-conspiracy-section-title">The First Void Clue...</h3>
            <p className="dark-conspiracy-copy">
              ...is always the Midwives' first appearance in the story. It should be brief, and you
              should emphasize their smooth white masks.
            </p>
            <KeeperTextarea label="First Void Clue" field="firstVoidClue" minRows={3} />

            <h3 className="dark-conspiracy-section-title mt-4">Layer One: The Midwives Scene</h3>
            <p className="dark-conspiracy-copy">
              This layer is unlocked after the Mavens discover the FIRST Void Clue. At session end,
              show hooded figures chanting on a moonlit beach as a shadow rises from the ocean.
            </p>
            <FieldLabel>What will the Child of Persephone do when summoned?</FieldLabel>
            <KeeperTextarea label="Child of Persephone" field="childOfPersephone" minRows={5} />
            <FieldLabel>Characters connected to the Dark Conspiracy</FieldLabel>
            <KeeperTextarea
              label="Connected characters layer one"
              field="connectedCharactersLayerOne"
              minRows={4}
            />
          </section>

          <section className="col-span-2">
            <h3 className="dark-conspiracy-section-title">
              Layer Two: The History of Brindlewood Bay
            </h3>
            <p className="dark-conspiracy-copy">
              This layer is unlocked after THREE Void Clues. Reveal these details as a 12+ on the
              Meddling Move, or as a Keeper reaction: Reveal the town history.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-2">
              {layerTwoHistory.map((history, index) => (
                <CheckedParagraph key={history} field="layerTwoChecks" index={index}>
                  {history}
                </CheckedParagraph>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>Returning character for the Void Mystery</FieldLabel>
                <KeeperTextarea
                  label="Returning character"
                  field="returningCharacter"
                  minRows={3}
                />
              </div>
              <div>
                <FieldLabel>Revise the Child of Persephone and the Midwives' motive</FieldLabel>
                <KeeperTextarea
                  label="Layer two child revision"
                  field="childRevisionLayerTwo"
                  minRows={3}
                />
              </div>
            </div>
            <FieldLabel>New characters connected to the Dark Conspiracy</FieldLabel>
            <KeeperTextarea
              label="Connected characters layer two"
              field="connectedCharactersLayerTwo"
              minRows={4}
            />
          </section>
        </div>
      </article>

      <article className="dark-conspiracy-page dark-conspiracy-page--layers">
        <header className="dark-conspiracy-header">
          <p>BRINDLEWOOD BAY</p>
          <h2>The Dark Conspiracy</h2>
        </header>
        <div className="grid flex-1 grid-cols-2 gap-5">
          <section>
            <h3 className="dark-conspiracy-section-title">
              Layer Three: The Existence of the Midwives of the Fragrant Void
            </h3>
            <p className="dark-conspiracy-copy">
              This layer is unlocked after FIVE Void Clues. Reveal these details, in order, as a 12+
              on The Meddling Move, or as a Keeper reaction: Reveal the Midwives.
            </p>
            <div className="mt-2 space-y-2">
              {layerThreeReveals.map((reveal, index) => (
                <CheckedParagraph key={reveal} field="layerThreeChecks" index={index}>
                  {reveal}
                </CheckedParagraph>
              ))}
            </div>
            <FieldLabel>Leader of the Midwives</FieldLabel>
            <KeeperTextarea
              label="Leader of the Midwives"
              field="leaderOfTheMidwives"
              minRows={2}
            />
            <FieldLabel>Revise what the Midwives are trying to accomplish</FieldLabel>
            <KeeperTextarea
              label="Midwives goal revision"
              field="midwivesGoalRevision"
              minRows={5}
            />
            <FieldLabel>New characters connected to the Dark Conspiracy</FieldLabel>
            <KeeperTextarea
              label="Connected characters layer three"
              field="connectedCharactersLayerThree"
              minRows={4}
            />
          </section>

          <section>
            <h3 className="dark-conspiracy-section-title">
              Layer Four: Direct Action Against the Murder Mavens
            </h3>
            <p className="dark-conspiracy-copy">
              This layer is unlocked after TEN Void Clues. The Midwives can now take direct action
              with Magic of the Midwives.
            </p>
            <h4 className="dark-conspiracy-subtitle">Sendings</h4>
            <p className="dark-conspiracy-copy">
              Cut away to the Midwives performing a ritual, then cut to the calamitous effects of
              their sorcery.
            </p>
            <h4 className="dark-conspiracy-subtitle">Servitors</h4>
            <p className="dark-conspiracy-copy">
              What do these creatures look like? What powers do they have? How can they be stopped?
            </p>
            <KeeperTextarea label="Servitors" field="servitors" minRows={5} />
            <FieldLabel>
              Final revision of the Child of Persephone and the Midwives' plan
            </FieldLabel>
            <KeeperTextarea label="Final child revision" field="finalChildRevision" minRows={4} />
          </section>
        </div>
      </article>

      <article className="dark-conspiracy-page dark-conspiracy-page--mysteries">
        <header className="dark-conspiracy-header">
          <p>BRINDLEWOOD BAY</p>
          <h2>The Dark Conspiracy</h2>
        </header>
        <div className="grid flex-1 grid-cols-[0.85fr_1.15fr] gap-5">
          <section>
            <h3 className="dark-conspiracy-section-title">Layer Five: The Void Mystery</h3>
            <p className="dark-conspiracy-copy">
              This layer is unlocked after FIFTEEN Void Clues. Create the Void Mystery and present
              it once the current mystery is resolved.
            </p>
          </section>

          <MysteryTracker />
        </div>
      </article>
    </div>
  );
};

export default DarkConspiracySheet;
