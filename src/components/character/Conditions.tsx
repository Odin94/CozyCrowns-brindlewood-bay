import React from "react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

type ConditionsProps = {
    conditions: string
    setConditions: (conditions: string) => void
}

const Conditions: React.FC<ConditionsProps> = ({ conditions, setConditions }) => {
    return (
        <div className="space-y-3">
            <Label className="text-lg font-semibold text-gray-700 dark:text-gray-200">Conditions</Label>
            <Textarea
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                placeholder="Enter any conditions or notes..."
                className="min-h-[100px] resize-none"
            />
        </div>
    )
}

export default Conditions
