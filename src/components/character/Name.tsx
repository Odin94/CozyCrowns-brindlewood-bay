import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { sampleNames } from "@/game_data"
import { useCharacterStore } from "@/store/characterStore"

const Name = () => {
    const { name, setName } = useCharacterStore()
    return (
        <div className="space-y-3">
            <Label className="text-lg font-semibold text-secondary">Name</Label>
            <div className="flex gap-2 items-center">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter character name" className="flex-1" />
                <DropdownMenu>
                    <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center text-sm border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200">
                        ✨
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="grid grid-cols-2 p-2">
                        {sampleNames.map((sampleName) => (
                            <DropdownMenuItem key={sampleName} onClick={() => setName(sampleName)} className="text-xs">
                                {sampleName}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}

export default Name
