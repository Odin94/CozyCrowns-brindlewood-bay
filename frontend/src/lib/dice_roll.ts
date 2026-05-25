export type RollMode = "normal" | "advantage" | "disadvantage";

export type DiceRollRequest = {
  id: number;
  abilityName: string;
  modifier: number;
  mode: RollMode;
  dice: readonly [number, number] | readonly [number, number, number];
  removedDieIndex: number | null;
  total: number;
};

const randomValues = new Uint32Array(1);
const maxUnbiasedRandom = Math.floor(0x100000000 / 6) * 6;

const rollD6 = () => {
  do {
    window.crypto.getRandomValues(randomValues);
  } while (randomValues[0] >= maxUnbiasedRandom);

  return (randomValues[0] % 6) + 1;
};

const getRemovedDieIndex = (dice: readonly number[], mode: RollMode) => {
  if (mode === "normal") {
    return null;
  }

  const targetValue = mode === "advantage" ? Math.min(...dice) : Math.max(...dice);
  return dice.findIndex((die) => die === targetValue);
};

export const createDiceRoll = ({
  abilityName,
  id,
  mode,
  modifier,
}: {
  abilityName: string;
  id: number;
  mode: RollMode;
  modifier: number;
}): DiceRollRequest => {
  const dice =
    mode === "normal" ? ([rollD6(), rollD6()] as const) : ([rollD6(), rollD6(), rollD6()] as const);
  const removedDieIndex = getRemovedDieIndex(dice, mode);
  const total =
    dice.reduce((sum, die, dieIndex) => {
      if (dieIndex === removedDieIndex) {
        return sum;
      }

      return sum + die;
    }, 0) + modifier;

  return {
    id,
    abilityName,
    modifier,
    mode,
    dice,
    removedDieIndex,
    total,
  };
};
