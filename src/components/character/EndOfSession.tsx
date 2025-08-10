import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import Headline from "@/components/ui/headline"
import SubHeadline from "@/components/ui/sub-headline"
import { endOfSessionQuestions } from "../../game_data"
import { useCharacterStore } from "@/store/characterStore"

const EndOfSession = () => {
    const { endOfSessionChecks, setEndOfSessionChecks } = useCharacterStore()
    const handleCheckChange = (index: number, checked: boolean) => {
        const newChecks = [...endOfSessionChecks]
        newChecks[index] = checked
        setEndOfSessionChecks(newChecks)
    }

    return (
        <div className="space-y-4">
            <Headline>End of Session</Headline>
            <SubHeadline className="-mt-5 mb-2">
                The first is always marked. At the beginning of a session, mark two more (three total marked).
            </SubHeadline>

            <div className="space-y-3">
                {endOfSessionQuestions.map((question, index) => (
                    <div key={index} className="flex items-start space-x-3">
                        <Checkbox
                            id={`end-session-${index}`}
                            checked={endOfSessionChecks[index]}
                            onCheckedChange={(checked) => handleCheckChange(index, checked as boolean)}
                            className="mt-0.5"
                            aria-label={`Mark end of session question: ${question}`}
                        />
                        <Label htmlFor={`end-session-${index}`} className="text-xs text-gray-300 leading-relaxed cursor-pointer">
                            {question}
                        </Label>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default EndOfSession
