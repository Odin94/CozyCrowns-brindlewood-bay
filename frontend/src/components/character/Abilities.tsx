import { Button } from "@/components/ui/button";
import DiceRoller from "@/components/character/DiceRoller";
import { Label } from "@/components/ui/label";
import { PlusIcon, MinusIcon } from "lucide-react";
import { createDiceRoll, type DiceRollRequest, type RollMode } from "@/lib/dice_roll";
import { getDefaultAbilities, useCharacterStore } from "@/lib/character_store";
import { Trans } from "@lingui/react/macro";
import { useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

type RollMenuState = {
  abilityName: string;
  index: number;
  x: number;
  y: number;
};

type RollMenuProps = {
  menu: RollMenuState;
  onClose: () => void;
  onRoll: (index: number, abilityName: string, mode: RollMode) => void;
};

const RollMenu = ({ menu, onClose, onRoll }: RollMenuProps) =>
  createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default"
        aria-label="Close dice roll menu"
        onClick={onClose}
      />
      <div
        className="fixed z-50 flex -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md border border-secondary/50 bg-gray-900 shadow-xl shadow-gray-950/40"
        style={{ left: menu.x, top: menu.y }}
        role="menu"
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

const Abilities = () => {
  const { abilities, setAbilities } = useCharacterStore();
  const [roll, setRoll] = useState<DiceRollRequest | null>(null);
  const [rollMenu, setRollMenu] = useState<RollMenuState | null>(null);
  const rollId = useRef(0);

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
    setRollMenu({
      abilityName,
      index,
      x: event.clientX,
      y: event.clientY,
    });
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
            <div key={abilityName} className="flex items-center justify-between">
              <Label className="text-sm text-gray-300 w-20">{abilityName}</Label>
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
                <span className="w-8 text-center font-medium text-gray-200">
                  <button
                    type="button"
                    onClick={(event) => handleRollMenuOpen(event, index, abilityName)}
                    className="no-ring min-h-8 w-full rounded-md border border-transparent text-center transition-colors hover:border-secondary/60 hover:bg-gray-900 focus-visible:border-secondary/70"
                    aria-label={`Roll ${abilityName} ability score`}
                  >
                    {ability.value > 0 ? `+${ability.value}` : ability.value}
                  </button>
                </span>
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
        <RollMenu menu={rollMenu} onClose={() => setRollMenu(null)} onRoll={handleAbilityRoll} />
      )}
      <DiceRoller roll={roll} />
    </div>
  );
};

export default Abilities;
