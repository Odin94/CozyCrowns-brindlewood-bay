import { Checkbox } from "@/components/ui/checkbox"
import Headline from "@/components/ui/headline"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import SubHeadline from "@/components/ui/sub-headline"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { crownOfTheVoid } from "@/game_data"
import { useCharacterStore } from "@/lib/character_store"
import { Trans } from "@lingui/react/macro"
import { InfoIcon } from "lucide-react"
import { useState } from "react"

const CrownOfTheVoid = () => {
    const { voidChecks, setVoidChecks } = useCharacterStore()
    const [openPopover, setOpenPopover] = useState<number | null>(null)

    const handleCheckChange = (index: number, checked: boolean) => {
        const newChecks = [...voidChecks]
        newChecks[index] = checked
        setVoidChecks(newChecks)
    }

    return (
        <TooltipProvider>
            <div className="space-y-1">
                <div>
                    <Headline>
                        <Trans>Crown of the Void</Trans>
                    </Headline>
                    <SubHeadline className="mt-1">
                        <Trans>When you put on this Crown, mark the first empty box.</Trans>
                    </SubHeadline>
                </div>
                <div className="space-y-1">
                    {crownOfTheVoid.map((crown, index) => (
                        <div key={index} className="flex items-start space-x-3">
                            <Checkbox
                                id={`void-${index}`}
                                checked={voidChecks[index]}
                                onCheckedChange={(checked) => handleCheckChange(index, checked as boolean)}
                                className="mt-0.5"
                                aria-label={`Mark Crown of the Void: ${crown.title}`}
                            />
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Label htmlFor={`void-${index}`} className="text-xs leading-relaxed cursor-pointer">
                                        <span className="text-secondary font-semibold">{crown.title}</span>
                                    </Label>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="max-w-xs text-dark-secondary">{crown.description}</p>
                                </TooltipContent>
                            </Tooltip>
                            {/* Mobile only popover since tooltip doesn't work on mobile */}
                            <Popover open={openPopover === index} onOpenChange={(open) => !open && setOpenPopover(null)}>
                                <PopoverTrigger asChild>
                                    <InfoIcon
                                        className="w-3 h-3 text-primary md:hidden self-center cursor-pointer"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            setOpenPopover(openPopover === index ? null : index)
                                        }}
                                    />
                                </PopoverTrigger>
                                <PopoverContent className="w-60 mr-2 bg-primary text-dark-secondary">
                                    <p className="text-sm">{crown.description}</p>
                                </PopoverContent>
                            </Popover>
                        </div>
                    ))}
                </div>
            </div>
        </TooltipProvider>
    )
}

export default CrownOfTheVoid
