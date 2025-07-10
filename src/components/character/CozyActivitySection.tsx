import React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

interface CozyActivitySectionProps {
    activity: string
    setActivity: (activity: string) => void
}

const sampleActivities = ["Reading", "Gardening", "Cooking", "Painting", "Walking"]

const CozyActivitySection: React.FC<CozyActivitySectionProps> = ({ activity, setActivity }) => {
    return (
        <div className="space-y-3">
            <Label className="text-lg font-semibold text-gray-700 dark:text-gray-200">Cozy Activity</Label>
            <div className="flex gap-2">
                <Input
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    placeholder="Enter cozy activity"
                    className="flex-1"
                />
                <Select onValueChange={setActivity}>
                    <SelectTrigger className="w-12">
                        <span>✨</span>
                    </SelectTrigger>
                    <SelectContent>
                        {sampleActivities.map((sampleActivity) => (
                            <SelectItem key={sampleActivity} value={sampleActivity}>
                                {sampleActivity}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    )
}

export default CozyActivitySection
