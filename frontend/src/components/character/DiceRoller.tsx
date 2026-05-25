import type { DiceRollRequest } from "@/lib/dice_roll";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Dices } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type DiceRollerProps = {
  roll: DiceRollRequest | null;
};

type Outcome = {
  label: string;
  className: string;
};

const getOutcome = (total: number): Outcome => {
  if (total <= 6) {
    return {
      label: t`Failure`,
      className: "border-secondary/45 bg-gray-800/80 text-rose-100",
    };
  }

  if (total <= 9) {
    return {
      label: t`Success with cost`,
      className: "border-secondary/45 bg-gray-800/80 text-secondary",
    };
  }

  if (total <= 11) {
    return {
      label: t`Plain success`,
      className: "border-secondary/45 bg-gray-800/80 text-primary",
    };
  }

  return {
    label: t`Success with a bonus`,
    className: "border-secondary/55 bg-gray-800/80 text-tertiary",
  };
};

const getRollLabel = (roll: DiceRollRequest) => {
  if (roll.mode === "normal") {
    return roll.abilityName;
  }

  const modeLabel = roll.mode === "advantage" ? t`advantage` : t`disadvantage`;
  return `${roll.abilityName} - ${modeLabel}`;
};

const facePositions = [
  "dice-face dice-face-front",
  "dice-face dice-face-right",
  "dice-face dice-face-top",
  "dice-face dice-face-bottom",
  "dice-face dice-face-left",
  "dice-face dice-face-back",
];

const dieFaceTransforms: Record<number, string> = {
  1: "rotateX(0deg) rotateY(0deg)",
  2: "rotateX(0deg) rotateY(-90deg)",
  3: "rotateX(-90deg) rotateY(0deg)",
  4: "rotateX(90deg) rotateY(0deg)",
  5: "rotateX(0deg) rotateY(90deg)",
  6: "rotateX(0deg) rotateY(180deg)",
};

const pipPatterns: Record<number, string[]> = {
  1: ["top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"],
  2: ["top-[23%] left-[23%]", "bottom-[23%] right-[23%]"],
  3: [
    "top-[22%] left-[22%]",
    "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
    "bottom-[22%] right-[22%]",
  ],
  4: [
    "top-[22%] left-[22%]",
    "top-[22%] right-[22%]",
    "bottom-[22%] left-[22%]",
    "bottom-[22%] right-[22%]",
  ],
  5: [
    "top-[20%] left-[20%]",
    "top-[20%] right-[20%]",
    "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
    "bottom-[20%] left-[20%]",
    "bottom-[20%] right-[20%]",
  ],
  6: [
    "top-[18%] left-[22%]",
    "top-[18%] right-[22%]",
    "top-1/2 left-[22%] -translate-y-1/2",
    "top-1/2 right-[22%] -translate-y-1/2",
    "bottom-[18%] left-[22%]",
    "bottom-[18%] right-[22%]",
  ],
};

type DiceStyle = CSSProperties & {
  "--final-transform": string;
  "--spin-x": string;
  "--spin-y": string;
  "--spin-z": string;
};

const DieFace = ({ value, className }: { value: number; className: string }) => (
  <div className={className}>
    {pipPatterns[value].map((pipClassName) => (
      <span
        key={pipClassName}
        className={`absolute h-1.5 w-1.5 rounded-full bg-gray-900 shadow-[0_0_0_1px_rgba(255,255,255,0.25)] ${pipClassName}`}
      />
    ))}
  </div>
);

const Die = ({
  isRemoved,
  value,
  rollId,
  index,
}: {
  isRemoved: boolean;
  value: number;
  rollId: number;
  index: number;
}) => {
  const style = useMemo<DiceStyle>(
    () => ({
      "--final-transform": dieFaceTransforms[value],
      "--spin-x": `${720 + ((rollId + index) % 3) * 360}deg`,
      "--spin-y": `${1080 + ((rollId * 2 + index) % 3) * 360}deg`,
      "--spin-z": `${360 + ((rollId + index * 3) % 3) * 360}deg`,
    }),
    [index, rollId, value],
  );

  return (
    <div className="dice-stage" aria-hidden="true">
      <div
        key={`${rollId}-${index}-${value}`}
        className={`dice-cube is-rolling ${isRemoved ? "is-removed" : ""}`}
        style={style}
      >
        {facePositions.map((className, faceIndex) => (
          <DieFace key={className} value={faceIndex + 1} className={className} />
        ))}
      </div>
    </div>
  );
};

const DiceRoller = ({ roll }: DiceRollerProps) => {
  const [isRolling, setIsRolling] = useState(false);
  const [showRemovedDie, setShowRemovedDie] = useState(false);

  useEffect(() => {
    if (!roll) {
      return;
    }

    setIsRolling(true);
    setShowRemovedDie(false);
    const rollingTimeout = window.setTimeout(() => setIsRolling(false), 900);
    const removedDieTimeout = window.setTimeout(() => setShowRemovedDie(true), 900);

    return () => {
      window.clearTimeout(rollingTimeout);
      window.clearTimeout(removedDieTimeout);
    };
  }, [roll]);

  const outcome = roll ? getOutcome(roll.total) : null;
  const resultClassName =
    isRolling || !outcome ? "border-secondary/30 bg-gray-900/80 text-gray-200" : outcome.className;

  return (
    <section className="rounded-md border border-secondary/25 bg-gray-900/55 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-secondary">
          <Dices className="h-4 w-4" />
          <h3 className="text-base font-semibold leading-none">
            <Trans>Dice Roller</Trans>
          </h3>
        </div>
        {roll && <span className="text-xs font-semibold text-gray-300">{getRollLabel(roll)}</span>}
      </div>

      {roll ? (
        <div className="space-y-3">
          <div className="flex min-h-28 items-center justify-center gap-4 overflow-hidden rounded-md border border-secondary/20 bg-gray-950/35 px-4 py-5">
            <Die
              key={`${roll.id}-first`}
              value={roll.dice[0]}
              rollId={roll.id}
              index={0}
              isRemoved={showRemovedDie && roll.removedDieIndex === 0}
            />
            <Die
              key={`${roll.id}-second`}
              value={roll.dice[1]}
              rollId={roll.id}
              index={1}
              isRemoved={showRemovedDie && roll.removedDieIndex === 1}
            />
            {roll.dice.length === 3 && (
              <Die
                key={`${roll.id}-third`}
                value={roll.dice[2]}
                rollId={roll.id}
                index={2}
                isRemoved={showRemovedDie && roll.removedDieIndex === 2}
              />
            )}
          </div>

          {outcome && (
            <div
              className={`rounded-md border p-3 text-center transition-colors duration-300 ${resultClassName}`}
              aria-live="polite"
            >
              {isRolling ? (
                <div className="flex min-h-[3.25rem] items-center justify-center">
                  <span className="dice-loader" aria-label={t`Rolling...`}>
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              ) : (
                <>
                  <p className="text-3xl font-bold leading-tight">{roll.total}</p>
                  <p className="text-sm font-semibold">{outcome.label}</p>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed border-gray-700 bg-gray-950/40 px-4 py-5 text-center text-sm text-gray-300">
          <Trans>Click an ability score to roll 2d6.</Trans>
        </div>
      )}
    </section>
  );
};

export default DiceRoller;
