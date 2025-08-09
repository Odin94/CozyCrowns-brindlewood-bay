import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PlusIcon, MinusIcon } from "lucide-react"
import { useCharacterStore } from "@/store/characterStore"

const Abilities = () => {
    const { abilities, setAbilities } = useCharacterStore()
    const handleAbilityChange = (index: number, value: number) => {
        const newAbilities = [...abilities]
        newAbilities[index].value = Math.max(-3, Math.min(3, value))
        setAbilities(newAbilities)
    }

    return (
        <div className="space-y-3">
            <Label className="text-lg font-semibold text-secondary">Abilities</Label>
            <div className="space-y-2">
                {abilities.map((ability, index) => (
                    <div key={ability.name} className="flex items-center justify-between">
                        <Label className="text-sm text-gray-600 dark:text-gray-300 w-20">{ability.name}</Label>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAbilityChange(index, ability.value - 1)}
                                disabled={ability.value <= -3}
                                className="w-7 h-7 p-0 hover:text-tertiary hover:border-tertiary"
                                aria-label={`Decrease ${ability.name} ability score`}
                            >
                                <MinusIcon className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center font-medium text-gray-700 dark:text-gray-200">
                                {ability.value >= 0 ? `+${ability.value}` : ability.value}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAbilityChange(index, ability.value + 1)}
                                disabled={ability.value >= 3}
                                className="w-7 h-7 p-0 hover:text-tertiary hover:border-tertiary"
                                aria-label={`Increase ${ability.name} ability score`}
                            >
                                <PlusIcon className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default Abilities
