import { Checkbox } from "@/components/ui/checkbox"
import { LineInput } from "@/components/ui/line-input"
import Headline from "@/components/ui/headline"
import { useCharacterStore } from "@/store/characterStore"

const CozyLittlePlace = () => {
    const { cozyItems, setCozyItems } = useCharacterStore()
    const handleCheckChange = (index: number, checked: boolean) => {
        const newItems = [...cozyItems]
        newItems[index].checked = checked
        setCozyItems(newItems)
    }

    const handleTextChange = (index: number, text: string) => {
        const newItems = [...cozyItems]
        newItems[index].text = text
        setCozyItems(newItems)
    }

    return (
        <div className="space-y-4">
            <div>
                <Headline>A Cozy Little Place</Headline>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cozyItems.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2">
                        <Checkbox
                            checked={item.checked}
                            onCheckedChange={(checked) => handleCheckChange(index, checked as boolean)}
                            className="flex-shrink-0"
                        />
                        <LineInput
                            value={item.text}
                            onChange={(e) => handleTextChange(index, e.target.value)}
                            placeholder=""
                            className="flex-1 h-5"
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

export default CozyLittlePlace
