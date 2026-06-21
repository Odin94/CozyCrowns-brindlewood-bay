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
import { Download, Upload } from "lucide-react";
import type React from "react";
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

const KeeperTextarea = ({
  value,
  onChange,
  minRows = 3,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
  label: string;
}) => (
  <Textarea
    aria-label={label}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className="min-h-0 resize-none rounded-none border-0 border-b border-dark-secondary/45 bg-transparent px-0 py-1 text-[0.7rem] leading-tight text-foreground no-ring focus-visible:ring-0"
    style={{ height: `${minRows * 1.6}rem` }}
  />
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 text-[0.7rem] font-semibold leading-tight text-dark-secondary">{children}</p>
);

const CheckedParagraph = ({
  checked,
  onCheckedChange,
  children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: React.ReactNode;
}) => (
  <label className="grid grid-cols-[1rem_1fr] gap-2 text-[0.62rem] leading-[1.05] text-foreground">
    <Checkbox
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      className="mt-0.5 size-3 border-dark-secondary bg-transparent data-[state=checked]:bg-primary"
    />
    <span>{children}</span>
  </label>
);

const MysteryTracker = ({
  mysteries,
  onChange,
}: {
  mysteries: MysteryRecord[];
  onChange: (mysteries: MysteryRecord[]) => void;
}) => {
  const updateMystery = (index: number, updates: Partial<MysteryRecord>) => {
    const nextMysteries = [...mysteries];
    nextMysteries[index] = { ...nextMysteries[index], ...updates };
    onChange(nextMysteries);
  };

  return (
    <section className="space-y-2">
      <h3 className="dark-conspiracy-section-title">Mystery Tracker</h3>
      {mysteries.map((mystery, index) => (
        <div
          key={mysteryKeys[index] ?? mystery.name}
          className="space-y-1 border-b border-dark-secondary/25 pb-2"
        >
          <label className="text-[0.62rem] font-semibold leading-none text-dark-secondary">
            Mystery Name:
            <input
              value={mystery.name}
              onChange={(event) => updateMystery(index, { name: event.target.value })}
              className="ml-1 w-[calc(100%-5.4rem)] border-0 border-b border-dark-secondary/45 bg-transparent text-[0.65rem] no-ring focus:outline-none focus-visible:outline-none"
            />
          </label>
          <label className="block text-[0.62rem] font-semibold leading-none text-dark-secondary">
            Resolution:
            <Textarea
              value={mystery.resolution}
              onChange={(event) => updateMystery(index, { resolution: event.target.value })}
              className="mt-1 h-10 min-h-0 resize-none rounded-none border-0 border-b border-dark-secondary/35 bg-transparent p-0 text-[0.65rem] leading-tight no-ring"
            />
          </label>
        </div>
      ))}
    </section>
  );
};

