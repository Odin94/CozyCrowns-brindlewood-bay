import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { crownOfTheVoid } from "@/game_data"

type CrownOfTheVoidProps = {
    voidChecks: boolean[]
    setVoidChecks: (checks: boolean[]) => void
}

const CrownOfTheVoid = ({ voidChecks, setVoidChecks }: CrownOfTheVoidProps) => {
    const handleCheckChange = (index: number, checked: boolean) => {
        const newChecks = [...voidChecks]
        newChecks[index] = checked
        setVoidChecks(newChecks)
    }

    return (
        <TooltipProvider>
            <div className="space-y-1">
                <div>
                    <h2 className="text-xl font-bold text-secondary">Crown of the Void</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">When you put on this Crown, mark the first empty box.</p>
                </div>
                <div className="space-y-1">
                    {crownOfTheVoid.map((crown, index) => (
                        <div key={index} className="flex items-start space-x-3">
                            <Checkbox
                                id={`void-${index}`}
                                checked={voidChecks[index]}
                                onCheckedChange={(checked) => handleCheckChange(index, checked as boolean)}
                                className="mt-0.5"
                            />
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Label
                                        htmlFor={`void-${index}`}
                                        className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed cursor-pointer"
                                    >
                                        <span className="text-secondary font-semibold">{crown.title}</span>
                                    </Label>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="max-w-xs text-black">{crown.description}</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    ))}
                </div>
            </div>
        </TooltipProvider>
    )
}

export default CrownOfTheVoid
