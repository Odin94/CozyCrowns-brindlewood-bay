import { Button } from "@/components/ui/button";
import DiceRoller from "@/components/character/DiceRoller";
import { Label } from "@/components/ui/label";
import { PressTooltip } from "@/components/ui/tooltip";
import { PlusIcon, MinusIcon } from "lucide-react";
import { createDiceRoll, type DiceRollRequest, type RollMode } from "@/lib/dice_roll";
import { getDefaultAbilities, useCharacterStore } from "@/lib/character_store";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

const ROLL_MENU_WIDTH = 224;
const ROLL_MENU_HEIGHT = 40;
const VIEWPORT_MARGIN = 12;

type RollMenuState = {
  abilityName: string;
  index: number;
  x: number;
  y: number;
};

const abilityDescriptions = [
  t`Physical grit, stamina, athletic feats, and raw strength.`,
  t`Steady nerves, fine control, focus, and keeping fear at bay.`,
  t`Research, deduction, observation, and putting clues together.`,
  t`Charm, confidence, intimidation, and holding the room.`,
  t`Instincts for the strange, spiritual, and occult forces at work.`,
];

type RollMenuProps = {
  menu: RollMenuState;
  onClose: () => void;
  onRoll: (index: number, abilityName: string, mode: RollMode) => void;
};

const RollMenu = ({ menu, onClose, onRoll }: RollMenuProps) => {
  const normalRollRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    normalRollRef.current?.focus();
  }, []);

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default"
        aria-label="Close dice roll menu"
        onClick={onClose}
      />
      <div
        id="ability-roll-menu"
        className="fixed z-50 flex -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md border border-secondary/50 bg-gray-900 shadow-xl shadow-gray-950/40"
        style={{ left: menu.x, top: menu.y }}
        role="menu"
        aria-label={`${menu.abilityName} dice roll options`}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <button
          type="button"
          className="no-ring min-w-20 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:bg-gray-800 hover:text-secondary"
          onClick={() => onRoll(menu.index, menu.abilityName, "disadvantage")}
          role="menuitem"
        >
          <Trans>Disadvantage</Trans>
        </button>
        <button
          ref={normalRollRef}
          type="button"
          className="no-ring min-w-16 border-x border-secondary/30 px-3 py-2 text-xs font-semibold text-secondary transition-colors hover:bg-gray-800"
          onClick={() => onRoll(menu.index, menu.abilityName, "normal")}
          role="menuitem"
        >
          <Trans>Roll</Trans>
        </button>
        <button
          type="button"
          className="no-ring min-w-20 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:bg-gray-800 hover:text-secondary"
          onClick={() => onRoll(menu.index, menu.abilityName, "advantage")}
          role="menuitem"
        >
          <Trans>Advantage</Trans>
        </button>
      </div>
    </>,
    document.body,
  );
};

const Abilities = () => {
  const { abilities, setAbilities } = useCharacterStore();
  const [roll, setRoll] = useState<DiceRollRequest | null>(null);
  const [rollMenu, setRollMenu] = useState<RollMenuState | null>(null);
  const rollId = useRef(0);
  const rollMenuTrigger = useRef<HTMLButtonElement | null>(null);

  const handleAbilityChange = (index: number, value: number) => {
    const newAbilities = [...abilities];
    newAbilities[index].value = Math.max(-3, Math.min(3, value));
    setAbilities(newAbilities);
  };

  const handleRollMenuOpen = (
    event: MouseEvent<HTMLButtonElement>,
    index: number,
    abilityName: string,
  ) => {
    const triggerBounds = event.currentTarget.getBoundingClientRect();
    const viewportCenterX = window.innerWidth / 2;
    const minimumX = Math.min(ROLL_MENU_WIDTH / 2 + VIEWPORT_MARGIN, viewportCenterX);
    const maximumX = Math.max(minimumX, window.innerWidth - ROLL_MENU_WIDTH / 2 - VIEWPORT_MARGIN);
    const minimumY = Math.min(ROLL_MENU_HEIGHT / 2 + VIEWPORT_MARGIN, window.innerHeight / 2);
    const maximumY = Math.max(
      minimumY,
      window.innerHeight - ROLL_MENU_HEIGHT / 2 - VIEWPORT_MARGIN,
    );

    rollMenuTrigger.current = event.currentTarget;
    setRollMenu({
      abilityName,
      index,
      x: Math.min(Math.max(triggerBounds.left + triggerBounds.width / 2, minimumX), maximumX),
      y: Math.min(Math.max(triggerBounds.top + triggerBounds.height / 2, minimumY), maximumY),
    });
  };

  const handleRollMenuClose = () => {
    setRollMenu(null);
    window.requestAnimationFrame(() => rollMenuTrigger.current?.focus());
  };

  const handleAbilityRoll = (index: number, abilityName: string, mode: RollMode) => {
    const modifier = abilities[index]?.value ?? 0;
    rollId.current += 1;
    setRoll(createDiceRoll({ abilityName, id: rollId.current, modifier, mode }));
    setRollMenu(null);
  };

  return (
    <div className="relative space-y-3">
      <Label className="text-lg font-semibold text-secondary">
        <Trans>Abilities</Trans>
      </Label>
      <div className="space-y-2">
        {getDefaultAbilities().map(({ name: abilityName }, index) => {
          const ability = abilities[index];
          return (
            <div key={abilityName} className="flex min-h-8 items-center justify-between gap-3">
              <PressTooltip content={abilityDescriptions[index]} side="right">
                <button
                  type="button"
                  onClick={(event) => handleRollMenuOpen(event, index, abilityName)}
                  className="no-ring min-h-8 flex-1 rounded-md px-1 text-left text-sm text-gray-300 transition-colors hover:bg-gray-700/45 hover:text-secondary focus-visible:bg-gray-700/45 focus-visible:text-secondary"
                  aria-label={`Roll ${abilityName} ability score. Long press for a description.`}
                  aria-haspopup="menu"
                  aria-controls="ability-roll-menu"
                  aria-expanded={rollMenu?.index === index}
                >
                  {abilityName}
                </button>
              </PressTooltip>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAbilityChange(index, ability.value - 1)}
                  disabled={ability.value <= -3}
                  className="w-7 h-7 p-0 hover:text-tertiary hover:border-tertiary"
                  aria-label={`Decrease ${abilityName} ability score`}
                >
                  <MinusIcon className="w-3 h-3" />
                </Button>
                <PressTooltip content={abilityDescriptions[index]} side="top">
                  <button
                    type="button"
                    onClick={(event) => handleRollMenuOpen(event, index, abilityName)}
                    className="no-ring min-h-8 w-8 rounded-md border border-transparent text-center font-medium text-gray-200 transition-colors hover:border-secondary/60 hover:bg-gray-900 focus-visible:border-secondary/70"
                    aria-label={`Roll ${abilityName} ability score. Long press for a description.`}
                    aria-haspopup="menu"
                    aria-controls="ability-roll-menu"
                    aria-expanded={rollMenu?.index === index}
                  >
                    {ability.value > 0 ? `+${ability.value}` : ability.value}
                  </button>
                </PressTooltip>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAbilityChange(index, ability.value + 1)}
                  disabled={ability.value >= 3}
                  className="w-7 h-7 p-0 hover:text-tertiary hover:border-tertiary"
                  aria-label={`Increase ${ability.name} ability score`}
                >
                  <PlusIcon className="w-3 h-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {rollMenu && (
        <RollMenu menu={rollMenu} onClose={handleRollMenuClose} onRoll={handleAbilityRoll} />
      )}
      <DiceRoller roll={roll} />
    </div>
  );
};

export default Abilities;
