import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { sampleActivities } from "@/game_data"
import { useCharacterStore } from "@/lib/character_store"

const CozyActivity = () => {
    const { activity, setActivity } = useCharacterStore()
    return (
        <div className="space-y-3">
            <Label className="text-lg font-semibold text-secondary">Cozy Activity</Label>
            <div className="flex gap-2 items-center">
                <Input
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    placeholder="Enter cozy activity"
                    className="flex-1"
                />
                <DropdownMenu>
                    <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center text-sm border rounded-md bg-gray-800 border-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200">
                        ✨
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="grid grid-cols-1 sm:grid-cols-2 p-2">
                        {sampleActivities.map((sampleActivity) => (
                            <DropdownMenuItem key={sampleActivity} onClick={() => setActivity(sampleActivity)} className="text-xs">
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
