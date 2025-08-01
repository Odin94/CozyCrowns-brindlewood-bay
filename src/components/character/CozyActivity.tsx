import React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type CozyActivityProps = {
    activity: string
    setActivity: (activity: string) => void
}

const sampleActivities = ["Reading", "Gardening", "Cooking", "Painting", "Walking"]

const CozyActivity: React.FC<CozyActivityProps> = ({ activity, setActivity }) => {
    return (
        <div className="space-y-3">
            <Label className="text-lg font-semibold text-secondary">Cozy Activity</Label>
            <div className="flex gap-2">
                <Input
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    placeholder="Enter cozy activity"
                    className="flex-1"
                />
                <DropdownMenu>
                    <DropdownMenuTrigger className="w-12 h-10 px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200">
                        ✨
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        {sampleActivities.map((sampleActivity) => (
                            <DropdownMenuItem key={sampleActivity} onClick={() => setActivity(sampleActivity)}>
                                {sampleActivity}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}

export default CozyActivity
