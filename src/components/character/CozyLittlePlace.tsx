import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import Headline from "@/components/ui/headline"

interface CozyLittlePlaceProps {
    cozyItems: Array<{ checked: boolean; text: string }>
    setCozyItems: (items: Array<{ checked: boolean; text: string }>) => void
}

const CozyLittlePlace = ({ cozyItems, setCozyItems }: CozyLittlePlaceProps) => {
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

            <div className="grid grid-cols-2 gap-3">
                {cozyItems.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2">
                        <Checkbox
                            checked={item.checked}
                            onCheckedChange={(checked) => handleCheckChange(index, checked as boolean)}
                            className="flex-shrink-0"
                        />
                        <Input
                            value={item.text}
                            onChange={(e) => handleTextChange(index, e.target.value)}
                            placeholder="Enter cozy item..."
                            className="flex-1 text-sm h-7 px-2 py-1"
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

export default CozyLittlePlace
