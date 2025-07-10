import React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

type EndOfSessionProps = {
    endOfSessionChecks: boolean[]
    setEndOfSessionChecks: (checks: boolean[]) => void
}

const endOfSessionQuestions = [
    "Did the Murder Mavens solve a mystery?",
    "Did you secretly undermine the authority of a local official?",
    "Did you share your wisdom with a young person?",
    "Did you share a memory of a late family member?",
    "Did you behave like a woman half your age?",
    "Did you dote on someone?",
    'Did you show someone that you\'ve "still got it?"',
]

const EndOfSession: React.FC<EndOfSessionProps> = ({ endOfSessionChecks, setEndOfSessionChecks }) => {
    const handleCheckChange = (index: number, checked: boolean) => {
        const newChecks = [...endOfSessionChecks]
        newChecks[index] = checked
        setEndOfSessionChecks(newChecks)
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">End of Session</h2>
            <div className="space-y-3">
                {endOfSessionQuestions.map((question, index) => (
                    <div key={index} className="flex items-start space-x-3">
                        <Checkbox
                            id={`end-session-${index}`}
                            checked={endOfSessionChecks[index]}
                            onCheckedChange={(checked) => handleCheckChange(index, checked as boolean)}
                            className="mt-0.5"
                        />
                        <Label
                            htmlFor={`end-session-${index}`}
                            className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed cursor-pointer"
                        >
                            {question}
                        </Label>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default EndOfSession
