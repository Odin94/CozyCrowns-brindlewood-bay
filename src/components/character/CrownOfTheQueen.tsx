import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import Headline from "@/components/ui/headline"
import SubHeadline from "@/components/ui/sub-headline"
import { crownsOfTheQueen } from "@/game_data"
import { useCharacterStore } from "@/lib/character_store"

const CrownOfTheQueen = () => {
    const { crownChecks, setCrownChecks } = useCharacterStore()
    const handleCheckChange = (index: number, checked: boolean) => {
        const newChecks = [...crownChecks]
        newChecks[index] = checked
        setCrownChecks(newChecks)
    }

    return (
        <div className="space-y-1">
            <div>
                <Headline>Crown of the Queen</Headline>
                <SubHeadline className="-mt-1 mb-2">When you put on this Crown, mark and narrate any you wish.</SubHeadline>
            </div>
            <div className="space-y-1">
                {crownsOfTheQueen.map((crown, index) => (
                    <div key={index} className="flex items-start space-x-3">
                        <Checkbox
                            id={`crown-${index}`}
                            checked={crownChecks[index]}
                            onCheckedChange={(checked) => handleCheckChange(index, checked as boolean)}
                            className="mt-0.5"
                            aria-label={`Mark Crown of the Queen: ${crown}`}
                        />
                        <Label htmlFor={`crown-${index}`} className="text-xs text-gray-300 leading-relaxed cursor-pointer">
                            {crown}
                        </Label>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default CrownOfTheQueen
