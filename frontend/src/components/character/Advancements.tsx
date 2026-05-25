import { Checkbox } from "@/components/ui/checkbox";
import Headline from "@/components/ui/headline";
import { Label } from "@/components/ui/label";
import { getAdvancementOptions } from "@/game_data";
import { useCharacterStore } from "@/lib/character_store";
import { Trans } from "@lingui/react/macro";

const Advancements = () => {
  const { advancementChecks, setAdvancementChecks } = useCharacterStore();
  const advancementOptions = getAdvancementOptions().map((option, index) => ({
    id: `advancement-${index}`,
    option,
  }));

  const handleCheckChange = (index: number, checked: boolean) => {
    const newChecks = [...advancementChecks];
    newChecks[index] = checked;
    setAdvancementChecks(newChecks);
  };

  return (
    <div className="space-y-4">
      <Headline>
        <Trans>Advancements</Trans>
      </Headline>
      <div className="space-y-3">
        {advancementOptions.map(({ id, option }, index) => (
          <div key={id} className="flex items-start space-x-3">
            <Checkbox
              id={id}
              checked={advancementChecks[index]}
              onCheckedChange={(checked) => handleCheckChange(index, checked as boolean)}
              className="mt-0.5"
              data-state={advancementChecks[index] ? "checked" : "unchecked"}
              aria-label={`Mark advancement: ${option}`}
            />
            <Label htmlFor={id} className="text-xs text-gray-300 leading-relaxed cursor-pointer">
              {option}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Advancements;
