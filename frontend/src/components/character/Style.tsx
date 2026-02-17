import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getSampleStyles } from "@/game_data"
import { useCharacterStore } from "@/lib/character_store"
import { Trans } from "@lingui/react/macro"

const Style = () => {
    const { style, setStyle } = useCharacterStore()

    // Get the styles dynamically so they update when locale changes
    const sampleStyles = getSampleStyles()

    return (
        <div className="space-y-3">
            <Label className="text-lg font-semibold text-secondary">
                <Trans>Style</Trans>
            </Label>
            <div className="flex gap-2 items-center">
                <Input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Enter character style" className="flex-1" />
                <DropdownMenu>
                    <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center text-sm border rounded-md bg-gray-800 border-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200">
                        ✨
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="grid grid-cols-1 sm:grid-cols-2 p-2">
                        {sampleStyles.map((sampleStyle) => (
                            <DropdownMenuItem key={sampleStyle} onClick={() => setStyle(sampleStyle)} className="text-xs">
                                {sampleStyle}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}

export default Style
