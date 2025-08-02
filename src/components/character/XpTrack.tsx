import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useCharacterStore } from "@/store/characterStore"

const XpTrack = () => {
    const { xp, setXp } = useCharacterStore()
    return (
        <div className="flex items-center gap-4">
            <Label className="text-lg font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">XP Track</Label>
            <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center space-x-2">
                        <Checkbox
                            id={`xp-${i}`}
                            checked={i <= xp}
                            onCheckedChange={() => {
                                if (xp === i) setXp(0)
                                else setXp(i)
                            }}
                            aria-label={`Mark ${i} experience point${i === 1 ? "" : "s"}`}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

export default XpTrack
