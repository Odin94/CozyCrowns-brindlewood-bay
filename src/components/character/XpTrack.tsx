import React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

type XpTrackProps = {
    xpTrack: boolean[]
    setXpTrack: (xpTrack: boolean[]) => void
}

const XpTrack: React.FC<XpTrackProps> = ({ xpTrack, setXpTrack }) => {
    const handleXpChange = (index: number, checked: boolean) => {
        const newXpTrack = [...xpTrack]
        newXpTrack[index] = checked
        setXpTrack(newXpTrack)
    }

    return (
        <div className="space-y-3">
            <Label className="text-lg font-semibold text-gray-700 dark:text-gray-200">XP Track</Label>
            <div className="flex gap-2">
                {xpTrack.map((checked, index) => (
                    <div key={index} className="flex items-center space-x-2">
                        <Checkbox
                            id={`xp-${index}`}
                            checked={checked}
                            onCheckedChange={(checked) => handleXpChange(index, checked as boolean)}
                        />
                        <Label htmlFor={`xp-${index}`} className="text-sm text-gray-600 dark:text-gray-300">
                            {index + 1}
                        </Label>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default XpTrack
