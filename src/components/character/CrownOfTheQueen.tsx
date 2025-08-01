import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { crownsOfTheQueen } from "@/game_data"

type CrownOfTheQueenProps = {
    crownChecks: boolean[]
    setCrownChecks: (checks: boolean[]) => void
}

const CrownOfTheQueen = ({ crownChecks, setCrownChecks }: CrownOfTheQueenProps) => {
    const handleCheckChange = (index: number, checked: boolean) => {
        const newChecks = [...crownChecks]
        newChecks[index] = checked
        setCrownChecks(newChecks)
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-xl font-bold text-secondary">Crown of the Queen</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">When you put on this Crown, mark and narrate any you wish.</p>
            </div>
            <div className="space-y-3">
                {crownsOfTheQueen.map((crown, index) => (
                    <div key={index} className="flex items-start space-x-3">
                        <Checkbox
                            id={`crown-${index}`}
                            checked={crownChecks[index]}
                            onCheckedChange={(checked) => handleCheckChange(index, checked as boolean)}
                            className="mt-0.5"
                        />
                        <Label
                            htmlFor={`crown-${index}`}
                            className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed cursor-pointer"
                        >
                            {crown}
                        </Label>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default CrownOfTheQueen