const DarkConspiracySheet = () => {
  const current = useDarkConspiracyStore((state) => state.current);
  const update = useDarkConspiracyStore((state) => state.updateCurrentDarkConspiracy);
  const replaceCurrentDarkConspiracy = useDarkConspiracyStore(
    (state) => state.replaceCurrentDarkConspiracy,
  );

  const updateLayerTwoCheck = (index: number, checked: boolean) => {
    const layerTwoChecks = [...current.layerTwoChecks];
    layerTwoChecks[index] = checked;
    update({ layerTwoChecks });
  };

  const updateLayerThreeCheck = (index: number, checked: boolean) => {
    const layerThreeChecks = [...current.layerThreeChecks];
    layerThreeChecks[index] = checked;
    update({ layerThreeChecks });
  };

  const handleUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.addEventListener("change", (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.addEventListener("load", (readerEvent) => {
        try {
          const rawData = JSON.parse(readerEvent.target?.result as string);
          const result = DarkConspiracyDataSchema.safeParse(rawData);
          if (!result.success) {
            toast.error("Invalid dark conspiracy save file.");
            return;
          }

          replaceCurrentDarkConspiracy({
            ...getDefaultDarkConspiracyData(),
            ...result.data,
            id: undefined,
            version: undefined,
          });
          toast.success("Dark conspiracy loaded.");
        } catch {
          toast.error("Invalid JSON file format.");
        }
      });
      reader.readAsText(file);
    });
    input.click();
  };

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Button
          onClick={() => exportDarkConspiracy(current)}
          className="h-8 bg-dark-secondary text-primary hover:bg-dark-secondary/90 dark-ring"
        >
          <Download className="mr-2 size-4" />
          Save JSON
        </Button>
        <Button
          onClick={handleUpload}
          className="h-8 bg-dark-secondary text-primary hover:bg-dark-secondary/90 dark-ring"
        >
          <Upload className="mr-2 size-4" />
          Load JSON
        </Button>
      </div>

      <article className="dark-conspiracy-page">
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
            <KeeperTextarea
              label="First Void Clue"
              value={current.firstVoidClue}
              onChange={(firstVoidClue) => update({ firstVoidClue })}
              minRows={3}
            />

            <h3 className="dark-conspiracy-section-title mt-4">Layer One: The Midwives Scene</h3>
            <p className="dark-conspiracy-copy">
              This layer is unlocked after the Mavens discover the FIRST Void Clue. At session end,
              show hooded figures chanting on a moonlit beach as a shadow rises from the ocean.
            </p>
            <FieldLabel>What will the Child of Persephone do when summoned?</FieldLabel>
            <KeeperTextarea
              label="Child of Persephone"
              value={current.childOfPersephone}
              onChange={(childOfPersephone) => update({ childOfPersephone })}
              minRows={5}
            />
            <FieldLabel>Characters connected to the Dark Conspiracy</FieldLabel>
            <KeeperTextarea
              label="Connected characters layer one"
              value={current.connectedCharactersLayerOne}
              onChange={(connectedCharactersLayerOne) => update({ connectedCharactersLayerOne })}
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
                <CheckedParagraph
                  key={history}
                  checked={current.layerTwoChecks[index] ?? false}
                  onCheckedChange={(checked) => updateLayerTwoCheck(index, checked)}
                >
                  {history}
                </CheckedParagraph>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>Returning character for the Void Mystery</FieldLabel>
                <KeeperTextarea
                  label="Returning character"
                  value={current.returningCharacter}
                  onChange={(returningCharacter) => update({ returningCharacter })}
                  minRows={3}
                />
              </div>
              <div>
                <FieldLabel>Revise the Child of Persephone and the Midwives' motive</FieldLabel>
                <KeeperTextarea
                  label="Layer two child revision"
                  value={current.childRevisionLayerTwo}
                  onChange={(childRevisionLayerTwo) => update({ childRevisionLayerTwo })}
                  minRows={3}
                />
              </div>
            </div>
            <FieldLabel>New characters connected to the Dark Conspiracy</FieldLabel>
            <KeeperTextarea
              label="Connected characters layer two"
              value={current.connectedCharactersLayerTwo}
              onChange={(connectedCharactersLayerTwo) => update({ connectedCharactersLayerTwo })}
              minRows={3}
            />
          </section>
        </div>
      </article>

      <article className="dark-conspiracy-page">
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
                <CheckedParagraph
                  key={reveal}
                  checked={current.layerThreeChecks[index] ?? false}
                  onCheckedChange={(checked) => updateLayerThreeCheck(index, checked)}
                >
                  {reveal}
                </CheckedParagraph>
              ))}
            </div>
            <FieldLabel>Leader of the Midwives</FieldLabel>
            <KeeperTextarea
              label="Leader of the Midwives"
              value={current.leaderOfTheMidwives}
              onChange={(leaderOfTheMidwives) => update({ leaderOfTheMidwives })}
              minRows={2}
            />
            <FieldLabel>Revise what the Midwives are trying to accomplish</FieldLabel>
            <KeeperTextarea
              label="Midwives goal revision"
              value={current.midwivesGoalRevision}
              onChange={(midwivesGoalRevision) => update({ midwivesGoalRevision })}
              minRows={5}
            />
            <FieldLabel>New characters connected to the Dark Conspiracy</FieldLabel>
            <KeeperTextarea
              label="Connected characters layer three"
              value={current.connectedCharactersLayerThree}
              onChange={(connectedCharactersLayerThree) =>
                update({ connectedCharactersLayerThree })
              }
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
            <KeeperTextarea
              label="Servitors"
              value={current.servitors}
              onChange={(servitors) => update({ servitors })}
              minRows={5}
            />
            <FieldLabel>
              Final revision of the Child of Persephone and the Midwives' plan
            </FieldLabel>
            <KeeperTextarea
              label="Final child revision"
              value={current.finalChildRevision}
              onChange={(finalChildRevision) => update({ finalChildRevision })}
              minRows={4}
            />
          </section>
        </div>
      </article>

      <article className="dark-conspiracy-page">
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

          <MysteryTracker
            mysteries={current.mysteries}
            onChange={(mysteries) => update({ mysteries })}
          />
        </div>
      </article>
    </div>
  );
};

export default DarkConspiracySheet;
