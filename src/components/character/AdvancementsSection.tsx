import React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface AdvancementsSectionProps {
    advancementChecks: boolean[]
    setAdvancementChecks: (checks: boolean[]) => void
}

const advancementOptions = [
    "Increase an ability modifier by 1 (max +3).",
    "Increase an ability modifier by 1 (max +3).",
    "Choose an additional Maven move.",
    "Choose an additional Maven move.",
    "Unmark all the items in your Cozy Little Place.",
]

const AdvancementsSection: React.FC<AdvancementsSectionProps> = ({ advancementChecks, setAdvancementChecks }) => {
    const handleCheckChange = (index: number, checked: boolean) => {
        const newChecks = [...advancementChecks]
        newChecks[index] = checked
        setAdvancementChecks(newChecks)
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Advancements</h2>
            <div className="space-y-3">
                {advancementOptions.map((option, index) => (
                    <div key={index} className="flex items-start space-x-3">
                        <Checkbox
                            id={`advancement-${index}`}
                            checked={advancementChecks[index]}
                            onCheckedChange={(checked) => handleCheckChange(index, checked as boolean)}
                            className="mt-0.5"
                        />
                        <Label
                            htmlFor={`advancement-${index}`}
                            className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed cursor-pointer"
                        >
                            {option}
                        </Label>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default AdvancementsSection
