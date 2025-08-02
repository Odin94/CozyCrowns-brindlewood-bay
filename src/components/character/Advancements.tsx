import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import Headline from "@/components/ui/headline"
import { advancementOptions } from "../../game_data"

type AdvancementsProps = {
    advancementChecks: boolean[]
    setAdvancementChecks: (checks: boolean[]) => void
}

const Advancements = ({ advancementChecks, setAdvancementChecks }: AdvancementsProps) => {
    const handleCheckChange = (index: number, checked: boolean) => {
        console.log(`Advancement ${index} changed to:`, checked)
        const newChecks = [...advancementChecks]
        newChecks[index] = checked
        setAdvancementChecks(newChecks)
        console.log("New advancement checks:", newChecks)
    }

    return (
        <div className="space-y-4">
            <Headline>Advancements</Headline>
            <div className="space-y-3">
                {advancementOptions.map((option, index) => (
                    <div key={index} className="flex items-start space-x-3">
                        <Checkbox
                            id={`advancement-${index}`}
                            checked={advancementChecks[index]}
                            onCheckedChange={(checked) => handleCheckChange(index, checked as boolean)}
                            className="mt-0.5"
                            data-state={advancementChecks[index] ? "checked" : "unchecked"}
                            aria-label={`Mark advancement: ${option}`}
                        />
                        <Label
                            htmlFor={`advancement-${index}`}
                            className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed cursor-pointer"
                        >
                            {option}
                        </Label>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default Advancements
