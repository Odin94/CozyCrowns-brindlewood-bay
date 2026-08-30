import { Checkbox } from "@/components/ui/checkbox";
import Headline from "@/components/ui/headline";
import { Label } from "@/components/ui/label";
import SubHeadline from "@/components/ui/sub-headline";
import { PressTooltip, TooltipProvider } from "@/components/ui/tooltip";
import { getCrownOfTheVoid } from "@/game_data";
import { useCharacterStore } from "@/lib/character_store";
import { Trans } from "@lingui/react/macro";

const CrownOfTheVoid = () => {
  const { voidChecks, setVoidChecks } = useCharacterStore();
  const handleCheckChange = (index: number, checked: boolean) => {
    const newChecks = [...voidChecks];
    newChecks[index] = checked;
    setVoidChecks(newChecks);
  };

  return (
    <TooltipProvider>
      <div className="space-y-1">
        <div>
          <Headline>
            <Trans>Crown of the Void</Trans>
          </Headline>
          <SubHeadline className="-mt-1 mb-2">
            <Trans>When you put on this Crown, mark the first empty box.</Trans>
          </SubHeadline>
        </div>
        <div className="space-y-1">
          {getCrownOfTheVoid().map((crown, index) => (
            <div key={crown.title} className="flex items-start space-x-3">
              <Checkbox
                id={`void-${index}`}
                checked={voidChecks[index]}
                onCheckedChange={(checked) => handleCheckChange(index, checked as boolean)}
                className="mt-0.5"
                aria-label={`Mark Crown of the Void: ${crown.title}`}
              />
              <PressTooltip content={crown.description} side="left">
                <Label
                  htmlFor={`void-${index}`}
                  className="cursor-pointer text-xs leading-relaxed"
                >
                  <span className="font-semibold text-secondary">{crown.title}</span>
                </Label>
              </PressTooltip>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default CrownOfTheVoid;
